export const SUPERUSER_DNI = '71260540';
export const SUPERUSER_EMAIL = `${SUPERUSER_DNI}@fuerzaciudadana.pe`;

export const USER_ROLES = [
  'superusuario',
  'administrador',
  'candidata',
  'digitador',
  'usuario',
] as const;

export const ASSIGNABLE_ROLES = [
  'administrador',
  'candidata',
  'digitador',
  'usuario',
] as const;

export type UserRole = (typeof USER_ROLES)[number];
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export const PERMISSION_KEYS = [
  'calendar.view',
  'calendar.manage',
  'volunteers.view',
  'volunteers.manage',
  'electoral.view',
  'electoral.manage',
  'actas.view',
  'actas.manage',
  'teamProfiles.view',
  'teamProfiles.manage',
  'settings.view',
  'settings.manage',
  'users.view',
  'users.manage',
  'roles.manage',
  'devices.view',
  'devices.manage',
  'devices.authorize',
  'devices.audit',
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];
export type RolePermissions = Record<PermissionKey, boolean>;

const none = (): RolePermissions => Object.fromEntries(
  PERMISSION_KEYS.map((permission) => [permission, false]),
) as RolePermissions;

function withPermissions(...permissions: PermissionKey[]): RolePermissions {
  const result = none();
  permissions.forEach((permission) => { result[permission] = true; });
  return result;
}

export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  superusuario: withPermissions(...PERMISSION_KEYS),
  administrador: withPermissions(
    'calendar.view', 'calendar.manage',
    'volunteers.view', 'volunteers.manage',
    'electoral.view', 'electoral.manage',
    'actas.view', 'actas.manage',
    'teamProfiles.view', 'teamProfiles.manage',
    'settings.view', 'settings.manage',
    'users.view', 'users.manage',
  ),
  candidata: withPermissions(
    'calendar.view', 'calendar.manage',
    'volunteers.view', 'volunteers.manage',
    'electoral.view',
  ),
  digitador: withPermissions('calendar.view', 'actas.view', 'actas.manage'),
  usuario: withPermissions('calendar.view', 'volunteers.view', 'volunteers.manage'),
};

export const ROLE_LABELS: Record<UserRole, string> = {
  superusuario: 'Modo Dios',
  administrador: 'Administrador',
  candidata: 'Candidata',
  digitador: 'Digitador',
  usuario: 'Usuario',
};

export const PERMISSION_MODULES = [
  { id: 'devices', label: 'Dispositivos Auto Clicker', view: 'devices.view', manage: 'devices.manage' },
  { id: 'calendar', label: 'Calendario operativo', view: 'calendar.view', manage: 'calendar.manage' },
  { id: 'volunteers', label: 'Voluntarios', view: 'volunteers.view', manage: 'volunteers.manage' },
  { id: 'electoral', label: 'Control electoral', view: 'electoral.view', manage: 'electoral.manage' },
  { id: 'actas', label: 'Ingreso de actas', view: 'actas.view', manage: 'actas.manage' },
  { id: 'teamProfiles', label: 'Fichas del equipo', view: 'teamProfiles.view', manage: 'teamProfiles.manage' },
  { id: 'settings', label: 'Configuración', view: 'settings.view', manage: 'settings.manage' },
  { id: 'users', label: 'Gestión de accesos', view: 'users.view', manage: 'users.manage' },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  view: PermissionKey;
  manage: PermissionKey;
}>;

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && USER_ROLES.includes(value as UserRole);
}

export function isAssignableRole(value: unknown): value is AssignableRole {
  return typeof value === 'string' && ASSIGNABLE_ROLES.includes(value as AssignableRole);
}

export function effectiveRole(email: string, storedRole: unknown): UserRole | null {
  if (email.trim().toLowerCase() === SUPERUSER_EMAIL) return 'superusuario';
  return isUserRole(storedRole) && storedRole !== 'superusuario' ? storedRole : null;
}

export function normalizePermissions(role: UserRole, value: unknown): RolePermissions {
  if (role === 'superusuario') return { ...DEFAULT_ROLE_PERMISSIONS.superusuario };
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const normalized = Object.fromEntries(PERMISSION_KEYS.map((permission) => [
    permission,
    typeof source[permission] === 'boolean'
      ? source[permission]
      : DEFAULT_ROLE_PERMISSIONS[role][permission],
  ])) as RolePermissions;

  PERMISSION_MODULES.forEach((module) => {
    if (!normalized[module.view]) normalized[module.manage] = false;
    if (normalized[module.manage]) normalized[module.view] = true;
  });
  normalized['roles.manage'] = false;
  if (!normalized['devices.view']) {
    normalized['devices.authorize'] = false;
    normalized['devices.audit'] = false;
  }
  return normalized;
}

export function permissionForDashboardPath(pathname: string): PermissionKey {
  if (pathname.startsWith('/dashboard/dispositivos')) return 'devices.view';
  if (pathname.startsWith('/dashboard/calendario')) return 'calendar.view';
  if (pathname.startsWith('/dashboard/control-electoral')) return 'electoral.view';
  if (pathname.startsWith('/dashboard/digitacion')) return 'actas.view';
  if (pathname.startsWith('/dashboard/equipo')) return 'teamProfiles.view';
  if (pathname.startsWith('/dashboard/configuracion')) return 'settings.view';
  if (pathname.startsWith('/dashboard/usuarios')) return 'users.view';
  return 'volunteers.view';
}
