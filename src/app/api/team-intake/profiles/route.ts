import { Timestamp } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { getAdminServices } from '@/lib/firebase-admin';
import {
  ApiError,
  apiErrorResponse,
  readJsonBody,
  requireAdmin,
} from '@/lib/server/admin-auth';
import { TEAM_PROFILE_STATUSES } from '@/lib/team-intake-types';

export const runtime = 'nodejs';

function serialize(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, serialize(item)]),
    );
  }
  return value;
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const body = await readJsonBody(request);
    const action = typeof body.action === 'string' ? body.action : 'list';
    const { adminDb } = getAdminServices();

    if (action === 'list') {
      const snapshot = await adminDb
        .collection('teamProfiles')
        .orderBy('fechaRegistro', 'desc')
        .limit(1000)
        .get();
      return NextResponse.json({
        profiles: snapshot.docs.map((profileDoc) => ({
          id: profileDoc.id,
          ...(serialize(profileDoc.data()) as Record<string, unknown>),
        })),
      });
    }

    if (action === 'status') {
      const id = typeof body.id === 'string' ? body.id : '';
      const status = typeof body.status === 'string' ? body.status : '';
      if (!/^[a-f0-9]{64}$/.test(id)) throw new ApiError(400, 'La ficha no es válida.');
      if (!TEAM_PROFILE_STATUSES.includes(status as never)) throw new ApiError(400, 'El estado no es válido.');
      const ref = adminDb.collection('teamProfiles').doc(id);
      if (!(await ref.get()).exists) throw new ApiError(404, 'La ficha no existe.');
      await ref.update({ estado: status, updatedAt: Timestamp.now() });
      return NextResponse.json({ success: true });
    }

    throw new ApiError(400, 'La acción solicitada no es válida.');
  } catch (error) {
    return apiErrorResponse(error);
  }
}
