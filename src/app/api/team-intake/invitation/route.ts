import { randomBytes } from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { getAdminServices } from '@/lib/firebase-admin';
import { ApiError, apiErrorResponse, readJsonBody, requireAdmin } from '@/lib/server/admin-auth';
import { hashValue, TEAM_INTAKE_CONFIG_PATH } from '@/lib/server/team-intake';

export const runtime = 'nodejs';

const INVITATION_DAYS = 30;
const newToken = () => randomBytes(32).toString('base64url');
const newExpiry = () => Timestamp.fromMillis(Date.now() + INVITATION_DAYS * 24 * 60 * 60 * 1000);

function responseData(data: FirebaseFirestore.DocumentData, activeOverride?: boolean) {
  const expiresAt = data.expiresAt instanceof Timestamp ? data.expiresAt : newExpiry();
  return {
    token: String(data.token || ''),
    active: activeOverride ?? (data.active === true && expiresAt.toMillis() > Date.now()),
    version: Number(data.version || 1),
    submissions: Number(data.submissions || 0),
    expiresAt: expiresAt.toDate().toISOString(),
  };
}

export async function POST(request: Request) {
  try {
    const session = await requireAdmin(request);
    const body = await readJsonBody(request);
    const action = typeof body.action === 'string' ? body.action : 'get';
    const { adminDb } = getAdminServices();
    const configRef = adminDb.doc(TEAM_INTAKE_CONFIG_PATH);
    const current = await configRef.get();

    if (action === 'get') {
      if (current.exists) {
        const data = current.data()!;
        if (!(data.expiresAt instanceof Timestamp)) {
          const expiresAt = newExpiry();
          await configRef.update({ expiresAt, updatedAt: FieldValue.serverTimestamp(), updatedBy: session.email });
          return NextResponse.json(responseData({ ...data, expiresAt }));
        }
        if (data.active === true && data.expiresAt.toMillis() <= Date.now()) {
          await configRef.update({ active: false, updatedAt: FieldValue.serverTimestamp(), updatedBy: session.email });
          return NextResponse.json(responseData(data, false));
        }
        return NextResponse.json(responseData(data));
      }

      const token = newToken();
      const expiresAt = newExpiry();
      const data = { token, tokenHash: hashValue(token), active: true, version: 1, submissions: 0, expiresAt };
      await configRef.set({
        ...data,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: session.email,
      });
      return NextResponse.json(responseData(data));
    }

    if (action === 'regenerate') {
      const token = newToken();
      const expiresAt = newExpiry();
      const data = {
        token,
        tokenHash: hashValue(token),
        active: true,
        version: Number(current.data()?.version || 0) + 1,
        submissions: Number(current.data()?.submissions || 0),
        expiresAt,
      };
      await configRef.set({
        ...data,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: session.email,
        ...(current.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
      }, { merge: true });
      return NextResponse.json(responseData(data));
    }

    if (action === 'set-active') {
      if (typeof body.active !== 'boolean') throw new ApiError(400, 'El estado del enlace no es válido.');
      if (!current.exists) throw new ApiError(404, 'Primero genera el enlace.');
      const data = current.data()!;
      const expiresAt = body.active && (!(data.expiresAt instanceof Timestamp) || data.expiresAt.toMillis() <= Date.now())
        ? newExpiry()
        : data.expiresAt;
      await configRef.update({
        active: body.active,
        expiresAt,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: session.email,
      });
      return NextResponse.json(responseData({ ...data, active: body.active, expiresAt }, body.active));
    }

    throw new ApiError(400, 'La acción solicitada no es válida.');
  } catch (error) {
    return apiErrorResponse(error);
  }
}
