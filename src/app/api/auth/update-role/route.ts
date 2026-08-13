import { NextResponse } from 'next/server';
import { getAdminServices } from '@/lib/firebase-admin';
import { SUPERUSER_EMAIL, isAssignableRole } from '@/lib/access-control';
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
    const userEmail = typeof body.userEmail === 'string' ? body.userEmail.trim().toLowerCase() : '';
    const newRole = typeof body.newRole === 'string' ? body.newRole : '';

    if (!userEmail.endsWith('@fuerzaciudadana.pe')) {
      throw new ApiError(400, 'El usuario seleccionado no es valido.');
    }
    if (!isAssignableRole(newRole)) {
      throw new ApiError(400, 'El rol seleccionado no es valido.');
    }
    if (userEmail === SUPERUSER_EMAIL) {
      throw new ApiError(403, 'La cuenta Modo Dios es protegida y su rol no puede modificarse.');
    }
    if (session.email === userEmail) {
      throw new ApiError(400, 'No puedes modificar tu propio rol.');
    }

    const { adminDb } = getAdminServices();
    const userRef = adminDb.collection('usuarios').doc(userEmail);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      throw new ApiError(404, 'El usuario no existe.');
    }
    if (userDoc.data()?.rol === 'superusuario') {
      throw new ApiError(403, 'Una cuenta protegida no puede modificarse.');
    }

    await userRef.update({ rol: newRole });
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
