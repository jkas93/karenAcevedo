import 'server-only';

import type { DecodedIdToken } from 'firebase-admin/auth';
import { NextResponse } from 'next/server';
import { getAdminServices } from '@/lib/firebase-admin';
import {
  DEFAULT_ROLE_PERMISSIONS,
  SUPERUSER_EMAIL,
  effectiveRole,
  normalizePermissions,
  type PermissionKey,
  type RolePermissions,
  type UserRole,
} from '@/lib/access-control';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type AdminSession = {
  token: DecodedIdToken;
  email: string;
  role: 'superusuario' | 'administrador';
};

export async function requireAdmin(request: Request): Promise<AdminSession> {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    throw new ApiError(401, 'Debes iniciar sesion nuevamente.');
  }

  const idToken = authorization.slice('Bearer '.length).trim();
  if (!idToken) {
    throw new ApiError(401, 'Token de sesion ausente.');
  }

  const { adminAuth, adminDb } = getAdminServices();
  let token: DecodedIdToken;

  try {
    token = await adminAuth.verifyIdToken(idToken, true);
  } catch {
    throw new ApiError(401, 'La sesion vencio o fue revocada.');
  }

  const email = token.email?.trim().toLowerCase();
  if (!email) {
    throw new ApiError(403, 'La cuenta no tiene un correo valido.');
  }

  const profile = await adminDb.collection('usuarios').doc(email).get();
  const profileData = profile.data();

  const role = effectiveRole(email, profileData?.rol);
  if (!profile.exists || (role !== 'administrador' && role !== 'superusuario')) {
    throw new ApiError(403, 'Se requiere rol de administrador.');
  }

  if (profileData?.uid && profileData.uid !== token.uid) {
    throw new ApiError(403, 'La cuenta no coincide con el perfil autorizado.');
  }

  return { token, email, role };
}

export type AuthenticatedSession = {
  token: DecodedIdToken;
  email: string;
  role: UserRole;
  name: string;
  permissions: RolePermissions;
};

export async function requireAuthenticatedUser(
  request: Request,
): Promise<AuthenticatedSession> {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    throw new ApiError(401, 'Debes iniciar sesion nuevamente.');
  }

  const idToken = authorization.slice('Bearer '.length).trim();
  if (!idToken) {
    throw new ApiError(401, 'Token de sesion ausente.');
  }

  const { adminAuth, adminDb } = getAdminServices();
  let token: DecodedIdToken;

  try {
    token = await adminAuth.verifyIdToken(idToken, true);
  } catch {
    throw new ApiError(401, 'La sesion vencio o fue revocada.');
  }

  const email = token.email?.trim().toLowerCase();
  if (!email) throw new ApiError(403, 'La cuenta no tiene un correo valido.');

  const profile = await adminDb.collection('usuarios').doc(email).get();
  const profileData = profile.data();
  const role = effectiveRole(email, profileData?.rol);

  if (!profile.exists || !role) {
    throw new ApiError(403, 'La cuenta no tiene un perfil autorizado.');
  }
  if (profileData?.uid && profileData.uid !== token.uid) {
    throw new ApiError(403, 'La cuenta no coincide con el perfil autorizado.');
  }

  const permissions = role === 'superusuario'
    ? { ...DEFAULT_ROLE_PERMISSIONS.superusuario }
    : normalizePermissions(
        role,
        (await adminDb.collection('rolePermissions').doc(role).get()).data()?.permissions,
      );

  return {
    token,
    email,
    role,
    name: String(profileData?.nombre || token.name || email.split('@')[0]),
    permissions,
  };
}

export async function requirePermission(
  request: Request,
  permission: PermissionKey,
): Promise<AuthenticatedSession> {
  const session = await requireAuthenticatedUser(request);
  if (!session.permissions[permission]) {
    throw new ApiError(403, 'Tu rol no tiene permisos suficientes para esta operacion.');
  }
  return session;
}

export async function requireSuperuser(request: Request): Promise<AuthenticatedSession> {
  const session = await requireAuthenticatedUser(request);
  if (session.email !== SUPERUSER_EMAIL || session.role !== 'superusuario') {
    throw new ApiError(403, 'Esta operacion requiere Modo Dios.');
  }
  return session;
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    throw new ApiError(415, 'El contenido debe enviarse como JSON.');
  }

  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new ApiError(400, 'El cuerpo de la solicitud no es valido.');
    }
    return body as Record<string, unknown>;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, 'El cuerpo JSON no es valido.');
  }
}

export function apiErrorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  console.error('Error interno en API administrativa:', error);
  return NextResponse.json(
    { error: 'No se pudo completar la operacion. Intenta nuevamente.' },
    { status: 500 },
  );
}
