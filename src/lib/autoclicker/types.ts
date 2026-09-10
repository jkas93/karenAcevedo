export type DeviceState = 'disabled' | 'enabled' | 'suspended' | 'revoked';
export type Device = {
  id: string; owner: string; alias: string; state: DeviceState; version: number;
  expiresAt: number | null; createdAt: number; updatedAt: number;
  metadata: { manufacturer: string; model: string; android: string; appVersion: string; width: number; height: number };
  lastSeenAt: number | null; reportedState: string | null; leaseExpiresAt: number | null;
};
export type DeviceAudit = { id: string; action: string; actor: string; reason: string; createdAt: number; before: unknown; after: unknown };
export const STATE_LABELS: Record<DeviceState, string> = { disabled: 'Deshabilitado', enabled: 'Habilitado', suspended: 'Suspendido', revoked: 'Revocado' };

