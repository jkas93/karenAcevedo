'use client';

import { useEffect, useState } from 'react';
import { Loader2, LockKeyhole, RotateCcw, Save, ShieldCheck } from 'lucide-react';
import {
  ASSIGNABLE_ROLES,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_MODULES,
  ROLE_LABELS,
  type AssignableRole,
  type RolePermissions,
} from '@/lib/access-control';
import { authenticatedPost } from '@/lib/firebase/authenticated-request';
import { useAccess } from './AccessContext';

type MatrixResponse = { roles: Record<AssignableRole, RolePermissions> };

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'No se pudo completar la operación.';
}

export function RolePermissionsPanel() {
  const { isSuperuser } = useAccess();
  const [selectedRole, setSelectedRole] = useState<AssignableRole>('administrador');
  const [roles, setRoles] = useState<MatrixResponse['roles'] | null>(null);
  const [loading, setLoading] = useState(isSuperuser);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  useEffect(() => {
    if (!isSuperuser) return;
    authenticatedPost<MatrixResponse>('/api/auth/role-permissions', { action: 'get' })
      .then((response) => setRoles(response.roles))
      .catch((error) => setMessage({ text: errorMessage(error), error: true }))
      .finally(() => setLoading(false));
  }, [isSuperuser]);

  if (!isSuperuser) {
    return (
      <section className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-white p-3 text-slate-400"><LockKeyhole size={22} /></div>
          <div>
            <h2 className="font-black text-slate-800">Permisos por rol</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              La matriz puede consultarse y modificarse únicamente desde la cuenta Modo Dios.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const current = roles?.[selectedRole] ?? DEFAULT_ROLE_PERMISSIONS[selectedRole];

  const toggle = (permission: keyof RolePermissions, enabled: boolean) => {
    if (!roles) return;
    const next = { ...roles[selectedRole], [permission]: enabled };
    const moduleConfig = PERMISSION_MODULES.find(
      (entry) => entry.view === permission || entry.manage === permission,
    );
    if (moduleConfig) {
      if (permission === moduleConfig.view && !enabled) next[moduleConfig.manage] = false;
      if (permission === moduleConfig.manage && enabled) next[moduleConfig.view] = true;
    }
    setRoles({ ...roles, [selectedRole]: next });
    setMessage(null);
  };

  const save = async () => {
    if (!roles) return;
    setSaving(true);
    setMessage(null);
    try {
      const response = await authenticatedPost<{ permissions: RolePermissions }>(
        '/api/auth/role-permissions',
        { action: 'update', role: selectedRole, permissions: roles[selectedRole] },
      );
      setRoles({ ...roles, [selectedRole]: response.permissions });
      setMessage({ text: `Permisos de ${ROLE_LABELS[selectedRole]} guardados. Se aplicarán al volver a cargar el panel.`, error: false });
    } catch (error) {
      setMessage({ text: errorMessage(error), error: true });
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await authenticatedPost('/api/auth/role-permissions', { action: 'reset' });
      setRoles(Object.fromEntries(ASSIGNABLE_ROLES.map((role) => [
        role,
        { ...DEFAULT_ROLE_PERMISSIONS[role] },
      ])) as MatrixResponse['roles']);
      setMessage({ text: 'Se restauraron los permisos recomendados de todos los roles.', error: false });
    } catch (error) {
      setMessage({ text: errorMessage(error), error: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mt-8 overflow-hidden rounded-3xl border border-amber-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-amber-100 bg-amber-50/60 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-amber-100 p-3 text-amber-800"><ShieldCheck size={24} /></div>
          <div>
            <h2 className="text-xl font-black text-slate-900">Permisos por rol</h2>
            <p className="text-sm text-slate-600">Control exclusivo de Modo Dios.</p>
          </div>
        </div>
        <button type="button" disabled={saving || loading} onClick={reset} className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-white px-4 py-2 text-sm font-bold text-amber-800 transition hover:bg-amber-50 disabled:opacity-50">
          <RotateCcw size={16} /> Restaurar recomendados
        </button>
      </div>

      <div className="p-6">
        <div className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="Roles configurables">
          {ASSIGNABLE_ROLES.map((role) => (
            <button key={role} type="button" role="tab" aria-selected={selectedRole === role} onClick={() => { setSelectedRole(role); setMessage(null); }} className={`rounded-full px-4 py-2 text-sm font-bold transition ${selectedRole === role ? 'bg-primary text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {ROLE_LABELS[role]}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex min-h-52 items-center justify-center"><Loader2 className="animate-spin text-primary" size={30} /></div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full min-w-[520px] text-left">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr><th className="px-5 py-4">Módulo</th><th className="px-5 py-4 text-center">Ver</th><th className="px-5 py-4 text-center">Administrar</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {PERMISSION_MODULES.map((module) => (
                  <tr key={module.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-4 text-sm font-bold text-slate-700">{module.label}</td>
                    {[module.view, module.manage].map((permission) => (
                      <td key={permission} className="px-5 py-4 text-center">
                        <input type="checkbox" checked={current[permission]} onChange={(event) => toggle(permission, event.target.checked)} className="h-5 w-5 cursor-pointer rounded border-slate-300 text-primary focus:ring-primary" aria-label={`${permission === module.view ? 'Ver' : 'Administrar'} ${module.label}`} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {message && <p role="status" className={`mt-4 rounded-xl border p-3 text-sm font-semibold ${message.error ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`}>{message.text}</p>}

        <div className="mt-6 flex justify-end">
          <button type="button" onClick={save} disabled={saving || loading || !roles} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-black text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Guardar permisos
          </button>
        </div>
      </div>
    </section>
  );
}
