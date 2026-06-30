'use client';

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Users, Settings, Loader2, Menu, X, Map } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>("usuario");
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/login");
      } else {
        setUser(currentUser);
        try {
          const emailKey = currentUser.email || "";
          const userDoc = await getDoc(doc(db, "usuarios", emailKey));
          if (userDoc.exists()) {
            setUserRole(userDoc.data().rol);
          }
        } catch (error) {
          console.error("Error fetching user role:", error);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 size={40} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null; // Will redirect

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between bg-white border-b border-gray-200 p-4 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="bg-primary/5 rounded-full w-10 h-10 flex items-center justify-center p-1 shrink-0">
            <Image src="/brazo.png" alt="Logo" width={32} height={32} className="w-full h-full object-contain" />
          </div>
          <span className="font-heading font-black text-xl tracking-tighter text-primary-dark leading-none">
            KAREN
          </span>
        </div>
        <button 
          className="p-2 text-gray-500 hover:bg-slate-100 rounded-lg"
          onClick={() => setMenuOpen(true)}
        >
          <Menu size={24} />
        </button>
      </div>

      {/* Mobile Overlay */}
      {menuOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 md:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Sidebar (Drawer on mobile, Static on desktop) */}
      <aside 
        className={`fixed md:sticky md:top-0 inset-y-0 right-0 z-50 w-72 md:w-64 bg-white md:border-r border-gray-200 p-6 flex flex-col shrink-0 h-screen transform transition-transform duration-300 ease-in-out ${
          menuOpen ? "translate-x-0 shadow-2xl" : "translate-x-full md:translate-x-0 md:shadow-none"
        }`}
      >
        <div className="flex items-center justify-between md:justify-start gap-3 mb-10">
          <div className="flex items-center gap-3">
            <div className="bg-primary/5 rounded-full w-10 h-10 flex items-center justify-center p-1 shrink-0">
              <Image src="/brazo.png" alt="Logo" width={32} height={32} className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col justify-center">
              <span className="font-heading font-black text-xl tracking-tighter text-primary-dark leading-none">
                KAREN <span className="text-secondary">ACEVEDO</span>
              </span>
            </div>
          </div>
          
          <button 
            className="md:hidden p-2 text-gray-500 hover:bg-slate-100 rounded-lg"
            onClick={() => setMenuOpen(false)}
          >
            <X size={24} />
          </button>
        </div>
        
        <div className="flex flex-col flex-1">
          <nav className="flex-1 space-y-2">
            <Link 
              href="/dashboard" 
              onClick={() => setMenuOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 font-medium transition-colors ${pathname === '/dashboard' ? 'bg-blue-50 text-primary-dark font-bold border-r-4 border-primary' : 'text-gray-500 hover:text-primary hover:bg-slate-50 rounded-xl'}`}
            >
              <Users size={20} className={pathname === '/dashboard' ? 'text-primary' : 'text-gray-400'} />
              Voluntarios
            </Link>
            
            {(userRole === 'administrador' || userRole === 'candidata') && (
              <>
                <Link 
                  href="/dashboard/control-electoral" 
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 font-medium transition-colors ${pathname.includes('/dashboard/control-electoral') ? 'bg-blue-50 text-primary-dark font-bold border-r-4 border-primary' : 'text-gray-500 hover:text-primary hover:bg-slate-50 rounded-xl'}`}
                >
                  <Map size={20} className={pathname.includes('/dashboard/control-electoral') ? 'text-primary' : 'text-gray-400'} />
                  Control Electoral
                </Link>
                <Link 
                  href="/dashboard/personeros" 
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 font-medium transition-colors ${pathname.includes('/dashboard/personeros') ? 'bg-blue-50 text-primary-dark font-bold border-r-4 border-primary' : 'text-gray-500 hover:text-primary hover:bg-slate-50 rounded-xl'}`}
                >
                  <Users size={20} className={pathname.includes('/dashboard/personeros') ? 'text-primary' : 'text-gray-400'} />
                  Personeros
                </Link>
                <Link 
                  href="/dashboard/configuracion" 
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 font-medium transition-colors ${pathname === '/dashboard/configuracion' ? 'bg-blue-50 text-primary-dark font-bold border-r-4 border-primary' : 'text-gray-500 hover:text-primary hover:bg-slate-50 rounded-xl'}`}
                >
                  <Settings size={20} className={pathname === '/dashboard/configuracion' ? 'text-primary' : 'text-gray-400'} />
                  Configuración
                </Link>
              </>
            )}

            {userRole === 'administrador' && (
              <Link 
                href="/dashboard/usuarios" 
                onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 font-medium transition-colors ${pathname.includes('/dashboard/usuarios') ? 'bg-blue-50 text-primary-dark font-bold border-r-4 border-primary' : 'text-gray-500 hover:text-primary hover:bg-slate-50 rounded-xl'}`}
              >
                <Users size={20} className={pathname.includes('/dashboard/usuarios') ? 'text-primary' : 'text-gray-400'} />
                Gestión de Accesos
              </Link>
            )}
          </nav>

          <div className="pt-6 border-t border-gray-100 mt-auto">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 font-medium truncate max-w-[150px]">DNI: {user.email?.split('@')[0]}</span>
              <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2" title="Cerrar sesión">
                <span className="text-sm md:hidden font-medium">Salir</span>
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 w-full overflow-y-auto p-4 md:p-10">
        {children}
      </main>
    </div>
  );
}
