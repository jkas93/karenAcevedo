import { NextResponse } from 'next/server';
import { getAdminServices } from '@/lib/firebase-admin';
import { SUPERUSER_EMAIL } from '@/lib/access-control';
import {
  ApiError,
  apiErrorResponse,
  readJsonBody,
  requirePermission,
} from '@/lib/server/admin-auth';

export async function POST(request: Request) {
  try {
    const session = await requirePermission(request, 'users.manage');
    const body = await readJsonBody(request);
    const uid = typeof body.uid === 'string' ? body.uid.trim() : '';
    const userEmail =
      typeof body.userEmail === 'string' ? body.userEmail.trim().toLowerCase() : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

    if (!uid && !userEmail) {
      throw new ApiError(400, 'Debes seleccionar un usuario.');
    }
    if (newPassword.length < 8 || newPassword.length > 128) {
      throw new ApiError(400, 'La contraseña debe tener entre 8 y 128 caracteres.');
    }

    const { adminAuth } = getAdminServices();
    const targetUser = uid ? await adminAuth.getUser(uid) : await adminAuth.getUserByEmail(userEmail);
    const targetEmail = targetUser.email?.trim().toLowerCase();
    if (targetEmail === SUPERUSER_EMAIL && session.email !== SUPERUSER_EMAIL) {
      throw new ApiError(403, 'Solo el propio Modo Dios puede cambiar su contrasena.');
    }
    const targetUid = targetUser.uid;
    await adminAuth.updateUser(targetUid, { password: newPassword });

    return NextResponse.json({
      success: true,
      message: 'Contraseña actualizada correctamente.',
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
