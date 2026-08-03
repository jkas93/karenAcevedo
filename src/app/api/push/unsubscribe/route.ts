import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getAdminServices } from '@/lib/firebase-admin';
import {
  ApiError,
  apiErrorResponse,
  readJsonBody,
  requireAuthenticatedUser,
} from '@/lib/server/admin-auth';

export async function POST(request: Request) {
  try {
    const session = await requireAuthenticatedUser(request);
    const body = await readJsonBody(request);
    const endpoint = typeof body.endpoint === 'string' ? body.endpoint.trim() : '';
    if (!endpoint.startsWith('https://') || endpoint.length > 2048) {
      throw new ApiError(400, 'El endpoint de notificaciones no es valido.');
    }

    const subscriptionId = createHash('sha256').update(endpoint).digest('hex');
    const { adminDb } = getAdminServices();
    const subscriptionRef = adminDb.collection('pushSubscriptions').doc(subscriptionId);
    const subscription = await subscriptionRef.get();

    if (!subscription.exists) {
      return NextResponse.json({ success: true });
    }

    const ownerUid = subscription.data()?.uid;
    if (ownerUid !== session.token.uid && session.role !== 'administrador') {
      throw new ApiError(403, 'No puedes retirar la suscripcion de otro usuario.');
    }

    await subscriptionRef.delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
