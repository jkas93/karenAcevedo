import { randomBytes } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { getAdminServices } from '@/lib/firebase-admin';
import {
  ApiError,
  apiErrorResponse,
  readJsonBody,
  requireAdmin,
} from '@/lib/server/admin-auth';
import { hashValue, TEAM_INTAKE_CONFIG_PATH } from '@/lib/server/team-intake';

export const runtime = 'nodejs';

function newToken() {
  return randomBytes(32).toString('base64url');
}

export async function POST(request: Request) {
  try {
    const session = await requireAdmin(request);
    const body = await readJsonBody(request);
    const action = typeof body.action === 'string' ? body.action : 'get';
    const { adminDb } = getAdminServices();
    const configRef = adminDb.doc(TEAM_INTAKE_CONFIG_PATH);

    if (action === 'get') {
      const current = await configRef.get();
      if (current.exists) {
        const data = current.data()!;
        return NextResponse.json({
          token: String(data.token || ''),
          active: data.active === true,
          version: Number(data.version || 1),
          submissions: Number(data.submissions || 0),
        });
      }

      const token = newToken();
      await configRef.set({
        token,
        tokenHash: hashValue(token),
        active: true,
        version: 1,
        submissions: 0,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: session.email,
      });
      return NextResponse.json({ token, active: true, version: 1, submissions: 0 });
    }

    if (action === 'regenerate') {
      const token = newToken();
      const current = await configRef.get();
      const version = Number(current.data()?.version || 0) + 1;
      await configRef.set(
        {
          token,
          tokenHash: hashValue(token),
          active: true,
          version,
          submissions: Number(current.data()?.submissions || 0),
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: session.email,
          ...(current.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
        },
        { merge: true },
      );
      return NextResponse.json({
        token,
        active: true,
        version,
        submissions: Number(current.data()?.submissions || 0),
      });
    }

    if (action === 'set-active') {
      if (typeof body.active !== 'boolean') {
        throw new ApiError(400, 'El estado del enlace no es válido.');
      }
      const current = await configRef.get();
      if (!current.exists) throw new ApiError(404, 'Primero genera el enlace.');
      await configRef.update({
        active: body.active,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: session.email,
      });
      const data = current.data()!;
      return NextResponse.json({
        token: String(data.token || ''),
        active: body.active,
        version: Number(data.version || 1),
        submissions: Number(data.submissions || 0),
      });
    }

    throw new ApiError(400, 'La acción solicitada no es válida.');
  } catch (error) {
    return apiErrorResponse(error);
  }
}
