import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import {
  ASSIGNABLE_ROLES,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_KEYS,
  isAssignableRole,
  normalizePermissions,
} from '@/lib/access-control';
import { getAdminServices } from '@/lib/firebase-admin';
import {
  ApiError,
  apiErrorResponse,
  readJsonBody,
  requireSuperuser,
} from '@/lib/server/admin-auth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const session = await requireSuperuser(request);
    const body = await readJsonBody(request);
    const action = typeof body.action === 'string' ? body.action : 'get';
    const { adminDb } = getAdminServices();

    if (action === 'get') {
      const snapshots = await Promise.all(
        ASSIGNABLE_ROLES.map((role) => adminDb.collection('rolePermissions').doc(role).get()),
      );
      return NextResponse.json({
        roles: Object.fromEntries(ASSIGNABLE_ROLES.map((role, index) => [
          role,
          normalizePermissions(role, snapshots[index].data()?.permissions),
        ])),
      });
    }

    if (action === 'reset') {
      const batch = adminDb.batch();
      ASSIGNABLE_ROLES.forEach((role) => {
        batch.set(adminDb.collection('rolePermissions').doc(role), {
          permissions: DEFAULT_ROLE_PERMISSIONS[role],
          updatedBy: session.email,
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
      batch.set(adminDb.collection('accessAudit').doc(), {
        action: 'reset_role_permissions',
        actor: session.email,
        createdAt: FieldValue.serverTimestamp(),
      });
      await batch.commit();
      return NextResponse.json({ success: true });
    }

    if (action === 'update') {
      const role = body.role;
      if (!isAssignableRole(role)) throw new ApiError(400, 'El rol seleccionado no es valido.');
      if (!body.permissions || typeof body.permissions !== 'object' || Array.isArray(body.permissions)) {
        throw new ApiError(400, 'La matriz de permisos no es valida.');
      }
      const raw = body.permissions as Record<string, unknown>;
      if (Object.keys(raw).some((key) => !PERMISSION_KEYS.includes(key as never))) {
        throw new ApiError(400, 'La matriz contiene permisos desconocidos.');
      }
      const permissions = normalizePermissions(role, raw);
      const batch = adminDb.batch();
      batch.set(adminDb.collection('rolePermissions').doc(role), {
        permissions,
        updatedBy: session.email,
        updatedAt: FieldValue.serverTimestamp(),
      });
      batch.set(adminDb.collection('accessAudit').doc(), {
        action: 'update_role_permissions',
        role,
        permissions,
        actor: session.email,
        createdAt: FieldValue.serverTimestamp(),
      });
      await batch.commit();
      return NextResponse.json({ success: true, permissions });
    }

    throw new ApiError(400, 'La accion solicitada no es valida.');
  } catch (error) {
    return apiErrorResponse(error);
  }
}
