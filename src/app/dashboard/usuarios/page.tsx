'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { Key, Loader2, LockKeyhole, Shield, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import { db } from '@/lib/firebase';
import { authenticatedPost } from '@/lib/firebase/authenticated-request';
import { userService } from '@/lib/firebase/user-service';
import {
  ASSIGNABLE_ROLES,
  ROLE_LABELS,
  SUPERUSER_EMAIL,
  type AssignableRole,
  type UserRole,
} from '@/lib/access-control';
import { RolePermissionsPanel } from '@/components/access/RolePermissionsPanel';
import { useAccess } from '@/components/access/AccessContext';

type UsuarioPanel = {
  id: string;
  uid?: string;
  nombre: string;
  dni: string;
  rol: UserRole;
  protected?: boolean;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
}

const roleStyles: Record<UserRole, string> = {
  superusuario: 'border-amber-300 bg-amber-50 text-amber-900',
  administrador: 'border-red-200 bg-red-50 text-red-700',
  candidata: 'border-purple-200 bg-purple-50 text-purple-700',
  digitador: 'border-blue-200 bg-blue-50 text-blue-700',
  usuario: 'border-slate-200 bg-slate-50 text-slate-700',
};

export default function UsuariosPage() {
  const { email, hasPermission, isSuperuser } = useAccess();
  const canManage = hasPermission('users.manage');
  const [usuarios, setUsuarios] = useState<UsuarioPanel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [passwordUser, setPasswordUser] = useState<UsuarioPanel | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [deletingUser, setDeletingUser] = useState<UsuarioPanel | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formData, setFormData] = useState({ dni: '', nombre: '', rol: 'usuario' as AssignableRole, password: '' });

  const fetchUsuarios = async () => {
    const snapshot = await getDocs(collection(db, 'usuarios'));
    const list = snapshot.docs.map((document) => {
      const data = document.data() as Omit<UsuarioPanel, 'id'>;
      return {
        ...data,
        id: document.id,
        rol: document.id.toLowerCase() === SUPERUSER_EMAIL ? 'superusuario' : data.rol,
        protected: document.id.toLowerCase() === SUPERUSER_EMAIL || data.rol === 'superusuario' || data.protected,
      } as UsuarioPanel;
    }).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    setUsuarios(list);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchUsuarios()
        .catch((error) => setMessage({ text: getErrorMessage(error), error: true }))
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleCreateUser = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canManage) return;
    if (formData.password.length < 8) {
      setMessage({ text: 'La contraseña debe tener al menos 8 caracteres.', error: true });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await userService.crearUsuario({ nombre: formData.nombre, dni: formData.dni, contrasena: formData.password, rol: formData.rol });
      setFormData({ dni: '', nombre: '', rol: 'usuario', password: '' });
      setMessage({ text: 'Usuario creado correctamente.', error: false });
      await fetchUsuarios();
    } catch (error) {
      setMessage({ text: getErrorMessage(error), error: true });
    } finally {
      setSaving(false);
    }
  };

  const handleChangeRole = async (user: UsuarioPanel, newRole: AssignableRole) => {
    if (!canManage || user.protected || user.id === email) return;
    setUpdatingId(user.id);
    setMessage(null);
    try {
      await authenticatedPost('/api/auth/update-role', { userEmail: user.id, newRole });
      setMessage({ text: `Rol de ${user.nombre} actualizado.`, error: false });
      await fetchUsuarios();
    } catch (error) {
      setMessage({ text: getErrorMessage(error), error: true });
    } finally {
      setUpdatingId(null);
    }
  };

  const handlePasswordChange = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!passwordUser || !canManage) return;
    if (newPassword.length < 8) {
      setMessage({ text: 'La contraseña debe tener al menos 8 caracteres.', error: true });
      return;
    }
    setSavingPassword(true);
    try {
      await authenticatedPost('/api/auth/change-password', { uid: passwordUser.uid || '', userEmail: passwordUser.id, newPassword });
      setPasswordUser(null);
      setNewPassword('');
      setMessage({ text: 'Contraseña actualizada correctamente.', error: false });
    } catch (error) {
      setMessage({ text: getErrorMessage(error), error: true });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingUser || !canManage || deletingUser.protected) return;
    setIsDeleting(true);
    try {
      await authenticatedPost('/api/auth/delete-user', { uid: deletingUser.uid || '', userEmail: deletingUser.id });
      setDeletingUser(null);
      setMessage({ text: 'Usuario eliminado correctamente.', error: false });
      await fetchUsuarios();
    } catch (error) {
      setMessage({ text: getErrorMessage(error), error: true });
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 size={40} className="animate-spin text-primary" /></div>;

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-8">
        <div className="flex items-center gap-3"><ShieldCheck className="text-primary" /><h1 className="text-3xl font-black text-dark">Gestión de Accesos</h1></div>
        <p className="mt-2 text-text">Administra usuarios y los permisos efectivos de cada rol.</p>
      </header>

      {message && <div role="status" className={`mb-6 rounded-2xl border p-4 text-sm font-semibold ${message.error ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`}>{message.text}</div>}

      <div className="grid gap-8 lg:grid-cols-[340px_1fr]">
        <section className="self-start rounded-3xl border border-gray-100 bg-white p-6 shadow-sm lg:sticky lg:top-10">
          <div className="mb-6 flex items-center gap-3 border-b border-gray-100 pb-5"><div className="rounded-xl bg-blue-50 p-2 text-blue-600"><UserPlus size={22} /></div><h2 className="text-xl font-bold text-dark">Nuevo acceso</h2></div>
          {!canManage && <p className="mb-5 flex gap-2 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800"><LockKeyhole size={18} className="shrink-0" />Tu rol puede consultar, pero no crear usuarios.</p>}
          <form onSubmit={handleCreateUser} className="space-y-4">
            <fieldset disabled={!canManage || saving} className="space-y-4 disabled:opacity-55">
              <label className="block text-sm font-bold text-dark">Nombre completo<input required minLength={2} maxLength={100} value={formData.nombre} onChange={(event) => setFormData({ ...formData, nombre: event.target.value })} className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" /></label>
              <label className="block text-sm font-bold text-dark">DNI (usuario)<input required inputMode="numeric" pattern="[0-9]{8}" value={formData.dni} onChange={(event) => setFormData({ ...formData, dni: event.target.value.replace(/\D/g, '').slice(0, 8) })} className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" placeholder="8 dígitos" /></label>
              <label className="block text-sm font-bold text-dark">Rol<select value={formData.rol} onChange={(event) => setFormData({ ...formData, rol: event.target.value as AssignableRole })} className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-primary">
                {ASSIGNABLE_ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
              </select></label>
              <label className="block text-sm font-bold text-dark">Contraseña temporal<input required type="password" minLength={8} maxLength={128} value={formData.password} onChange={(event) => setFormData({ ...formData, password: event.target.value })} className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" placeholder="Mínimo 8 caracteres" /></label>
              <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-dark px-4 py-3 font-bold text-white transition hover:bg-black disabled:opacity-60">{saving ? <Loader2 size={20} className="animate-spin" /> : <UserPlus size={18} />} Crear usuario</button>
            </fieldset>
          </form>
        </section>

        <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-5 flex items-center gap-3 border-b border-gray-100 pb-5"><div className="rounded-xl bg-purple-50 p-2 text-purple-600"><Shield size={22} /></div><div><h2 className="text-xl font-bold text-dark">Usuarios registrados</h2><p className="text-xs text-gray-500">{usuarios.length} en total</p></div></div>
          <div className="space-y-3">
            {usuarios.map((user) => {
              const protectedUser = Boolean(user.protected);
              const canChangePassword = canManage && (!protectedUser || (isSuperuser && user.id === email));
              const canEdit = canManage && !protectedUser && user.id !== email;
              return (
                <article key={user.id} className={`grid gap-4 rounded-2xl border p-4 sm:grid-cols-[1fr_auto] sm:items-center ${protectedUser ? 'border-amber-200 bg-amber-50/40' : 'border-slate-100'}`}>
                  <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-slate-800">{user.nombre}</h3>{protectedUser && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black uppercase text-amber-800"><ShieldCheck size={12} /> Protegido</span>}</div><p className="mt-1 font-mono text-xs text-slate-500">DNI: {user.dni || user.id.split('@')[0]}</p></div>
                  <div className="flex flex-wrap items-center gap-2">
                    {protectedUser ? <span className={`rounded-full border px-3 py-2 text-xs font-black ${roleStyles.superusuario}`}>Modo Dios</span> : <select value={user.rol} disabled={!canEdit || updatingId === user.id} onChange={(event) => handleChangeRole(user, event.target.value as AssignableRole)} className={`w-36 rounded-full border px-3 py-2 text-xs font-bold outline-none disabled:cursor-not-allowed disabled:opacity-65 ${roleStyles[user.rol]}`}>{ASSIGNABLE_ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select>}
                    <button type="button" disabled={!canChangePassword} onClick={() => { setPasswordUser(user); setNewPassword(''); }} className="rounded-full p-2 text-slate-400 transition hover:bg-blue-50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-30" title="Cambiar contraseña"><Key size={18} /></button>
                    <button type="button" disabled={!canEdit} onClick={() => setDeletingUser(user)} className="rounded-full p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30" title={protectedUser ? 'Cuenta protegida' : 'Eliminar usuario'}><Trash2 size={18} /></button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>

      <RolePermissionsPanel />

      {passwordUser && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"><form onSubmit={handlePasswordChange} className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl"><h3 className="text-2xl font-black text-slate-800">Cambiar contraseña</h3><p className="mt-2 text-sm text-slate-500">Nueva clave para <strong>{passwordUser.nombre}</strong>.</p><input autoFocus required type="password" minLength={8} maxLength={128} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="mt-6 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" placeholder="Mínimo 8 caracteres" /><div className="mt-6 flex gap-3"><button type="button" onClick={() => setPasswordUser(null)} className="flex-1 rounded-xl bg-slate-100 py-3 font-bold text-slate-700">Cancelar</button><button type="submit" disabled={savingPassword} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 font-bold text-white disabled:opacity-50">{savingPassword && <Loader2 size={17} className="animate-spin" />} Guardar</button></div></form></div>}

      {deletingUser && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-3xl bg-white p-7 text-center shadow-2xl"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600"><Trash2 size={30} /></div><h3 className="mt-4 text-2xl font-black text-slate-800">Eliminar usuario</h3><p className="mt-2 text-sm leading-6 text-slate-500">Se eliminará permanentemente el acceso de <strong>{deletingUser.nombre}</strong> y sus suscripciones de notificación.</p><div className="mt-6 flex gap-3"><button type="button" onClick={() => setDeletingUser(null)} className="flex-1 rounded-xl bg-slate-100 py-3 font-bold text-slate-700">Cancelar</button><button type="button" onClick={handleDelete} disabled={isDeleting} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 py-3 font-bold text-white disabled:opacity-50">{isDeleting && <Loader2 size={17} className="animate-spin" />} Eliminar</button></div></div></div>}
    </div>
  );
}
