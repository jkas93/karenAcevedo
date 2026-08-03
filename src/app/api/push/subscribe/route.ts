import { createHash } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { getAdminServices } from '@/lib/firebase-admin';
import {
  ApiError,
  apiErrorResponse,
  readJsonBody,
  requireAuthenticatedUser,
} from '@/lib/server/admin-auth';

function readSubscription(body: Record<string, unknown>) {
  const subscription = body.subscription;
  if (!subscription || typeof subscription !== 'object' || Array.isArray(subscription)) {
    throw new ApiError(400, 'La suscripcion no es valida.');
  }

  const value = subscription as Record<string, unknown>;
  const keys = value.keys;
  const endpoint = typeof value.endpoint === 'string' ? value.endpoint.trim() : '';
  if (!endpoint.startsWith('https://') || endpoint.length > 2048) {
    throw new ApiError(400, 'El endpoint de notificaciones no es valido.');
  }
  if (!keys || typeof keys !== 'object' || Array.isArray(keys)) {
    throw new ApiError(400, 'Las claves de la suscripcion no son validas.');
  }

  const keyMap = keys as Record<string, unknown>;
  const p256dh = typeof keyMap.p256dh === 'string' ? keyMap.p256dh : '';
  const auth = typeof keyMap.auth === 'string' ? keyMap.auth : '';
  if (!p256dh || !auth || p256dh.length > 512 || auth.length > 512) {
    throw new ApiError(400, 'Las claves de la suscripcion estan incompletas.');
  }

  const expirationTime =
    typeof value.expirationTime === 'number' ? value.expirationTime : null;
  return { endpoint, expirationTime, keys: { p256dh, auth } };
}

export async function POST(request: Request) {
  try {
    const session = await requireAuthenticatedUser(request);
    const body = await readJsonBody(request);
    const subscription = readSubscription(body);
    const subscriptionId = createHash('sha256')
      .update(subscription.endpoint)
      .digest('hex');
    const { adminDb } = getAdminServices();

    await adminDb.collection('pushSubscriptions').doc(subscriptionId).set(
      {
        ...subscription,
        uid: session.token.uid,
        userEmail: session.email,
        userName: session.name,
        role: session.role,
        userAgent: (request.headers.get('user-agent') || '').slice(0, 300),
        enabled: true,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

