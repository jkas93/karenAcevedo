import { NextResponse } from 'next/server';
import { getAdminServices } from '@/lib/firebase-admin';
import {
  ApiError,
  apiErrorResponse,
  readJsonBody,
  requireAdmin,
} from '@/lib/server/admin-auth';

const VALID_ROLES = new Set(['administrador', 'candidata', 'digitador', 'usuario']);

export async function POST(request: Request) {
  try {
    const session = await requireAdmin(request);
    const body = await readJsonBody(request);
    const userEmail = typeof body.userEmail === 'string' ? body.userEmail.trim().toLowerCase() : '';
    const newRole = typeof body.newRole === 'string' ? body.newRole : '';

    if (!userEmail.endsWith('@fuerzaciudadana.pe')) {
      throw new ApiError(400, 'El usuario seleccionado no es valido.');
    }
    if (!VALID_ROLES.has(newRole)) {
      throw new ApiError(400, 'El rol seleccionado no es valido.');
    }
    if (session.email === userEmail && newRole !== 'administrador') {
      throw new ApiError(400, 'No puedes retirar tu propio rol de administrador.');
    }

    const { adminDb } = getAdminServices();
    const userRef = adminDb.collection('usuarios').doc(userEmail);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      throw new ApiError(404, 'El usuario no existe.');
    }

    await userRef.update({ rol: newRole });
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
