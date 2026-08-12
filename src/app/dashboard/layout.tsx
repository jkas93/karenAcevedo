'use client';

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Users, Settings, Loader2, Menu, X, Map, ChevronLeft, ChevronRight, Calendar, CalendarDays } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { ElectoralProvider } from "@/lib/firebase/ElectoralContext";
import type { RolUsuario } from "@/lib/firebase/types";
import { ClipboardList } from 'lucide-react';

import { PwaNotificationsProvider } from '@/components/pwa/PwaNotificationsProvider';

const VALID_ROLES: RolUsuario[] = ['administrador', 'candidata', 'digitador', 'usuario'];

import { PwaControls } from "@/components/pwa/PwaControls";
import { PwaInstallOnboarding } from "@/components/pwa/PwaInstallProvider";
import { unregisterCurrentDevicePush } from "@/lib/pwa/unregister-current-device";
function isRolUsuario(value: unknown): value is RolUsuario {
  return typeof value === 'string' && VALID_ROLES.includes(value as RolUsuario);
}

function defaultDashboardRoute(): string {
  return '/dashboard/calendario';
}

function canAccessDashboardPath(pathname: string, role: RolUsuario): boolean {
  if (pathname === '/dashboard') {
    return ['administrador', 'candidata', 'usuario'].includes(role);
  }
  if (pathname.startsWith('/dashboard/calendario')) return true;
  if (pathname.startsWith('/dashboard/agenda') || pathname.startsWith('/dashboard/control-electoral')) {
    return ['administrador', 'candidata'].includes(role);
  }
  if (pathname.startsWith('/dashboard/digitacion')) {
    return ['administrador', 'digitador'].includes(role);
  }
  if (pathname.startsWith('/dashboard/configuracion') || pathname.startsWith('/dashboard/usuarios') || pathname.startsWith('/dashboard/equipo')) {
    return role === 'administrador';
  }
  return false;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<RolUsuario | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setUser(null);
        setUserRole(null);
        setLoading(false);
        router.replace("/login");
        return;
      }

      try {
        const emailKey = currentUser.email?.trim().toLowerCase();
        if (!emailKey) throw new Error('La cuenta no tiene correo asociado.');

        const userDoc = await getDoc(doc(db, "usuarios", emailKey));
        const role = userDoc.data()?.rol;
        if (!userDoc.exists() || !isRolUsuario(role)) {
          throw new Error('La cuenta no tiene un perfil autorizado.');
        }

        setUser(currentUser);
        setUserRole(role);
      } catch (error) {
        console.error("Error obteniendo rol del usuario:", error);
        setUser(null);
        setUserRole(null);
        await signOut(auth);
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const pathAllowed = userRole ? canAccessDashboardPath(pathname, userRole) : false;

  useEffect(() => {
    if (!loading && userRole && !pathAllowed) {
      router.replace(defaultDashboardRoute());
    }
  }, [loading, pathAllowed, router, userRole]);

  const handleLogout = async () => {
    await unregisterCurrentDevicePush();
    await signOut(auth);
    router.replace("/login");
  };

  if (loading || (userRole && !pathAllowed)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 size={40} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !userRole) return null;

  return (
    <PwaNotificationsProvider isAdmin={userRole === 'administrador'}>
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row relative">
      
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
          aria-label="Abrir menú"
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

      {/* Sidebar */}
      <aside 
        className={`fixed md:sticky md:top-0 inset-y-0 right-0 z-50 bg-white md:border-r border-gray-200 flex flex-col shrink-0 h-screen transform transition-all duration-300 ease-in-out ${
          menuOpen ? "translate-x-0 shadow-2xl w-72 p-6" : "translate-x-full md:translate-x-0 md:shadow-none"
        } ${!menuOpen ? (isCollapsed ? "md:w-20 md:p-4" : "md:w-64 md:p-6") : ""}`}
      >
        {/* Toggle Button for desktop */}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-label={isCollapsed ? "Expandir menú" : "Contraer menú"}
          className="hidden md:flex absolute -right-3 top-10 bg-white border border-gray-200 text-gray-500 rounded-full p-1 z-50 hover:text-primary hover:border-primary shadow-sm"
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        <div className={`flex items-center gap-3 mb-10 ${isCollapsed && !menuOpen ? 'justify-center' : 'justify-between md:justify-start'}`}>
          <div className={`flex items-center gap-3 ${isCollapsed && !menuOpen ? 'justify-center' : ''}`}>
            <div className="bg-primary/5 rounded-full w-10 h-10 flex items-center justify-center p-1 shrink-0">
              <Image src="/brazo.png" alt="Logo" width={32} height={32} className="w-full h-full object-contain" />
            </div>
            {(!isCollapsed || menuOpen) && (
              <div className="flex flex-col justify-center">
                <span className="font-heading font-black text-xl tracking-tighter text-primary-dark leading-none">
                  KAREN <span className="text-secondary">ACEVEDO</span>
                </span>
              </div>
            )}
          </div>
          
          <button 
            className="md:hidden p-2 text-gray-500 hover:bg-slate-100 rounded-lg"
            onClick={() => setMenuOpen(false)}
            aria-label="Cerrar menú"
          >
            <X size={24} />
          </button>
        </div>
        
        <div className="flex flex-col flex-1">
          <nav className="flex-1 space-y-2">
            
            {/* VOLUNTARIOS: administrador, candidata, usuario */}
            <Link
              href="/dashboard/calendario"
              onClick={() => setMenuOpen(false)}
              className={`flex items-center gap-3 py-3 font-medium transition-colors rounded-xl ${isCollapsed && !menuOpen ? 'justify-center px-0' : 'px-4'} ${pathname.startsWith('/dashboard/calendario') ? 'bg-blue-50 text-primary-dark font-bold md:border-r-4 border-primary' : 'text-gray-500 hover:text-primary hover:bg-slate-50'}`}
              title={isCollapsed ? "Calendario operativo" : undefined}
            >
              <CalendarDays size={20} className={pathname.startsWith('/dashboard/calendario') ? 'text-primary' : 'text-gray-400'} />
              {(!isCollapsed || menuOpen) && <span>Calendario operativo</span>}
            </Link>

            {['administrador', 'candidata', 'usuario'].includes(userRole) && (
              <Link 
                href="/dashboard" 
                onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-3 py-3 font-medium transition-colors rounded-xl ${isCollapsed && !menuOpen ? 'justify-center px-0' : 'px-4'} ${pathname === '/dashboard' ? 'bg-blue-50 text-primary-dark font-bold md:border-r-4 border-primary' : 'text-gray-500 hover:text-primary hover:bg-slate-50'}`}
                title={isCollapsed ? "Voluntarios" : undefined}
              >
                <Users size={20} className={pathname === '/dashboard' ? 'text-primary' : 'text-gray-400'} />
                {(!isCollapsed || menuOpen) && <span>Voluntarios</span>}
              </Link>
            )}
            
            {/* AGENDA PÚBLICA & CONTROL ELECTORAL: administrador, candidata */}
            {['administrador', 'candidata'].includes(userRole) && (
              <>
                <Link 
                  href="/dashboard/agenda" 
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 py-3 font-medium transition-colors rounded-xl ${isCollapsed && !menuOpen ? 'justify-center px-0' : 'px-4'} ${pathname.includes('/dashboard/agenda') ? 'bg-blue-50 text-primary-dark font-bold md:border-r-4 border-primary' : 'text-gray-500 hover:text-primary hover:bg-slate-50'}`}
                  title={isCollapsed ? "Agenda Pública" : undefined}
                >
                  <Calendar size={20} className={pathname.includes('/dashboard/agenda') ? 'text-primary' : 'text-gray-400'} />
                  {(!isCollapsed || menuOpen) && <span>Agenda Pública</span>}
                </Link>
                <Link 
                  href="/dashboard/control-electoral" 
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 py-3 font-medium transition-colors rounded-xl ${isCollapsed && !menuOpen ? 'justify-center px-0' : 'px-4'} ${pathname.includes('/dashboard/control-electoral') ? 'bg-blue-50 text-primary-dark font-bold md:border-r-4 border-primary' : 'text-gray-500 hover:text-primary hover:bg-slate-50'}`}
                  title={isCollapsed ? "Control Electoral" : undefined}
                >
                  <Map size={20} className={pathname.includes('/dashboard/control-electoral') ? 'text-primary' : 'text-gray-400'} />
                  {(!isCollapsed || menuOpen) && <span>Control Electoral</span>}
                </Link>
              </>
            )}

            {/* INGRESO DE ACTAS: administrador, digitador */}
            {['administrador', 'digitador'].includes(userRole) && (
              <Link 
                href="/dashboard/digitacion" 
                onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-3 py-3 font-medium transition-colors rounded-xl ${isCollapsed && !menuOpen ? 'justify-center px-0' : 'px-4'} ${pathname.includes('/dashboard/digitacion') ? 'bg-blue-50 text-primary-dark font-bold md:border-r-4 border-primary' : 'text-gray-500 hover:text-primary hover:bg-slate-50'}`}
                title={isCollapsed ? "Ingreso de Actas" : undefined}
              >
                <Users size={20} className={pathname.includes('/dashboard/digitacion') ? 'text-primary' : 'text-gray-400'} />
                {(!isCollapsed || menuOpen) && <span>Ingreso de Actas</span>}
              </Link>
            )}

            {/* CONFIGURACIÓN & GESTIÓN DE ACCESOS: administrador */}
            {userRole === 'administrador' && (
              <>
                <Link
                  href="/dashboard/equipo"
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 py-3 font-medium transition-colors rounded-xl ${isCollapsed && !menuOpen ? 'justify-center px-0' : 'px-4'} ${pathname.startsWith('/dashboard/equipo') ? 'bg-blue-50 text-primary-dark font-bold md:border-r-4 border-primary' : 'text-gray-500 hover:text-primary hover:bg-slate-50'}`}
                  title={isCollapsed ? "Fichas del equipo" : undefined}
                >
                  <ClipboardList size={20} className={pathname.startsWith('/dashboard/equipo') ? 'text-primary' : 'text-gray-400'} />
                  {(!isCollapsed || menuOpen) && <span>Fichas del equipo</span>}
                </Link>
                <Link 
                  href="/dashboard/configuracion" 
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 py-3 font-medium transition-colors rounded-xl ${isCollapsed && !menuOpen ? 'justify-center px-0' : 'px-4'} ${pathname === '/dashboard/configuracion' ? 'bg-blue-50 text-primary-dark font-bold md:border-r-4 border-primary' : 'text-gray-500 hover:text-primary hover:bg-slate-50'}`}
                  title={isCollapsed ? "Configuración" : undefined}
                >
                  <Settings size={20} className={pathname === '/dashboard/configuracion' ? 'text-primary' : 'text-gray-400'} />
                  {(!isCollapsed || menuOpen) && <span>Configuración</span>}
                </Link>
                <Link 
                  href="/dashboard/usuarios" 
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 py-3 font-medium transition-colors rounded-xl ${isCollapsed && !menuOpen ? 'justify-center px-0' : 'px-4'} ${pathname.includes('/dashboard/usuarios') ? 'bg-blue-50 text-primary-dark font-bold md:border-r-4 border-primary' : 'text-gray-500 hover:text-primary hover:bg-slate-50'}`}
                  title={isCollapsed ? "Gestión de Accesos" : undefined}
                >
                  <Users size={20} className={pathname.includes('/dashboard/usuarios') ? 'text-primary' : 'text-gray-400'} />
                  {(!isCollapsed || menuOpen) && <span>Gestión de Accesos</span>}
                </Link>
              </>
            )}
          </nav>

          <div className="pt-6 border-t border-gray-100 mt-auto">
            {(!isCollapsed || menuOpen) && <div className="mb-4"><PwaControls /></div>}
            <div className={`flex items-center ${isCollapsed && !menuOpen ? 'justify-center flex-col gap-4' : 'justify-between'}`}>
              {(!isCollapsed || menuOpen) && <span className="text-xs text-gray-500 font-medium truncate max-w-[150px]">DNI: {user.email?.split('@')[0]}</span>}
              <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center gap-2" title="Cerrar sesión">
                {(!isCollapsed || menuOpen) && <span className="text-sm font-medium">Salir</span>}
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Contenido principal */}
      <main className={`flex-1 w-full overflow-y-auto p-4 md:p-10 transition-all duration-300`}>
        <ElectoralProvider key={userRole} role={userRole}>
          {children}
        </ElectoralProvider>
      </main>
      <PwaInstallOnboarding />
    </div>
    </PwaNotificationsProvider>
  );
}
