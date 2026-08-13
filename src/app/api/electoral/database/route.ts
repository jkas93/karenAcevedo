import { randomUUID } from 'node:crypto';
import type { DocumentData, DocumentSnapshot, Firestore } from 'firebase-admin/firestore';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { getAdminServices } from '@/lib/firebase-admin';
import { ApiError, apiErrorResponse, readJsonBody, requirePermission } from '@/lib/server/admin-auth';

export const runtime = 'nodejs';

const MAX_ROWS = 5000;
const MAX_BODY_BYTES = 3 * 1024 * 1024;
const BATCH_SIZE = 400;
const COLLECTIONS = ['actas', 'mesas', 'locales'] as const;

type ImportRow = {
  mesa: string;
  local: string;
  direccion?: string;
  zona?: string;
  latitud?: number;
  longitud?: number;
};

type BackupDocument = { id: string; data: DocumentData };
type Backup = Record<(typeof COLLECTIONS)[number], BackupDocument[]>;

const STANDARD_LOCATIONS = [
  { nombre: 'I.E. FELIPE SANTIAGO ESTENOS', direccion: 'Av. Nicolás Ayllón S/N, Cuadra 23', latitud: -11.979, longitud: -76.7725, zona: 'Centro', mesas: 18 },
  { nombre: 'I.E. 1188 JUAN PABLO II', direccion: 'Ca. Los Rosales S/N, Huascata', latitud: -11.973, longitud: -76.755, zona: 'Huascata', mesas: 12 },
  { nombre: 'I.E. 1190 MARIANO MELGAR', direccion: 'Ca. San Martín S/N, Miguel Grau', latitud: -11.986, longitud: -76.782, zona: 'Miguel Grau', mesas: 10 },
  { nombre: 'I.E. MIGUEL GRAU SEMINARIO', direccion: 'Ca. Libertad 123', latitud: -11.9805, longitud: -76.768, zona: 'Centro', mesas: 14 },
  { nombre: 'I.E. 0053 SAN VICENTE DE PAUL', direccion: 'Av. Las Gardenias', latitud: -11.9715, longitud: -76.749, zona: 'Huascata', mesas: 8 },
  { nombre: 'I.E. SAN JUAN BOSCO', direccion: 'Jr. Arequipa 450', latitud: -11.9815, longitud: -76.765, zona: 'Centro', mesas: 6 },
  { nombre: 'ESTADIO MUNICIPAL TAHUANTINSUYO', direccion: 'Av. Los Laureles', latitud: -11.977, longitud: -76.77, zona: 'Centro', mesas: 22 },
];

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function normalizedRows(value: unknown): ImportRow[] {
  if (!Array.isArray(value) || value.length === 0) throw new ApiError(400, 'No hay filas para importar.');
  if (value.length > MAX_ROWS) throw new ApiError(400, `La importación admite hasta ${MAX_ROWS} mesas por operación.`);

  const seen = new Set<string>();
  return value.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new ApiError(400, `La fila ${index + 1} no es válida.`);
    const row = item as Record<string, unknown>;
    const mesa = cleanText(row.mesa, 20);
    const local = cleanText(row.local, 160);
    if (!/^\d{4,10}$/.test(mesa)) throw new ApiError(400, `La mesa de la fila ${index + 1} debe contener entre 4 y 10 dígitos.`);
    if (local.length < 2) throw new ApiError(400, `El local de la fila ${index + 1} no es válido.`);
    if (seen.has(mesa)) throw new ApiError(400, `La mesa ${mesa} está duplicada en el archivo.`);
    seen.add(mesa);

    const latitud = typeof row.latitud === 'number' && Number.isFinite(row.latitud) ? row.latitud : undefined;
    const longitud = typeof row.longitud === 'number' && Number.isFinite(row.longitud) ? row.longitud : undefined;
    if (latitud !== undefined && (latitud < -90 || latitud > 90)) throw new ApiError(400, `La latitud de la fila ${index + 1} no es válida.`);
    if (longitud !== undefined && (longitud < -180 || longitud > 180)) throw new ApiError(400, `La longitud de la fila ${index + 1} no es válida.`);

    return {
      mesa,
      local,
      direccion: cleanText(row.direccion, 200) || undefined,
      zona: cleanText(row.zona, 100) || undefined,
      latitud,
      longitud,
    };
  });
}

function standardRows(): ImportRow[] {
  let mesa = 45000;
  return STANDARD_LOCATIONS.flatMap((location) =>
    Array.from({ length: location.mesas }, () => ({
      mesa: String(mesa++).padStart(6, '0'),
      local: location.nombre,
      direccion: location.direccion,
      zona: location.zona,
      latitud: location.latitud,
      longitud: location.longitud,
    })),
  );
}

function jitter(seed: string, axis: number) {
  let hash = axis + 17;
  for (const character of seed) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return ((hash % 10000) / 10000 - 0.5) * 0.015;
}

function buildDocuments(db: Firestore, rows: ImportRow[]) {
  const grouped = new Map<string, { local: ImportRow; mesas: string[] }>();
  for (const row of rows) {
    const key = row.local.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    const current = grouped.get(key);
    if (current) current.mesas.push(row.mesa);
    else grouped.set(key, { local: row, mesas: [row.mesa] });
  }

  const writes: Array<{ path: string; data: DocumentData }> = [];
  for (const { local, mesas } of grouped.values()) {
    const localRef = db.collection('locales').doc();
    writes.push({
      path: localRef.path,
      data: {
        nombre: local.local,
        direccion: local.direccion || 'Dirección no especificada',
        zona_id: local.zona || 'General',
        latitud: local.latitud ?? -11.9818 + jitter(local.local, 1),
        longitud: local.longitud ?? -76.7651 + jitter(local.local, 2),
        total_mesas: mesas.length,
      },
    });
    for (const numero of mesas) {
      writes.push({
        path: db.collection('mesas').doc().path,
        data: { numero, local_id: localRef.id, personero_uid: null, estado: 'pendiente' },
      });
    }
  }
  return { writes, locales: grouped.size, mesas: rows.length };
}

async function commitInChunks<T>(items: T[], callback: (item: T, batch: ReturnType<Firestore['batch']>) => void, db: Firestore) {
  for (let start = 0; start < items.length; start += BATCH_SIZE) {
    const batch = db.batch();
    items.slice(start, start + BATCH_SIZE).forEach((item) => callback(item, batch));
    await batch.commit();
  }
}

async function snapshotBackup(db: Firestore): Promise<Backup> {
  const snapshots = await Promise.all(COLLECTIONS.map((name) => db.collection(name).get()));
  return Object.fromEntries(COLLECTIONS.map((name, index) => [name, snapshots[index].docs.map((doc) => ({ id: doc.id, data: doc.data() }))])) as Backup;
}

async function deleteCollections(db: Firestore) {
  for (const name of COLLECTIONS) {
    const snapshot = await db.collection(name).get();
    await commitInChunks(snapshot.docs, (document: DocumentSnapshot, batch) => batch.delete(document.ref), db);
  }
}

async function restoreBackup(db: Firestore, backup: Backup) {
  await deleteCollections(db);
  for (const name of COLLECTIONS) {
    await commitInChunks(backup[name], (document, batch) => batch.set(db.collection(name).doc(document.id), document.data), db);
  }
}

export async function POST(request: Request) {
  let lockId = '';
  let lockRef: FirebaseFirestore.DocumentReference | null = null;
  try {
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > MAX_BODY_BYTES) throw new ApiError(413, 'La solicitud de importación es demasiado grande.');

    const session = await requirePermission(request, 'electoral.manage');
    const body = await readJsonBody(request);
    const action = typeof body.action === 'string' ? body.action : '';
    if (!['import', 'seed', 'clear'].includes(action)) throw new ApiError(400, 'La operación electoral no es válida.');

    const { adminDb } = getAdminServices();
    lockId = randomUUID();
    lockRef = adminDb.doc('systemLocks/electoral-database');
    await adminDb.runTransaction(async (transaction) => {
      const lock = await transaction.get(lockRef!);
      const expiresAt = lock.data()?.expiresAt;
      if (expiresAt instanceof Timestamp && expiresAt.toMillis() > Date.now()) {
        throw new ApiError(409, 'Ya hay otra operación electoral en curso.');
      }
      transaction.set(lockRef!, { lockId, actor: session.email, expiresAt: Timestamp.fromMillis(Date.now() + 10 * 60 * 1000) });
    });

    const rows = action === 'seed' ? standardRows() : action === 'import' ? normalizedRows(body.rows) : [];
    const replacement = action === 'clear' ? null : buildDocuments(adminDb, rows);
    const backup = await snapshotBackup(adminDb);

    try {
      await deleteCollections(adminDb);
      if (replacement) {
        await commitInChunks(replacement.writes, (write, batch) => batch.set(adminDb.doc(write.path), write.data), adminDb);
      }
    } catch (error) {
      await restoreBackup(adminDb, backup);
      throw error;
    }

    await adminDb.collection('electoralAudit').add({
      action,
      actor: session.email,
      locales: replacement?.locales ?? 0,
      mesas: replacement?.mesas ?? 0,
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, locales: replacement?.locales ?? 0, mesas: replacement?.mesas ?? 0 });
  } catch (error) {
    return apiErrorResponse(error);
  } finally {
    if (lockRef && lockId) {
      await lockRef.get().then((snapshot) => snapshot.data()?.lockId === lockId ? lockRef!.delete() : undefined).catch(() => undefined);
    }
  }
}
