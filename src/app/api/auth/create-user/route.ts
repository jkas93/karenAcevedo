import { Timestamp } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { getAdminServices } from '@/lib/firebase-admin';
import { SUPERUSER_DNI, isAssignableRole } from '@/lib/access-control';
import {
  ApiError,
  apiErrorResponse,
  readJsonBody,
  requirePermission,
} from '@/lib/server/admin-auth';

export async function POST(request: Request) {
  let createdUid: string | null = null;

  try {
    await requirePermission(request, 'users.manage');
    const body = await readJsonBody(request);
    const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : '';
    const dni = typeof body.dni === 'string' ? body.dni.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const rol = typeof body.rol === 'string' ? body.rol : '';
    const telefono = typeof body.telefono === 'string' ? body.telefono.trim() : '';

    if (nombre.length < 2 || nombre.length > 100) {
      throw new ApiError(400, 'El nombre debe tener entre 2 y 100 caracteres.');
    }
    if (!/^\d{8}$/.test(dni)) {
      throw new ApiError(400, 'El DNI debe contener exactamente 8 digitos.');
    }
    if (dni === SUPERUSER_DNI) {
      throw new ApiError(409, 'La cuenta Modo Dios ya esta reservada y no puede recrearse.');
    }
    if (password.length < 8 || password.length > 128) {
      throw new ApiError(400, 'La contrasena debe tener entre 8 y 128 caracteres.');
    }
    if (!isAssignableRole(rol)) {
      throw new ApiError(400, 'El rol seleccionado no es valido.');
    }
    if (telefono && !/^\d{9,15}$/.test(telefono)) {
      throw new ApiError(400, 'El telefono debe contener entre 9 y 15 digitos.');
    }

    const email = `${dni}@fuerzaciudadana.pe`;
    const { adminAuth, adminDb } = getAdminServices();

    try {
      await adminAuth.getUserByEmail(email);
      throw new ApiError(409, 'Este DNI ya tiene un usuario registrado.');
    } catch (error) {
      if (error instanceof ApiError) throw error;
      const authError = error as { code?: string };
      if (authError.code !== 'auth/user-not-found') throw error;
    }

    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: nombre,
      emailVerified: true,
      disabled: false,
    });
    createdUid = userRecord.uid;

    try {
      await adminDb.collection('usuarios').doc(email).set({
        uid: userRecord.uid,
        nombre,
        dni,
        telefono: telefono || null,
        correo: email,
        rol,
        fecha_creacion: Timestamp.now(),
      });
    } catch (error) {
      await adminAuth.deleteUser(userRecord.uid).catch(() => undefined);
      createdUid = null;
      throw error;
    }

    return NextResponse.json({ success: true, uid: userRecord.uid }, { status: 201 });
  } catch (error) {
    if (createdUid) {
      const { adminAuth } = getAdminServices();
      await adminAuth.deleteUser(createdUid).catch(() => undefined);
    }
    return apiErrorResponse(error);
  }
}
