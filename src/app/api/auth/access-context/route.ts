import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { SUPERUSER_EMAIL } from '@/lib/access-control';
import { getAdminServices } from '@/lib/firebase-admin';
import { apiErrorResponse, requireAuthenticatedUser } from '@/lib/server/admin-auth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const session = await requireAuthenticatedUser(request);

    if (session.email === SUPERUSER_EMAIL) {
      const { adminDb } = getAdminServices();
      const profileRef = adminDb.collection('usuarios').doc(session.email);
      const profile = await profileRef.get();
      if (profile.data()?.rol !== 'superusuario' || profile.data()?.protected !== true) {
        const batch = adminDb.batch();
        batch.set(profileRef, {
          rol: 'superusuario',
          protected: true,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        batch.set(adminDb.collection('accessAudit').doc(), {
          action: 'promote_canonical_superuser',
          target: session.email,
          actor: session.email,
          createdAt: FieldValue.serverTimestamp(),
        });
        await batch.commit();
      }
    }

    return NextResponse.json({
      role: session.role,
      name: session.name,
      email: session.email,
      permissions: session.permissions,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
