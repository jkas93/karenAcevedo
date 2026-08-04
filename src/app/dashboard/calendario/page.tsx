'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  addDays,
  addMonths,
  addWeeks,
  format,
  isSameDay,
  startOfToday,
  subDays,
  subMonths,
  subWeeks,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import {
  BellRing,
  ChevronLeft,
  ChevronRight,
  Eye,
  LayoutList,
  Loader2,
  Plus,
  Search,
  Sparkles,
} from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import {
  calendarioService,
  type ResponsableCalendario,
} from '@/lib/firebase/calendario-service';
import type {
  ActividadCalendario,
  CategoriaActividad,
  RolUsuario,
} from '@/lib/firebase/types';
import { ActivityDialog } from '@/components/calendar/ActivityDialog';
import { CalendarBoard } from '@/components/calendar/CalendarBoard';
import {
  CATEGORY_OPTIONS,
  timestampDate,
  type CalendarView,
} from '@/components/calendar/calendar-config';

type DialogState = {
  activity: ActividadCalendario | null;
  date: Date;
  startInEdit: boolean;
};

const VIEWS: { value: CalendarView; label: string }[] = [
  { value: 'month', label: 'Mes' },
  { value: 'week', label: 'Semana' },
  { value: 'day', label: 'Dia' },
  { value: 'list', label: 'Lista' },
];

function periodLabel(view: CalendarView, date: Date) {
  if (view === 'day') return format(date, "EEEE d 'de' MMMM", { locale: es });
  if (view === 'week') {
    const monday = subDays(date, (date.getDay() + 6) % 7);
    return `${format(monday, 'd MMM', { locale: es })} - ${format(addDays(monday, 6), 'd MMM yyyy', { locale: es })}`;
  }
  if (view === 'list') return 'Proximas actividades';
  return format(date, 'MMMM yyyy', { locale: es });
}

function moveDate(date: Date, view: CalendarView, direction: -1 | 1) {
  if (view === 'month') return direction === 1 ? addMonths(date, 1) : subMonths(date, 1);
  if (view === 'week') return direction === 1 ? addWeeks(date, 1) : subWeeks(date, 1);
  return direction === 1 ? addDays(date, 1) : subDays(date, 1);
}

export default function CalendarioPage() {
  const [activities, setActivities] = useState<ActividadCalendario[]>([]);
  const [responsables, setResponsables] = useState<ResponsableCalendario[]>([]);
  const [view, setView] = useState<CalendarView>('month');
  const [cursor, setCursor] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [role, setRole] = useState<RolUsuario | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CategoriaActividad | 'todas'>('todas');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const deepLinkHandled = useRef(false);

  const canManage = role === 'administrador' || role === 'candidata';

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user?.email) return;
      try {
        const email = user.email.trim().toLowerCase();
        const profile = await getDoc(doc(db, 'usuarios', email));
        const profileRole = profile.data()?.rol as RolUsuario | undefined;
        if (!profileRole) throw new Error('No se encontro el perfil del usuario.');
        setRole(profileRole);
        if (profileRole === 'administrador' || profileRole === 'candidata') {
          setResponsables(await calendarioService.getResponsables());
        }
      } catch (profileError) {
        setError(profileError instanceof Error ? profileError.message : 'No se pudo cargar tu perfil.');
      }
    });

    const unsubscribeCalendar = calendarioService.subscribe(
      (data) => {
        if (!deepLinkHandled.current) {
          const id = new URLSearchParams(window.location.search).get('actividad');
          const activity = id ? data.find((item) => item.id === id) : undefined;
          if (activity) {
            const date = timestampDate(activity.inicio);
            setSelectedDate(date);
            setCursor(date);
            setDialog({ activity, date, startInEdit: false });
          }
          deepLinkHandled.current = true;
        }
        setActivities(data);
        setLoading(false);
      },
      () => {
        setError('No se pudo cargar el calendario. Revisa tu conexion e intenta nuevamente.');
        setLoading(false);
      },
    );

    return () => {
      unsubscribeAuth();
      unsubscribeCalendar();
    };
  }, []);


  const filteredActivities = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es');
    return activities.filter((activity) => {
      if (category !== 'todas' && activity.categoria !== category) return false;
      if (!term) return true;
      return [
        activity.titulo,
        activity.descripcion,
        activity.ubicacion,
        activity.responsableNombre,
      ].some((value) => value.toLocaleLowerCase('es').includes(term));
    });
  }, [activities, category, search]);

  const todayCount = activities.filter((activity) => isSameDay(timestampDate(activity.inicio), new Date())).length;
  const pendingCount = activities.filter((activity) => timestampDate(activity.fin) >= startOfToday() && activity.estado !== 'cancelada' && activity.estado !== 'completada').length;

  const goToToday = () => {
    const today = new Date();
    setCursor(today);
    setSelectedDate(today);
  };

  const navigate = (direction: -1 | 1) => {
    const next = moveDate(cursor, view, direction);
    setCursor(next);
    setSelectedDate(next);
  };

  const selectDate = (date: Date) => {
    setSelectedDate(date);
    if (view !== 'month') setCursor(date);
  };

  const openActivity = (activity: ActividadCalendario) => {
    setDialog({ activity, date: timestampDate(activity.inicio), startInEdit: false });
  };

  const createActivity = (date: Date) => {
    if (!canManage) return;
    setDialog({ activity: null, date, startInEdit: true });
  };

  return (
    <div className="mx-auto max-w-[1600px] pb-20">
      <header className="mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-[#004f8d] via-primary to-[#0798cf] p-5 text-white shadow-xl shadow-blue-100 sm:p-7 lg:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold backdrop-blur">
              <Sparkles size={14} className="text-secondary" />
              Coordinacion interna del equipo
            </div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl lg:text-4xl">
              Calendario operativo
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-blue-50 sm:text-base">
              Organiza actividades diarias, responsables y puntos de encuentro. Los cambios se actualizan en tiempo real para todos los usuarios.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:flex">
            <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur sm:min-w-32">
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-100">Hoy</p>
              <p className="mt-1 text-2xl font-black">{todayCount}</p>
              <p className="text-[11px] text-blue-100">actividades</p>
            </div>
            <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur sm:min-w-32">
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-100">Pendientes</p>
              <p className="mt-1 text-2xl font-black">{pendingCount}</p>
              <p className="text-[11px] text-blue-100">por realizar</p>
            </div>
          </div>
        </div>
      </header>

      <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <button type="button" onClick={goToToday} className="shrink-0 rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-primary">
              Hoy
            </button>
            <div className="flex shrink-0">
              <button type="button" onClick={() => navigate(-1)} aria-label="Periodo anterior" className="rounded-l-xl border border-r-0 border-slate-200 p-2.5 text-slate-500 hover:bg-slate-50 hover:text-primary"><ChevronLeft size={18} /></button>
              <button type="button" onClick={() => navigate(1)} aria-label="Periodo siguiente" className="rounded-r-xl border border-slate-200 p-2.5 text-slate-500 hover:bg-slate-50 hover:text-primary"><ChevronRight size={18} /></button>
            </div>
            <h2 className="min-w-0 truncate pl-1 text-sm font-black capitalize text-slate-900 sm:text-lg">
              {periodLabel(view, cursor)}
            </h2>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="grid grid-cols-4 rounded-xl bg-slate-100 p-1">
              {VIEWS.map((item) => (
                <button key={item.value} type="button" onClick={() => setView(item.value)} className={`rounded-lg px-2.5 py-2 text-[11px] font-bold transition sm:px-3 ${view === item.value ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                  {item.label}
                </button>
              ))}
            </div>
            {canManage ? (
              <button type="button" onClick={() => createActivity(selectedDate)} className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-100 transition hover:bg-primary-dark">
                <Plus size={17} />
                Nueva actividad
              </button>
            ) : (
              <span className="flex items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-500">
                <Eye size={15} />
                Acceso de lectura
              </span>
            )}
          </div>
        </div>

        <div className="mt-3 grid gap-3 border-t border-slate-100 pt-3 md:grid-cols-[minmax(0,1fr)_220px]">
          <label className="relative">
            <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por actividad, lugar o responsable..." className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-blue-50" />
          </label>
          <select value={category} onChange={(event) => setCategory(event.target.value as CategoriaActividad | 'todas')} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 outline-none focus:border-primary focus:ring-4 focus:ring-blue-50">
            <option value="todas">Todas las categorias</option>
            {CATEGORY_OPTIONS.map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
          </select>
        </div>
      </section>

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {CATEGORY_OPTIONS.map(([value, meta]) => (
          <button key={value} type="button" onClick={() => setCategory(category === value ? 'todas' : value)} className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold transition ${category === value ? meta.card : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}>
            <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
            {meta.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[420px] items-center justify-center rounded-3xl border border-slate-200 bg-white">
          <div className="text-center">
            <Loader2 size={32} className="mx-auto animate-spin text-primary" />
            <p className="mt-3 text-sm font-semibold text-slate-500">Cargando calendario...</p>
          </div>
        </div>
      ) : (
        <CalendarBoard
          activities={filteredActivities}
          view={view}
          cursor={cursor}
          selectedDate={selectedDate}
          canManage={canManage}
          onSelectDate={selectDate}
          onOpen={openActivity}
          onCreate={createActivity}
        />
      )}

      <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-sm text-blue-900 sm:flex-row sm:items-center">
        <div className="rounded-xl bg-white p-2.5 text-primary shadow-sm"><BellRing size={20} /></div>
        <div className="flex-1">
          <p className="font-bold">Recibe cambios y recordatorios en tu celular</p>
          <p className="mt-0.5 text-xs leading-relaxed text-blue-700">Instala la aplicacion y activa los avisos desde el menu lateral. Te avisaremos de cambios, actividades proximas y estados pendientes de actualizar.</p>
        </div>
        <LayoutList size={20} className="hidden text-blue-300 sm:block" />
      </div>

      {dialog && (
        <ActivityDialog
          key={dialog.activity?.id || `new-${dialog.date.toISOString()}`}
          activity={dialog.activity}
          initialDate={dialog.date}
          responsables={responsables}
          canManage={canManage}
          startInEdit={dialog.startInEdit}
          onClose={() => setDialog(null)}
          onSaved={() => setDialog(null)}
          onDeleted={() => setDialog(null)}
        />
      )}
    </div>
  );
}
