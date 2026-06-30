'use client';

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Lock, Mail, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function LoginPage() {
  const [dni, setDni] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Firebase auth requiere un email, usamos el DNI + un dominio falso interno
      const fakeEmail = `${dni}@fuerzaciudadana.pe`;
      const userCredential = await signInWithEmailAndPassword(auth, fakeEmail, password);
      
      // Obtener el rol del usuario
      const userDoc = await getDoc(doc(db, "usuarios", fakeEmail));
      
      if (userDoc.exists() && userDoc.data().rol === 'personero') {
        router.push("/personero");
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      console.error(err);
      setError("Credenciales incorrectas o problemas de conexión.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-primary-dark flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-secondary/10 blur-[120px] rounded-full pointer-events-none" />
      
      <Link href="/" className="absolute top-8 left-8 text-white/50 hover:text-white flex items-center gap-2 transition-colors z-10">
        <ArrowLeft size={20} /> Volver a la web
      </Link>

      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 md:p-10 z-10 relative border border-white/20">
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-full w-16 h-16 flex items-center justify-center p-2 shadow-sm border border-gray-100">
            <Image src="/brazo.png" alt="Logo" width={48} height={48} className="w-full h-full object-contain" />
          </div>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-dark mb-2">Panel Administrativo</h1>
          <p className="text-text text-sm">Acceso exclusivo para el equipo de Fuerza Ciudadana.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm border border-red-100 text-center font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-dark mb-1">DNI del Administrador</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <Lock size={18} />
              </div>
              <input
                type="text"
                required
                maxLength={8}
                value={dni}
                onChange={(e) => setDni(e.target.value.replace(/[^0-9]/g, ''))}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                placeholder="Ingresa tu DNI"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-dark mb-1">Contraseña</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <Lock size={18} />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-primary text-white font-heading font-bold py-3.5 rounded-xl hover:bg-primary-dark transition-all shadow-md mt-6 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : "Ingresar al Panel"}
          </button>
        </form>
      </div>
    </div>
  );
}
