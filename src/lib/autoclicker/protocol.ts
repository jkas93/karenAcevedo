import { createHash, createHmac, createPublicKey, randomInt, verify } from 'node:crypto';

export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const LEASE_MS = 30_000;
export const PAIRING_MS = 600_000;
export const CHALLENGE_MS = 60_000;
export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
export function pairingCode() {
  return Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
}
export function codeHash(code: string, secret: string) {
  return createHmac('sha256', secret).update(code.trim().toUpperCase()).digest('hex');
}
export function canonical(challengeId: string, nonce: string, payload: string) {
  return `karen-autoclicker-v1\n${challengeId}\n${nonce}\n${sha256(payload)}`;
}
export function parseKey(encoded: string) {
  const key = createPublicKey({ key: Buffer.from(encoded, 'base64'), type: 'spki', format: 'der' });
  if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') throw new Error('Se requiere clave EC P-256.');
  const publicKey = key.export({ type: 'spki', format: 'der' }).toString('base64');
  return { key, publicKey, deviceId: sha256(publicKey) };
}
export function validSignature(publicKey: string, message: string, signature: string) {
  try { return verify('sha256', Buffer.from(message), parseKey(publicKey).key, Buffer.from(signature, 'base64')); }
  catch { return false; }
}
export function leaseDuration(state: string, expiresAt: number | null, now: number) {
  if (state !== 'enabled' || (expiresAt !== null && expiresAt <= now)) return 0;
  return Math.max(0, Math.min(LEASE_MS, expiresAt === null ? LEASE_MS : expiresAt - now));
}
export function searchPrefixes(...values: string[]) {
  return [...new Set(values.flatMap(v => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/\s+/))
    .filter(Boolean).flatMap(v => Array.from({ length: Math.min(v.length, 40) }, (_, i) => v.slice(0, i + 1))))].slice(0, 240);
}

