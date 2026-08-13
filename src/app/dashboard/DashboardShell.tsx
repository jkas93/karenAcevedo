'use client';

import { useEffect, useState, type ComponentType } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { usePathname, useRouter } from 'next/navigation';
import {
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  LockKeyhole,
  LogOut,
  Map,
  Menu,
  Settings,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { auth } from '@/lib/firebase';
import { authenticatedPost } from '@/lib/firebase/authenticated-request';
import { ElectoralProvider } from '@/lib/firebase/ElectoralContext';
import {
  ROLE_LABELS,
  permissionForDashboardPath,
  type PermissionKey,
} from '@/lib/access-control';
import {
  AccessProvider,
  type AccessContextValue,
} from '@/components/access/AccessContext';
import { AccessRestricted } from '@/components/access/AccessRestricted';
import { PwaNotificationsProvider } from '@/components/pwa/PwaNotificationsProvider';
import { PwaControls } from '@/components/pwa/PwaControls';
import { PwaInstallOnboarding } from '@/components/pwa/PwaInstallProvider';
import { unregisterCurrentDevicePush } from '@/lib/pwa/unregister-current-device';

type MenuItem = {
  href: string;
  label: string;
  permission: PermissionKey;
  icon: ComponentType<{ size?: number; className?: string }>;
  matches: (pathname: string) => boolean;
};

const MENU_ITEMS: MenuItem[] = [
  { href: '/dashboard/calendario', label: 'Calendario operativo', permission: 'calendar.view', icon: CalendarDays, matches: (path) => path.startsWith('/dashboard/calendario') },
  { href: '/dashboard', label: 'Voluntarios', permission: 'volunteers.view', icon: Users, matches: (path) => path === '/dashboard' },
  { href: '/dashboard/agenda', label: 'Agenda Pública', permission: 'agenda.view', icon: Calendar, matches: (path) => path.startsWith('/dashboard/agenda') },
  { href: '/dashboard/control-electoral', label: 'Control Electoral', permission: 'electoral.view', icon: Map, matches: (path) => path.startsWith('/dashboard/control-electoral') },
  { href: '/dashboard/digitacion', label: 'Ingreso de Actas', permission: 'actas.view', icon: ClipboardCheck, matches: (path) => path.startsWith('/dashboard/digitacion') },
  { href: '/dashboard/equipo', label: 'Fichas del equipo', permission: 'teamProfiles.view', icon: ClipboardList, matches: (path) => path.startsWith('/dashboard/equipo') },
  { href: '/dashboard/configuracion', label: 'Configuración', permission: 'settings.view', icon: Settings, matches: (path) => path.startsWith('/dashboard/configuracion') },
  { href: '/dashboard/usuarios', label: 'Gestión de Accesos', permission: 'users.view', icon: ShieldCheck, matches: (path) => path.startsWith('/dashboard/usuarios') },
];

const MODULE_LABELS: Record<PermissionKey, string> = {
  'calendar.view': 'Calendario operativo', 'calendar.manage': 'Calendario operativo',
  'volunteers.view': 'Voluntarios', 'volunteers.manage': 'Voluntarios',
  'agenda.view': 'Agenda pública', 'agenda.manage': 'Agenda pública',
  'electoral.view': 'Control electoral', 'electoral.manage': 'Control electoral',
  'actas.view': 'Ingreso de actas', 'actas.manage': 'Ingreso de actas',
  'teamProfiles.view': 'Fichas del equipo', 'teamProfiles.manage': 'Fichas del equipo',
  'settings.view': 'Configuración', 'settings.manage': 'Configuración',
  'users.view': 'Gestión de Accesos', 'users.manage': 'Gestión de Accesos',
  'roles.manage': 'Matriz de permisos',
};

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [access, setAccess] = useState<AccessContextValue | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => onAuthStateChanged(auth, async (currentUser) => {
    if (!currentUser) {
      setUser(null);
      setAccess(null);
      setLoading(false);
      router.replace('/login');
      return;
    }

    try {
      const context = await authenticatedPost<AccessContextValue>('/api/auth/access-context', {});
      setUser(currentUser);
      setAccess(context);
    } catch (error) {
      console.error('No se pudo cargar el contexto de acceso:', error);
      await signOut(auth);
      router.replace('/login');
    } finally {
      setLoading(false);
    }
  }), [router]);

  const handleLogout = async () => {
    await unregisterCurrentDevicePush();
    await signOut(auth);
    router.replace('/login');
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50"><div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-primary" /></div>;
  }
  if (!user || !access) return null;

  const requiredPermission = permissionForDashboardPath(pathname);
  const pathAllowed = access.permissions[requiredPermission];
  const needsElectoral = pathAllowed && (
    pathname.startsWith('/dashboard/control-electoral')
    || pathname.startsWith('/dashboard/digitacion')
    || pathname.startsWith('/dashboard/configuracion')
  );
  const isSuperuser = access.role === 'superusuario';

  const page = pathAllowed
    ? needsElectoral
      ? <ElectoralProvider key={access.role} role={access.role}>{children}</ElectoralProvider>
      : children
    : <AccessRestricted moduleName={MODULE_LABELS[requiredPermission]} />;

  return (
    <AccessProvider value={access}>
      <PwaNotificationsProvider isAdmin={access.permissions['users.view']}>
        <div className="relative flex min-h-screen flex-col bg-slate-50 md:flex-row">
          <div className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-200 bg-white p-4 md:hidden">
            <div className="flex items-center gap-3">
              <Image src="/brazo.png" alt="Logo" width={36} height={36} className="rounded-full bg-blue-50 p-1" />
              <div><p className="font-heading text-lg font-black leading-none text-primary-dark">KAREN</p><p className={`mt-1 text-[10px] font-black uppercase tracking-wider ${isSuperuser ? 'text-amber-700' : 'text-slate-500'}`}>{ROLE_LABELS[access.role]}</p></div>
            </div>
            <button type="button" className="rounded-lg p-2 text-gray-500 hover:bg-slate-100" onClick={() => setMenuOpen(true)} aria-label="Abrir menú"><Menu size={24} /></button>
          </div>

          {menuOpen && <button type="button" className="fixed inset-0 z-40 bg-black/20 md:hidden" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú" />}

          <aside className={`fixed inset-y-0 right-0 z-50 flex h-screen shrink-0 transform flex-col bg-white transition-all duration-300 md:sticky md:top-0 md:translate-x-0 md:border-r ${menuOpen ? 'w-72 translate-x-0 p-6 shadow-2xl' : `translate-x-full md:shadow-none ${isCollapsed ? 'md:w-20 md:p-4' : 'md:w-64 md:p-6'}`}`}>
            <button type="button" onClick={() => setIsCollapsed((value) => !value)} aria-label={isCollapsed ? 'Expandir menú' : 'Contraer menú'} className="absolute -right-3 top-10 z-50 hidden rounded-full border border-gray-200 bg-white p-1 text-gray-500 shadow-sm hover:border-primary hover:text-primary md:flex">
              {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>

            <div className={`mb-8 flex items-center gap-3 ${isCollapsed && !menuOpen ? 'justify-center' : 'justify-between md:justify-start'}`}>
              <Image src="/brazo.png" alt="Logo" width={40} height={40} className="rounded-full bg-blue-50 p-1" />
              {(!isCollapsed || menuOpen) && <div className="min-w-0"><p className="truncate font-heading text-lg font-black leading-none text-primary-dark">KAREN <span className="text-secondary">ACEVEDO</span></p><span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${isSuperuser ? 'border border-amber-200 bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>{isSuperuser && <ShieldCheck size={12} className="mr-1" />}{ROLE_LABELS[access.role]}</span></div>}
              <button type="button" className="rounded-lg p-2 text-gray-500 md:hidden" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú"><X size={22} /></button>
            </div>

            <div className="flex flex-1 flex-col overflow-hidden">
              <nav className="flex-1 space-y-1 overflow-y-auto pr-1">
                {MENU_ITEMS.map((item) => {
                  const allowed = access.permissions[item.permission];
                  const active = item.matches(pathname);
                  const Icon = item.icon;
                  return (
                    <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} aria-disabled={!allowed} className={`flex items-center gap-3 rounded-xl py-3 font-medium transition ${isCollapsed && !menuOpen ? 'justify-center px-0' : 'px-4'} ${active ? allowed ? 'bg-blue-50 font-bold text-primary-dark md:border-r-4 md:border-primary' : 'bg-slate-100 text-slate-500' : allowed ? 'text-gray-500 hover:bg-slate-50 hover:text-primary' : 'text-slate-300 hover:bg-slate-50'}`} title={isCollapsed ? `${item.label}${allowed ? '' : ' · Sin permiso'}` : undefined}>
                      <Icon size={20} className={active && allowed ? 'text-primary' : allowed ? 'text-gray-400' : 'text-slate-300'} />
                      {(!isCollapsed || menuOpen) && <><span className="flex-1">{item.label}</span>{!allowed && <LockKeyhole size={15} aria-label="Sin permiso" />}</>}
                    </Link>
                  );
                })}
              </nav>

              <div className="mt-auto border-t border-gray-100 pt-5">
                {(!isCollapsed || menuOpen) && <div className="mb-4"><PwaControls /></div>}
                <div className={`flex items-center ${isCollapsed && !menuOpen ? 'flex-col justify-center gap-3' : 'justify-between'}`}>
                  {(!isCollapsed || menuOpen) && <div className="min-w-0"><p className="truncate text-xs font-bold text-slate-600">{access.name}</p><p className="truncate text-[11px] text-slate-400">DNI: {user.email?.split('@')[0]}</p></div>}
                  <button type="button" onClick={handleLogout} className="flex items-center justify-center gap-2 rounded-lg p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-500" title="Cerrar sesión">{(!isCollapsed || menuOpen) && <span className="text-sm font-medium">Salir</span>}<LogOut size={18} /></button>
                </div>
              </div>
            </div>
          </aside>

          <div className="w-full flex-1 overflow-y-auto p-4 transition-all md:p-10">{page}</div>
          <PwaInstallOnboarding />
        </div>
      </PwaNotificationsProvider>
    </AccessProvider>
  );
}
