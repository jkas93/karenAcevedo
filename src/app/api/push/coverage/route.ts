import { NextResponse } from 'next/server';
import { getAdminServices } from '@/lib/firebase-admin';
import { apiErrorResponse, requireAdmin } from '@/lib/server/admin-auth';

export const runtime = 'nodejs';

const AUTHORIZED_ROLES = new Set([
  'administrador',
  'candidata',
  'digitador',
  'usuario',
]);

function isValidSubscription(data: FirebaseFirestore.DocumentData) {
  return (
    data.enabled === true &&
    typeof data.endpoint === 'string' &&
    data.endpoint.startsWith('https://') &&
    typeof data.keys?.p256dh === 'string' &&
    Boolean(data.keys.p256dh) &&
    typeof data.keys?.auth === 'string' &&
    Boolean(data.keys.auth)
  );
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const { adminDb } = getAdminServices();
    const [usersSnapshot, subscriptionsSnapshot] = await Promise.all([
      adminDb.collection('usuarios').get(),
      adminDb.collection('pushSubscriptions').where('enabled', '==', true).get(),
    ]);

    const authorizedEmails = new Set(
      usersSnapshot.docs
        .filter((userDoc) =>
          AUTHORIZED_ROLES.has(String(userDoc.data().rol || '')),
        )
        .map((userDoc) => userDoc.id.trim().toLowerCase()),
    );
    const validSubscriptions = subscriptionsSnapshot.docs.filter(
      (subscriptionDoc) => {
        const data = subscriptionDoc.data();
        const email = String(data.userEmail || '').trim().toLowerCase();
        return authorizedEmails.has(email) && isValidSubscription(data);
      },
    );
    const subscribedUsers = new Set(
      validSubscriptions.map((subscriptionDoc) =>
        String(subscriptionDoc.data().userEmail).trim().toLowerCase(),
      ),
    );

    return NextResponse.json({
      authorizedUsers: authorizedEmails.size,
      subscribedUsers: subscribedUsers.size,
      activeDevices: validSubscriptions.length,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
