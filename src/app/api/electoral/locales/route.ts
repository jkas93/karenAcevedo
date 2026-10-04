import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { getAdminServices } from '@/lib/firebase-admin';
import {
  ApiError,
  apiErrorResponse,
  readJsonBody,
  requirePermission,
} from '@/lib/server/admin-auth';
import { CHACLACAYO_ELECTORAL_LOCATIONS } from '@/lib/electoral/locations';

export const runtime = 'nodejs';

function cleanId(value: unknown) {
  const id = typeof value === 'string' ? value.trim() : '';
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new ApiError(400, 'El local seleccionado no es válido.');
  return id;
}

function cleanCoordinator(value: unknown) {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'string') throw new ApiError(400, 'El nombre del coordinador no es válido.');
  const coordinator = value.trim().replace(/\s+/g, ' ');
  if (coordinator.length > 120) throw new ApiError(400, 'El nombre del coordinador no puede superar 120 caracteres.');
  return coordinator;
}

export async function POST(request: Request) {
  try {
    const session = await requirePermission(request, 'electoral.manage');
    const body = await readJsonBody(request);
    if (body.action !== 'updateCoordinator') throw new ApiError(400, 'La operación solicitada no es válida.');

    const localId = cleanId(body.localId);
    const coordinador = cleanCoordinator(body.coordinador);
    const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : '';
    const shortName = typeof body.shortName === 'string' ? body.shortName.trim() : '';

    const { adminDb } = getAdminServices();
    let reference = adminDb.collection('locales').doc(localId);
    const snapshot = await reference.get();

    if (snapshot.exists) {
      await reference.update({ coordinador });
    } else {
      // Intentar buscar coincidencia en la colección de locales por nombre o código
      const allLocalesSnap = await adminDb.collection('locales').get();
      const match = allLocalesSnap.docs.find((doc) => {
        const data = doc.data();
        const docNombre = (data.nombre || '').toLowerCase();
        if (nombre && docNombre.includes(nombre.toLowerCase())) return true;
        if (shortName && docNombre.includes(shortName.toLowerCase())) return true;
        return false;
      });

      if (match) {
        reference = match.ref;
        await reference.update({ coordinador });
      } else {
        // Si no existe el documento en Firestore, crearlo para persistirlo
        const seed = CHACLACAYO_ELECTORAL_LOCATIONS.find(
          (s) =>
            `local_${s.code.toLowerCase()}` === localId ||
            s.code === localId ||
            (nombre && s.nombre.toLowerCase().includes(nombre.toLowerCase())) ||
            (shortName && s.shortName.toLowerCase().includes(shortName.toLowerCase())),
        );

        await reference.set(
          {
            nombre: seed?.nombre || nombre || 'Colegio Chaclacayo',
            direccion: [seed?.direccion, seed?.referencia].filter(Boolean).join(' · ') || 'Chaclacayo',
            coordinador,
            zona_id: seed?.zona || 'General',
            latitud: seed?.latitud || -11.98,
            longitud: seed?.longitud || -76.76,
            total_mesas: seed?.mesas || 16,
          },
          { merge: true },
        );
      }
    }

    await adminDb.collection('electoralAudit').add({
      action: 'local.coordinator.update',
      localId: reference.id,
      coordinador,
      actor: session.email,
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, localId: reference.id, coordinador });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
