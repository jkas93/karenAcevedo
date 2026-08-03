import { NextResponse } from 'next/server';
import { getAdminServices } from '@/lib/firebase-admin';
import {
  ApiError,
  apiErrorResponse,
  readJsonBody,
  requireAdmin,
} from '@/lib/server/admin-auth';

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
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
    const targetUid = uid || (await adminAuth.getUserByEmail(userEmail)).uid;
    await adminAuth.updateUser(targetUid, { password: newPassword });

    return NextResponse.json({
      success: true,
      message: 'Contraseña actualizada correctamente.',
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
