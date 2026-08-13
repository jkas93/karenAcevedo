import { NextResponse } from 'next/server';
import { getAdminServices } from '@/lib/firebase-admin';
import { apiErrorResponse, requirePermission } from '@/lib/server/admin-auth';
import { SUPERUSER_EMAIL, isUserRole } from '@/lib/access-control';

export const runtime = 'nodejs';

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
    await requirePermission(request, 'users.view');
    const { adminDb } = getAdminServices();
    const [usersSnapshot, subscriptionsSnapshot] = await Promise.all([
      adminDb.collection('usuarios').get(),
      adminDb.collection('pushSubscriptions').where('enabled', '==', true).get(),
    ]);

    const authorizedEmails = new Set(
      usersSnapshot.docs
        .filter((userDoc) => {
          const role = userDoc.data().rol;
          return isUserRole(role)
            && (role !== 'superusuario' || userDoc.id.toLowerCase() === SUPERUSER_EMAIL);
        })
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
