import 'server-only';

import { randomBytes, randomUUID } from 'node:crypto';
import { FieldPath, Timestamp, type DocumentData } from 'firebase-admin/firestore';
import { getAdminServices } from '@/lib/firebase-admin';
import { ApiError, requirePermission } from '@/lib/server/admin-auth';
import { canonical, CHALLENGE_MS, codeHash, leaseDuration, PAIRING_MS, pairingCode, parseKey, searchPrefixes, sha256, validSignature } from '@/lib/autoclicker/protocol';

const db = () => getAdminServices().adminDb;
const ms = (value: unknown): number | null => value instanceof Timestamp ? value.toMillis() : null;
const nowStamp = () => Timestamp.now();
export function stringField(body: Record<string, unknown>, key: string, max = 200, optional = false): string {
  const value = body[key];
  if (optional && (value === undefined || value === null || value === '')) return '';
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new ApiError(400, `Campo inválido: ${key}.`);
  return value.trim();
}
function idField(body: Record<string, unknown>, key = 'deviceId') {
  const id = stringField(body, key, 64);
  if (!/^[a-f0-9]{64}$/.test(id)) throw new ApiError(400, 'Identificador inválido.');
  return id;
}
function secret() {
  const value = process.env.AUTOCLICKER_PAIRING_SECRET;
  if (!value || value.length < 32) throw new ApiError(503, 'El módulo requiere configurar AUTOCLICKER_PAIRING_SECRET en el servidor.');
  return value;
}
export async function rateLimit(key: string, limit: number, windowMs = 60_000) {
  const ref = db().collection('autoClickerRateLimits').doc(sha256(key));
  await db().runTransaction(async tx => {
    const data = (await tx.get(ref)).data();
    const now = Date.now();
    const active = (ms(data?.expiresAt) ?? 0) > now;
    if (active && data!.count >= limit) throw new ApiError(429, 'Demasiados intentos. Intenta más tarde.');
    tx.set(ref, { count: active ? data!.count + 1 : 1, expiresAt: active ? data!.expiresAt : Timestamp.fromMillis(now + windowMs) });
  });
}
export async function rateRequest(request: Request, lane: string, limit: number) {
  // Trust forwarding headers only when the deployment proxy overwrites them.
  const header = process.env.AUTOCLICKER_TRUST_PROXY === 'true' ? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() : null;
  await rateLimit(`${lane}:ip:${header || 'shared'}`, limit);
}
function metadata(body: Record<string, unknown>) {
  const raw = body.metadata;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new ApiError(400, 'Faltan metadatos.');
  const m = raw as Record<string, unknown>;
  const width = Number(m.width), height = Number(m.height);
  if (![width, height].every(v => Number.isInteger(v) && v >= 1 && v <= 20000)) throw new ApiError(400, 'Pantalla inválida.');
  return { manufacturer: stringField(m, 'manufacturer', 80), model: stringField(m, 'model', 100), android: stringField(m, 'android', 40), appVersion: stringField(m, 'appVersion', 40), width, height };
}
function publicDevice(id: string, d: DocumentData) {
  return { id, owner: d.owner, alias: d.alias, state: d.state, version: d.version, metadata: d.metadata,
    expiresAt: ms(d.expiresAt), createdAt: ms(d.createdAt), updatedAt: ms(d.updatedAt), lastSeenAt: ms(d.lastSeenAt),
    reportedState: d.reportedState ?? null, leaseExpiresAt: ms(d.leaseExpiresAt) };
}
export async function createChallenge(body: Record<string, unknown>) {
  let identity: ReturnType<typeof parseKey>;
  try { identity = parseKey(stringField(body, 'publicKey', 512)); }
  catch { throw new ApiError(400, 'Clave pública inválida; se requiere EC P-256.'); }
  await rateLimit(`challenge:${identity.deviceId}`, 30);
  const challengeId = randomUUID(), nonce = randomBytes(32).toString('base64url');
  await db().collection('autoClickerChallenges').doc(challengeId).create({ ...{ publicKey: identity.publicKey, deviceId: identity.deviceId }, nonce,
    expiresAt: Timestamp.fromMillis(Date.now() + CHALLENGE_MS), used: false });
  return { challengeId, nonce, deviceId: identity.deviceId, expiresInMs: CHALLENGE_MS };
}
export async function deviceCommand(body: Record<string, unknown>) {
  const challengeId = stringField(body, 'challengeId', 36);
  if (!/^[a-f0-9-]{36}$/.test(challengeId)) throw new ApiError(400, 'Desafío inválido.');
  const payload = stringField(body, 'payload', 8000), signature = stringField(body, 'signature', 256);
  let command: Record<string, unknown>;
  try { command = JSON.parse(payload); if (!command || typeof command !== 'object' || Array.isArray(command)) throw new Error(); }
  catch { throw new ApiError(400, 'Comando inválido.'); }
  const action = stringField(command, 'action', 30);
  if (!['pair', 'status', 'start', 'renew', 'stop'].includes(action)) throw new ApiError(400, 'Acción inválida.');
  const challengeRef = db().collection('autoClickerChallenges').doc(challengeId);
  const challenge = (await challengeRef.get()).data();
  if (!challenge || challenge.used || (ms(challenge.expiresAt) ?? 0) <= Date.now() ||
    !validSignature(challenge.publicKey, canonical(challengeId, challenge.nonce, payload), signature)) throw new ApiError(401, 'Desafío vencido o firma inválida.');
  const deviceId: string = challenge.deviceId;
  if (action === 'pair') await rateLimit(`pair:${deviceId}`, 5, PAIRING_MS);
  const deviceRef = db().collection('autoClickerDevices').doc(deviceId);
  const pairingRef = db().collection('autoClickerInstallations').doc(deviceId);
  const meta = action === 'pair' ? metadata(command) : null;
  const code = action === 'pair' ? pairingCode() : '';
  const hash = code ? codeHash(code, secret()) : '';
  const codeRef = db().collection('autoClickerPairings').doc(hash || 'unused');
  const sessionId = action === 'start' ? randomUUID() : '';
  return db().runTransaction(async tx => {
    const [fresh, device, installation] = await Promise.all([tx.get(challengeRef), tx.get(deviceRef), tx.get(pairingRef)]);
    const c = fresh.data(), d = device.data(), i = installation.data();
    const now = Date.now(), stamp = Timestamp.fromMillis(now);
    if (!c || c.used || (ms(c.expiresAt) ?? 0) <= now) throw new ApiError(401, 'Desafío ya usado o vencido.');
    if (action === 'pair') {
      if (device.exists) throw new ApiError(409, d?.state === 'revoked' ? 'Identidad revocada. Restablece la vinculación en la app.' : 'Esta instalación ya está vinculada.');
      const existing = (await tx.get(codeRef)).data();
      if (existing && (ms(existing.expiresAt) ?? 0) > now) throw new ApiError(409, 'Colisión temporal de código. Solicita otro.');
      tx.update(challengeRef, { used: true });
      if (i?.codeHash) tx.delete(db().collection('autoClickerPairings').doc(i.codeHash));
      tx.set(codeRef, { deviceId, publicKey: c.publicKey, metadata: meta, expiresAt: Timestamp.fromMillis(now + PAIRING_MS) });
      tx.set(pairingRef, { codeHash: hash, expiresAt: Timestamp.fromMillis(now + PAIRING_MS) });
      return { deviceId, code, expiresAt: now + PAIRING_MS, state: 'pending' };
    }
    tx.update(challengeRef, { used: true });
    if (!d) return { deviceId, state: 'pending', pairingExpiresAt: ms(i?.expiresAt), serverTime: now };
    if (action === 'status') return { deviceId, state: d.state, owner: d.owner, alias: d.alias, expiresAt: ms(d.expiresAt), serverTime: now };
    if (action === 'stop') {
      // A delayed stop from a former execution must not stop a newer session.
      if (command.sessionId === d.sessionId || d.state !== 'enabled') tx.update(deviceRef, { sessionId: null, leaseExpiresAt: null, lastSeenAt: stamp, reportedState: 'stopped' });
      return { state: d.state, stopped: true };
    }
    const durationMs = leaseDuration(d.state, ms(d.expiresAt), now);
    if (!durationMs) return { allowed: false, state: d.state, reason: 'Equipo deshabilitado, revocado o autorización vencida.', serverTime: now };
    if (action === 'renew' && (command.sessionId !== d.sessionId || command.version !== d.version || (ms(d.leaseExpiresAt) ?? 0) <= now)) {
      return { allowed: false, reason: 'La sesión venció. Pulsa Play nuevamente.', serverTime: now };
    }
    const activeSession = action === 'start' ? sessionId : d.sessionId;
    tx.update(deviceRef, { sessionId: activeSession, leaseExpiresAt: Timestamp.fromMillis(now + durationMs), lastSeenAt: stamp, reportedState: 'running' });
    return { allowed: true, sessionId: activeSession, version: d.version, durationMs, serverTime: now, expiresAt: now + durationMs };
  });
}

export async function adminCommand(request: Request, body: Record<string, unknown>) {
  const action = stringField(body, 'action', 30);
  const actions = { list: 'devices.view', detail: 'devices.view', preview: 'devices.manage', claim: 'devices.manage', edit: 'devices.manage', authorize: 'devices.authorize', audit: 'devices.audit' } as const;
  const permission = actions[action as keyof typeof actions];
  if (!permission) throw new ApiError(400, 'Acción desconocida.');
  const actor = await requirePermission(request, permission);
  const pairingAction = action === 'claim' || action === 'preview';
  await rateLimit(`admin:${actor.token.uid}:${pairingAction ? 'pairing' : 'operations'}`, pairingAction ? 20 : 120);
  if (action === 'list') {
    let query = db().collection('autoClickerDevices').orderBy(FieldPath.documentId());
    const q = stringField(body, 'search', 40, true).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (q) query = query.where('searchPrefixes', 'array-contains', q);
    if (body.state && ['enabled', 'disabled', 'suspended', 'revoked'].includes(String(body.state))) query = query.where('state', '==', body.state);
    if (body.cursor) query = query.startAfter(idField(body, 'cursor'));
    const docs = (await query.limit(26).get()).docs;
    return { devices: docs.slice(0, 25).map(s => publicDevice(s.id, s.data())), nextCursor: docs.length > 25 ? docs[24].id : null };
  }
  if (action === 'claim' || action === 'preview') {
    const code = stringField(body, 'code', 6).toUpperCase();
    if (!/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(code)) throw new ApiError(400, 'Código de seis caracteres inválido.');
    const hash = codeHash(code, secret()), ref = db().collection('autoClickerPairings').doc(hash);
    if (action === 'preview') {
      const d = (await ref.get()).data();
      if (!d || (ms(d.expiresAt) ?? 0) <= Date.now()) throw new ApiError(404, 'Código inválido o vencido.');
      return { metadata: d.metadata, expiresAt: ms(d.expiresAt) };
    }
    const owner = stringField(body, 'owner', 120), alias = stringField(body, 'alias', 80, true);
    return db().runTransaction(async tx => {
      const p = (await tx.get(ref)).data();
      if (!p || (ms(p.expiresAt) ?? 0) <= Date.now()) throw new ApiError(409, 'Código vencido o consumido.');
      const deviceRef = db().collection('autoClickerDevices').doc(p.deviceId);
      const installRef = db().collection('autoClickerInstallations').doc(p.deviceId);
      const [device, install] = await Promise.all([tx.get(deviceRef), tx.get(installRef)]);
      if (device.exists || install.data()?.codeHash !== hash) throw new ApiError(409, 'La vinculación ya cambió.');
      const stamp = nowStamp();
      const data = { owner, alias, state: 'disabled', version: 1, publicKey: p.publicKey, metadata: p.metadata,
        expiresAt: null, createdAt: stamp, updatedAt: stamp, lastSeenAt: null, reportedState: null, leaseExpiresAt: null,
        sessionId: null, searchPrefixes: searchPrefixes(owner, alias, p.metadata.model, p.metadata.manufacturer) };
      tx.create(deviceRef, data); tx.delete(ref); tx.delete(installRef);
      tx.create(deviceRef.collection('audit').doc(), { action: 'claim', actor: actor.email, reason: 'Vinculación inicial; ejecución deshabilitada.', before: null, after: { owner, alias, state: 'disabled' }, createdAt: stamp });
      return { device: publicDevice(p.deviceId, data) };
    });
  }
  const id = idField(body), ref = db().collection('autoClickerDevices').doc(id);
  if (action === 'detail') {
    const doc = await ref.get();
    if (!doc.exists) throw new ApiError(404, 'Equipo no encontrado.');
    return { device: publicDevice(id, doc.data()!) };
  }
  if (action === 'audit') {
    let query = ref.collection('audit').orderBy('createdAt', 'desc').orderBy(FieldPath.documentId(), 'desc');
    if (body.cursor) {
      const cursor = stringField(body, 'cursor', 40);
      if (!/^[a-zA-Z0-9-]+$/.test(cursor)) throw new ApiError(400, 'Cursor inválido.');
      const snapshot = await ref.collection('audit').doc(cursor).get();
      if (!snapshot.exists) throw new ApiError(400, 'Cursor desconocido.');
      query = query.startAfter(snapshot);
    }
    const docs = (await query.limit(26).get()).docs;
    return { events: docs.slice(0, 25).map(s => ({ ...s.data(), id: s.id, createdAt: ms(s.data().createdAt) })), nextCursor: docs.length > 25 ? docs[24].id : null };
  }
  const version = Number(body.version);
  if (!Number.isSafeInteger(version) || version < 1) throw new ApiError(400, 'Versión inválida.');
  const operationId = stringField(body, 'operationId', 36);
  if (!/^[a-f0-9-]{36}$/.test(operationId)) throw new ApiError(400, 'Operación inválida.');
  const auditRef = ref.collection('audit').doc(operationId);
  const reason = action === 'authorize' ? stringField(body, 'reason', 500) : 'Edición de propietario/alias';
  const state = action === 'authorize' ? stringField(body, 'state', 20) : null;
  if (state && !['enabled', 'suspended', 'revoked'].includes(state)) throw new ApiError(400, 'Estado inválido.');
  const expires = body.expiresAt === null || body.expiresAt === undefined ? null : Number(body.expiresAt);
  if (state === 'enabled' && expires !== null && (!Number.isSafeInteger(expires) || expires <= Date.now() || expires > 253402300799999)) throw new ApiError(400, 'El vencimiento debe ser una fecha futura válida.');
  const edit = action === 'edit' ? { owner: stringField(body, 'owner', 120), alias: stringField(body, 'alias', 80, true) } : null;
  const fingerprint = sha256(JSON.stringify({ action, id, version, reason, state, expires, edit, actor: actor.email }));
  return db().runTransaction(async tx => {
    const [snapshot, audit] = await Promise.all([tx.get(ref), tx.get(auditRef)]);
    const d = snapshot.data();
    if (!d) throw new ApiError(404, 'Equipo no encontrado.');
    if (audit.exists) {
      if (audit.data()?.fingerprint !== fingerprint) throw new ApiError(409, 'Identificador de operación reutilizado.');
      return { device: publicDevice(id, d) };
    }
    if (d.version !== version) throw new ApiError(409, 'El equipo cambió. Actualiza antes de continuar.');
    if (d.state === 'revoked') throw new ApiError(409, 'Una identidad revocada no puede rehabilitarse.');
    const changes = edit ? { ...edit, searchPrefixes: searchPrefixes(edit.owner, edit.alias, d.metadata.model, d.metadata.manufacturer) } : {
      state, expiresAt: state === 'enabled' && expires !== null ? Timestamp.fromMillis(expires) : null, sessionId: null,
      // Keep the last issued lease deadline for honest dashboard acknowledgement.
    };
    const after: DocumentData = { ...d, ...changes, version: d.version + 1, updatedAt: nowStamp() };
    tx.update(ref, after);
    tx.create(auditRef, { action, actor: actor.email, reason, fingerprint, before: { owner: d.owner, alias: d.alias, state: d.state, expiresAt: ms(d.expiresAt) },
      after: { owner: after.owner, alias: after.alias, state: after.state, expiresAt: ms(after.expiresAt) }, createdAt: after.updatedAt });
    return { device: publicDevice(id, after) };
  });
}
