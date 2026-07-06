'use client';

import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc, updateDoc } from "firebase/firestore";
import { Loader2, UserPlus, Shield, Key, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { userService } from "@/lib/firebase/user-service";
import type { RolUsuario } from "@/lib/firebase/types";

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  
  // Modal de contraseña
  const [passwordUser, setPasswordUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  // Modal de eliminación
  const [deletingUser, setDeletingUser] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const router = useRouter();

  const [formData, setFormData] = useState({
    dni: "",
    nombre: "",
    rol: "usuario" as RolUsuario,
    password: "",
  });

  const fetchUsuarios = async () => {
    const querySnapshot = await getDocs(collection(db, "usuarios"));
    const list = querySnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    setUsuarios(list);
  };

  // Verificar rol y cargar usuarios
  useEffect(() => {
    const init = async () => {
      try {
        if (!auth.currentUser) return;
        const email = auth.currentUser.email || "";
        const userDoc = await getDoc(doc(db, "usuarios", email));

        if (userDoc.exists() && userDoc.data().rol !== "administrador") {
          router.push("/dashboard");
          return;
        }

        await fetchUsuarios();
      } catch (error) {
        console.error("Error inicializando:", error);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [router]);



  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ text: "", type: "" });

    if (formData.password.length < 6) {
      setMessage({ text: "La contraseña debe tener al menos 6 caracteres.", type: "error" });
      setSaving(false);
      return;
    }

    try {
      // Usa el servicio unificado — esquema consistente en Firestore para todos los roles
      await userService.crearUsuario({
        nombre: formData.nombre,
        dni: formData.dni,
        contrasena: formData.password,
        rol: formData.rol,
      });

      setMessage({
        text: `✅ Usuario "${formData.nombre}" creado correctamente con rol ${formData.rol}.`,
        type: "success",
      });
      setFormData({ dni: "", nombre: "", rol: "usuario", password: "" });
      await fetchUsuarios();
    } catch (error: any) {
      console.error("Error creando usuario:", error);
      setMessage({ text: `❌ ${error.message}`, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    setUpdatingId(userId);
    try {
      await updateDoc(doc(db, "usuarios", userId), { rol: newRole });
      setMessage({ text: "Rol actualizado correctamente.", type: "success" });
      await fetchUsuarios();
      setTimeout(() => setMessage({ text: "", type: "" }), 3000);
    } catch (error) {
      console.error("Error al actualizar rol:", error);
      setMessage({ text: "Error al actualizar el rol.", type: "error" });
    } finally {
      setUpdatingId(null);
    }
  };

  const handlePasswordChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordUser || !auth.currentUser) return;
    if (newPassword.length < 6) {
      alert("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setSavingPassword(true);
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: passwordUser.uid,
          newPassword: newPassword,
          adminEmail: auth.currentUser.email, // Validar rol en servidor
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error);

      setMessage({ text: `✅ Contraseña de ${passwordUser.nombre} actualizada correctamente.`, type: "success" });
      setPasswordUser(null);
      setNewPassword("");
    } catch (error: any) {
      alert(error.message);
    } finally {
      setSavingPassword(false);
    }
  };

  const handleDeleteUserConfirm = async () => {
    if (!deletingUser || !auth.currentUser) return;
    
    setIsDeleting(true);
    try {
      const response = await fetch('/api/auth/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: deletingUser.uid,
          adminEmail: auth.currentUser.email,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error);

      setMessage({ text: `✅ Usuario ${deletingUser.nombre} eliminado permanentemente.`, type: "success" });
      setDeletingUser(null);
      await fetchUsuarios();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const getRoleSelect = (usr: any) => {
    return (
      <div className="relative">
        <select
          value={usr.rol}
          onChange={(e) => handleChangeRole(usr.id, e.target.value)}
          disabled={updatingId === usr.id}
          className={`appearance-none outline-none font-bold text-xs px-3 py-1.5 rounded-full border cursor-pointer w-32 ${
            usr.rol === 'administrador' ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' :
            usr.rol === 'candidata' ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100' :
            usr.rol === 'digitador' ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' :
            'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
          }`}
        >
          <option value="usuario">Usuario</option>
          <option value="digitador">Digitador</option>
          <option value="administrador">Administrador</option>
          <option value="candidata">Candidata</option>
        </select>
        {updatingId === usr.id && (
          <Loader2 size={14} className="absolute right-2 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="py-20 flex justify-center">
        <Loader2 size={40} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <header className="mb-10">
        <h1 className="text-3xl font-black text-dark mb-2">Gestión de Accesos</h1>
        <p className="text-text">
          Administra quién puede entrar al panel y qué nivel de permisos tienen.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Formulario de Alta */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8 sticky top-10">
            <div className="flex items-center gap-3 mb-6 pb-6 border-b border-gray-100">
              <div className="bg-blue-50 p-2 rounded-xl text-blue-600">
                <UserPlus size={24} />
              </div>
              <h2 className="text-xl font-bold text-dark">Nuevo Acceso</h2>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-5">
              {message.text && (
                <div
                  className={`p-4 rounded-xl text-sm font-medium ${
                    message.type === "success"
                      ? "bg-green-50 text-green-700 border border-green-200"
                      : "bg-red-50 text-red-700 border border-red-200"
                  }`}
                >
                  {message.text}
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-dark mb-1">Nombre Completo</label>
                <input
                  type="text"
                  required
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                  placeholder="Ej. Juan Pérez"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-dark mb-1">DNI (Usuario)</label>
                <input
                  type="text"
                  required
                  value={formData.dni}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      dni: e.target.value.replace(/[^0-9]/g, "").slice(0, 8),
                    })
                  }
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                  placeholder="8 dígitos"
                />
                <p className="text-xs text-gray-500 mt-1">
                  El usuario ingresará con su DNI como contraseña de usuario.
                </p>
              </div>

              <div>
                <label className="block text-sm font-bold text-dark mb-1">Rol de Acceso</label>
                <select
                  required
                  value={formData.rol}
                  onChange={(e) =>
                    setFormData({ ...formData, rol: e.target.value as RolUsuario })
                  }
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none bg-white"
                >
                  <option value="usuario">Usuario — Solo ver voluntarios</option>
                  <option value="digitador">Digitador — Ingreso de Actas centralizado</option>
                  <option value="administrador">Administrador — Control total</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-dark mb-1">Contraseña Temporal</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 bg-dark text-white font-bold py-3 px-4 rounded-xl hover:bg-black transition-all disabled:opacity-70 disabled:cursor-not-allowed mt-2"
              >
                {saving ? <Loader2 size={20} className="animate-spin" /> : "Crear Usuario"}
              </button>
            </form>
          </div>
        </div>

        {/* Tabla de Usuarios */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8 overflow-hidden">
            <div className="flex items-center gap-3 mb-6 pb-6 border-b border-gray-100">
              <div className="bg-purple-50 p-2 rounded-xl text-purple-600">
                <Shield size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-dark">Equipo Registrado</h2>
                <p className="text-xs text-gray-500">{usuarios.length} usuarios en total</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="py-4 px-4 font-bold text-sm text-gray-500 uppercase tracking-wider">Nombre</th>
                    <th className="py-4 px-4 font-bold text-sm text-gray-500 uppercase tracking-wider">DNI / Usuario</th>
                    <th className="py-4 px-4 font-bold text-sm text-gray-500 uppercase tracking-wider">Rol</th>
                    <th className="py-4 px-4 font-bold text-sm text-gray-500 uppercase tracking-wider text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {usuarios.map((usr) => (
                    <tr key={usr.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-4 font-medium text-dark">{usr.nombre}</td>
                      <td className="py-4 px-4 text-gray-600 font-mono text-sm">{usr.dni}</td>
                      <td className="py-4 px-4">{getRoleSelect(usr)}</td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => { setPasswordUser(usr); setNewPassword(""); }}
                            className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-full transition-colors"
                            title="Cambiar Contraseña"
                          >
                            <Key size={18} />
                          </button>
                          <button
                            onClick={() => setDeletingUser(usr)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                            title="Eliminar Usuario"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {usuarios.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-gray-500">
                        No hay usuarios registrados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Cambiar Contraseña */}
      {passwordUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-2xl font-bold text-slate-800 mb-2">Cambiar Contraseña</h3>
            <p className="text-slate-500 text-sm mb-6">
              Estás a punto de forzar el cambio de contraseña para <strong>{passwordUser.nombre}</strong>.
            </p>
            
            <form onSubmit={handlePasswordChangeSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Nueva Contraseña</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setPasswordUser(null)}
                  className="flex-1 bg-slate-100 text-slate-700 font-bold py-3 rounded-xl hover:bg-slate-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingPassword}
                  className="flex-1 flex justify-center items-center gap-2 bg-primary text-white font-bold py-3 rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-50"
                >
                  {savingPassword ? <Loader2 size={18} className="animate-spin" /> : "Guardar Clave"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Eliminar Usuario */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200 text-center">
            <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={32} />
            </div>
            <h3 className="text-2xl font-bold text-slate-800 mb-2">Eliminar Usuario</h3>
            <p className="text-slate-500 text-sm mb-6">
              ¿Estás seguro de que deseas eliminar permanentemente el acceso de <strong>{deletingUser.nombre}</strong>? Esta acción no se puede deshacer.
            </p>
            
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="flex-1 bg-slate-100 text-slate-700 font-bold py-3 rounded-xl hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteUserConfirm}
                disabled={isDeleting}
                className="flex-1 flex justify-center items-center gap-2 bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isDeleting ? <Loader2 size={18} className="animate-spin" /> : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
