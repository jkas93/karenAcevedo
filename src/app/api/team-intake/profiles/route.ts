import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { getAdminServices } from '@/lib/firebase-admin';
import { ApiError, apiErrorResponse, readJsonBody, requireAdmin } from '@/lib/server/admin-auth';
import { TEAM_PROFILE_STATUSES } from '@/lib/team-intake-types';

export const runtime = 'nodejs';

const PAGE_SIZE = 200;
const validId = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

function serialize(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, serialize(item)]));
  }
  return value;
}

export async function POST(request: Request) {
  try {
    const session = await requireAdmin(request);
    const body = await readJsonBody(request);
    const action = typeof body.action === 'string' ? body.action : 'list';
    const { adminDb } = getAdminServices();

    if (action === 'list') {
      const cursor = body.cursor;
      let profilesQuery = adminDb.collection('teamProfiles').orderBy('fechaRegistro', 'desc').limit(PAGE_SIZE + 1);
      if (cursor) {
        if (!validId(cursor)) throw new ApiError(400, 'El cursor de paginación no es válido.');
        const cursorSnapshot = await adminDb.collection('teamProfiles').doc(cursor).get();
        if (!cursorSnapshot.exists) throw new ApiError(400, 'La página solicitada ya no está disponible.');
        profilesQuery = profilesQuery.startAfter(cursorSnapshot);
      }
      const snapshot = await profilesQuery.get();
      const hasMore = snapshot.docs.length > PAGE_SIZE;
      const page = snapshot.docs.slice(0, PAGE_SIZE);
      return NextResponse.json({
        profiles: page.map((profileDoc) => ({
          id: profileDoc.id,
          ...(serialize(profileDoc.data()) as Record<string, unknown>),
        })),
        nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
      });
    }

    const id = body.id;
    if (!validId(id)) throw new ApiError(400, 'La ficha no es válida.');
    const ref = adminDb.collection('teamProfiles').doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists) throw new ApiError(404, 'La ficha no existe.');

    if (action === 'status') {
      const status = typeof body.status === 'string' ? body.status : '';
      if (!TEAM_PROFILE_STATUSES.includes(status as never)) throw new ApiError(400, 'El estado no es válido.');
      const previousStatus = String(snapshot.data()?.estado || '');
      const batch = adminDb.batch();
      batch.update(ref, { estado: status, updatedAt: FieldValue.serverTimestamp(), updatedBy: session.email });
      batch.set(adminDb.collection('teamProfileAudit').doc(), {
        action: 'status',
        profileId: id,
        previousStatus,
        nextStatus: status,
        actor: session.email,
        createdAt: FieldValue.serverTimestamp(),
      });
      await batch.commit();
      return NextResponse.json({ success: true });
    }

    if (action === 'delete') {
      const batch = adminDb.batch();
      batch.delete(ref);
      batch.set(adminDb.collection('teamProfileAudit').doc(), {
        action: 'delete',
        profileId: id,
        actor: session.email,
        createdAt: FieldValue.serverTimestamp(),
      });
      await batch.commit();
      return NextResponse.json({ success: true });
    }

    throw new ApiError(400, 'La acción solicitada no es válida.');
  } catch (error) {
    return apiErrorResponse(error);
  }
}
