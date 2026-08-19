import { createHash } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { getAdminServices } from '@/lib/firebase-admin';
import {
  isStrictNotificationPreferences,
  normalizeNotificationPreferences,
} from '@/lib/pwa/notification-preferences';
import { ApiError, apiErrorResponse, readJsonBody, requirePermission } from '@/lib/server/admin-auth';

function endpointFrom(body: Record<string, unknown>) {
  const endpoint = typeof body.endpoint === 'string' ? body.endpoint.trim() : '';
  if (!endpoint.startsWith('https://') || endpoint.length > 2048) {
    throw new ApiError(400, 'El endpoint de notificaciones no es valido.');
  }
  return endpoint;
}

export async function POST(request: Request) {
  try {
    const session = await requirePermission(request, 'calendar.view');
    const body = await readJsonBody(request);
    const endpoint = endpointFrom(body);
    const action = body.action;
    if (action !== 'get' && action !== 'update') throw new ApiError(400, 'Accion no valida.');
    const id = createHash('sha256').update(endpoint).digest('hex');
    const { adminDb } = getAdminServices();
    const ref = adminDb.collection('pushSubscriptions').doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists || snapshot.data()?.uid !== session.token.uid) {
      throw new ApiError(404, 'La suscripcion de este dispositivo no existe.');
    }
    if (action === 'get') {
      return NextResponse.json({ preferences: normalizeNotificationPreferences(snapshot.data()?.preferences) });
    }
    if (!isStrictNotificationPreferences(body.preferences)) {
      throw new ApiError(400, 'Las preferencias no son validas.');
    }
    const preferences = normalizeNotificationPreferences(body.preferences);
    await ref.set({ preferences, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return NextResponse.json({ success: true, preferences });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
