'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { PermissionKey, RolePermissions, UserRole } from '@/lib/access-control';

export type AccessContextValue = {
  role: UserRole;
  name: string;
  email: string;
  permissions: RolePermissions;
};

const AccessContext = createContext<AccessContextValue | null>(null);

export function AccessProvider({
  value,
  children,
}: {
  value: AccessContextValue;
  children: ReactNode;
}) {
  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useAccess() {
  const context = useContext(AccessContext);
  if (!context) throw new Error('useAccess debe usarse dentro de AccessProvider.');
  return {
    ...context,
    hasPermission: (permission: PermissionKey) => context.permissions[permission] === true,
    isSuperuser: context.role === 'superusuario',
  };
}
