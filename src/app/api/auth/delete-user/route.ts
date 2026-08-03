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
    const session = await requireAdmin(request);
    const body = await readJsonBody(request);
    const uid = typeof body.uid === 'string' ? body.uid.trim() : '';
    const userEmail =
      typeof body.userEmail === 'string' ? body.userEmail.trim().toLowerCase() : '';

    if (!uid && !userEmail) {
      throw new ApiError(400, 'Debes seleccionar un usuario.');
    }

    const { adminAuth, adminDb } = getAdminServices();
    let targetUser;
    try {
      targetUser = uid
        ? await adminAuth.getUser(uid)
        : await adminAuth.getUserByEmail(userEmail);
    } catch (error) {
      const authError = error as { code?: string };
      if (authError.code === 'auth/user-not-found') {
        throw new ApiError(404, 'El usuario no existe en Firebase Auth.');
      }
      throw error;
    }

    if (targetUser.uid === session.token.uid) {
      throw new ApiError(400, 'No puedes eliminar tu propia cuenta.');
    }

    const profileEmail = (targetUser.email || userEmail).toLowerCase();
    if (!profileEmail) {
      throw new ApiError(400, 'El usuario no tiene un correo asociado.');
    }

    const profileRef = adminDb.collection('usuarios').doc(profileEmail);
    const profileDoc = await profileRef.get();
    if (profileDoc.data()?.rol === 'administrador') {
      const admins = await adminDb
        .collection('usuarios')
        .where('rol', '==', 'administrador')
        .limit(2)
        .get();
      if (admins.size <= 1) {
        throw new ApiError(400, 'No se puede eliminar al último administrador.');
      }
    }

    await adminAuth.deleteUser(targetUser.uid);
    await profileRef.delete();

    return NextResponse.json({
      success: true,
      message: 'Usuario eliminado correctamente.',
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
