'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  addDays,
  addMonths,
  addWeeks,
  format,
  subDays,
  subMonths,
  subWeeks,
} from 'date-fns';
import { es } from 'date-fns/locale';
import {
  BellRing,
  ChevronLeft,
  ChevronRight,
  Eye,
  LayoutList,
  Loader2,
  Plus,
  Sparkles,
} from 'lucide-react';
import {
  calendarioService,
  type ResponsableCalendario,
} from '@/lib/firebase/calendario-service';
import type {
  ActividadCalendario,
  CategoriaActividad,
} from '@/lib/firebase/types';
import { ActivityDialog } from '@/components/calendar/ActivityDialog';
import { CalendarBoard } from '@/components/calendar/CalendarBoard';
import {
  CATEGORY_OPTIONS,
  timestampDate,
  type CalendarView,
} from '@/components/calendar/calendar-config';

import { usePwaNotifications } from '@/components/pwa/PwaNotificationsProvider';
import { useAccess } from '@/components/access/AccessContext';
import { calendarNow } from '@/lib/calendar-timezone';

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
  const { coverage } = usePwaNotifications();
  const { hasPermission } = useAccess();
  const [activities, setActivities] = useState<ActividadCalendario[]>([]);
  const [responsables, setResponsables] = useState<ResponsableCalendario[]>([]);
  const [view, setView] = useState<CalendarView>('month');
  const [cursor, setCursor] = useState(calendarNow);
  const [selectedDate, setSelectedDate] = useState(calendarNow);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [category, setCategory] = useState<CategoriaActividad | 'todas'>('todas');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const deepLinkHandled = useRef(false);

  const canManage = hasPermission('calendar.manage');
  const canViewCoverage = hasPermission('users.view');

  useEffect(() => {
    if (canManage) {
      calendarioService.getResponsables()
        .then(setResponsables)
        .catch(() => setError('No se pudo cargar la lista de responsables.'));
    }

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
      unsubscribeCalendar();
    };
  }, [canManage]);


  const filteredActivities = useMemo(() => {
    if (category === 'todas') return activities;
    return activities.filter((activity) => activity.categoria === category);
  }, [activities, category]);

  const goToToday = () => {
    const today = calendarNow();
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

      <section className="mb-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:mb-5 sm:p-4">
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

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <div className="grid grid-cols-4 rounded-xl bg-slate-100 p-1">
              {VIEWS.map((item) => (
                <button key={item.value} type="button" onClick={() => setView(item.value)} className={`rounded-lg px-2.5 py-2 text-[11px] font-bold transition sm:px-3 ${view === item.value ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                  {item.label}
                </button>
              ))}
            </div>

          </div>
        </div>
      </section>

      <div className="mb-5 hidden gap-2 overflow-x-auto pb-1 sm:flex">
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

      {canViewCoverage && coverage && (
        <div className='mt-3 text-center text-xs font-bold text-primary-dark'>
          Cobertura de avisos: {coverage.subscribedUsers} de{' '}
          {coverage.authorizedUsers} usuarios · {coverage.activeDevices}{' '}
          dispositivos activos
        </div>
      )}

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
