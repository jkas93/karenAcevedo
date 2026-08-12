import 'server-only';

import { createHash, timingSafeEqual } from 'node:crypto';
import { getAdminServices } from '@/lib/firebase-admin';

export const TEAM_INTAKE_CONFIG_PATH = 'teamIntakeConfig/current';

export function hashValue(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export function normalizeInvitationToken(token: string) {
  return token.trim();
}

export function isSafeInvitationToken(token: string) {
  return /^[A-Za-z0-9_-]{32,128}$/.test(token);
}

export async function getTeamInvitation(token: string) {
  const normalized = normalizeInvitationToken(token);
  if (!isSafeInvitationToken(normalized)) return null;

  const { adminDb } = getAdminServices();
  const snapshot = await adminDb.doc(TEAM_INTAKE_CONFIG_PATH).get();
  const data = snapshot.data();
  if (!snapshot.exists || data?.active !== true || typeof data.tokenHash !== 'string') {
    return null;
  }

  const received = Buffer.from(hashValue(normalized), 'hex');
  const expected = Buffer.from(data.tokenHash, 'hex');
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return null;
  }

  return { version: Number(data.version || 1) };
}
