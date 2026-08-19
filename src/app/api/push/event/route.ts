import { createHash, timingSafeEqual } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { getAdminServices } from '@/lib/firebase-admin';
import { ApiError, apiErrorResponse, readJsonBody } from '@/lib/server/admin-auth';

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);
    const eventId = typeof body.eventId === 'string' ? body.eventId : '';
    const token = typeof body.clickToken === 'string' ? body.clickToken : '';
    if (!/^[a-f0-9]{64}$/.test(eventId) || !/^[0-9a-f-]{36}$/i.test(token)) {
      throw new ApiError(400, 'Evento no valido.');
    }
    const { adminDb } = getAdminServices();
    const ref = adminDb.collection('notificationDeviceEvents').doc(eventId);
    await adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      const expectedHex = snapshot.data()?.clickTokenHash;
      if (!snapshot.exists || typeof expectedHex !== 'string' || !/^[a-f0-9]{64}$/.test(expectedHex)) return;
      const actual = Buffer.from(createHash('sha256').update(token).digest('hex'), 'hex');
      const expected = Buffer.from(expectedHex, 'hex');
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return;
      transaction.set(ref, {
        status: 'clicked', clickedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), clickTokenHash: FieldValue.delete(),
      }, { merge: true });
    });
    return NextResponse.json({ accepted: true }, { status: 202 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
