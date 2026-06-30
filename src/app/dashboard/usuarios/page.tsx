'use client';

import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, getDocs, doc, setDoc, getDoc } from "firebase/firestore";
import { Loader2, UserPlus, Shield, Trash2, Key } from "lucide-react";
import { useRouter } from "next/navigation";

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });
  const router = useRouter();

  const [formData, setFormData] = useState({
    dni: "",
    nombre: "",
    rol: "usuario",
    password: ""
  });

  // Verify Role and Fetch Data
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
        console.error("Error init:", error);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [router]);

  const fetchUsuarios = async () => {
    const querySnapshot = await getDocs(collection(db, "usuarios"));
    const list = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    setUsuarios(list);
  };

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
      const targetEmail = `${formData.dni}@fuerzaciudadana.pe`;
      
      // 1. Create User via Firebase REST API to avoid signing out the current user
      // Required to use Identity Toolkit API Key (which is public client key)
      const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyC0Oj1sMnKp7OJKXGQyzP7485Z1UlLBW94";
      const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: targetEmail,
          password: formData.password,
          returnSecureToken: false
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        if (data.error?.message === "EMAIL_EXISTS") {
          throw new Error("Este DNI ya tiene un usuario registrado.");
        }
        throw new Error(data.error?.message || "Error al crear la cuenta en Auth");
      }

      // 2. Save User Profile in Firestore
      await setDoc(doc(db, "usuarios", targetEmail), {
        dni: formData.dni,
        nombre: formData.nombre,
        rol: formData.rol,
        correo: targetEmail
      });

      setMessage({ text: `✅ Usuario ${formData.nombre} creado correctamente.`, type: "success" });
      setFormData({ dni: "", nombre: "", rol: "usuario", password: "" });
      await fetchUsuarios();

    } catch (error: any) {
      console.error("Error creating user:", error);
      setMessage({ text: `❌ ${error.message}`, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const getRoleBadge = (rol: string) => {
    if (rol === 'administrador') return <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold border border-red-200">Administrador</span>;
    if (rol === 'candidata') return <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-bold border border-purple-200">Candidata</span>;
    return <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs font-bold border border-gray-200">Usuario</span>;
  };

  if (loading) {
    return <div className="py-20 flex justify-center"><Loader2 size={40} className="animate-spin text-primary" /></div>;
  }

  return (
    <div className="max-w-6xl mx-auto">
      <header className="mb-10">
        <h1 className="text-3xl font-black text-dark mb-2">Gestión de Accesos</h1>
        <p className="text-text">Administra quién puede entrar al panel y qué nivel de permisos tienen.</p>
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
                <div className={`p-4 rounded-xl text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {message.text}
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-dark mb-1">Nombre Completo</label>
                <input
                  type="text"
                  required
                  value={formData.nombre}
                  onChange={(e) => setFormData({...formData, nombre: e.target.value})}
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
                  onChange={(e) => setFormData({...formData, dni: e.target.value.replace(/[^0-9]/g, '').slice(0, 8)})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                  placeholder="8 dígitos"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-dark mb-1">Nivel de Permiso (Rol)</label>
                <select
                  required
                  value={formData.rol}
                  onChange={(e) => setFormData({...formData, rol: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none bg-white"
                >
                  <option value="usuario">Usuario (Solo ver voluntarios)</option>
                  <option value="administrador">Administrador (Control total)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-dark mb-1">Contraseña Temporal</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Key size={18} />
                  </div>
                  <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
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
              <h2 className="text-xl font-bold text-dark">Equipo Registrado</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="py-4 px-4 font-bold text-sm text-gray-500 uppercase tracking-wider">Nombre</th>
                    <th className="py-4 px-4 font-bold text-sm text-gray-500 uppercase tracking-wider">DNI / Usuario</th>
                    <th className="py-4 px-4 font-bold text-sm text-gray-500 uppercase tracking-wider">Rol</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {usuarios.map((usr) => (
                    <tr key={usr.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-4 font-medium text-dark">{usr.nombre}</td>
                      <td className="py-4 px-4 text-gray-600 font-mono text-sm">{usr.dni}</td>
                      <td className="py-4 px-4">{getRoleBadge(usr.rol)}</td>
                    </tr>
                  ))}
                  {usuarios.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-gray-500">No hay usuarios registrados.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
