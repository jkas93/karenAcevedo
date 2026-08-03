'use client';

import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarX2, Clock3, MapPin, Plus, UserRound } from 'lucide-react';
import type { ActividadCalendario } from '@/lib/firebase/types';
import {
  CATEGORY_META,
  timestampDate,
  type CalendarView,
} from './calendar-config';

type CalendarBoardProps = {
  activities: ActividadCalendario[];
  view: CalendarView;
  cursor: Date;
  selectedDate: Date;
  canManage: boolean;
  onSelectDate(date: Date): void;
  onOpen(activity: ActividadCalendario): void;
  onCreate(date: Date): void;
};

function activitiesForDay(activities: ActividadCalendario[], day: Date) {
  return activities.filter((activity) => isSameDay(timestampDate(activity.inicio), day));
}

function EmptyState({ onCreate, canManage }: { onCreate(): void; canManage: boolean }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-5 text-center">
      <div className="mb-3 rounded-2xl bg-white p-3 text-slate-400 shadow-sm">
        <CalendarX2 size={24} />
      </div>
      <p className="text-sm font-bold text-slate-700">No hay actividades para esta fecha</p>
      <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">
        {canManage ? 'Agrega la coordinacion del equipo y todos la veran en tiempo real.' : 'Cuando se programe una actividad, aparecera aqui.'}
      </p>
      {canManage && (
        <button type="button" onClick={onCreate} className="mt-4 flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white hover:bg-primary-dark">
          <Plus size={15} />
          Crear actividad
        </button>
      )}
    </div>
  );
}

function ActivityCard({
  activity,
  compact = false,
  onOpen,
}: {
  activity: ActividadCalendario;
  compact?: boolean;
  onOpen(): void;
}) {
  const start = timestampDate(activity.inicio);
  const end = timestampDate(activity.fin);
  const category = CATEGORY_META[activity.categoria];
  const cancelled = activity.estado === 'cancelada';

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`w-full overflow-hidden rounded-xl border text-left transition hover:-translate-y-0.5 hover:shadow-md ${category.card} ${compact ? 'p-2' : 'p-3.5'} ${cancelled ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start gap-2">
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${category.dot}`} />
        <div className="min-w-0 flex-1">
          <p className={`truncate font-bold ${compact ? 'text-xs' : 'text-sm'} ${cancelled ? 'line-through' : ''}`}>
            {activity.titulo}
          </p>
          <p className={`mt-1 flex items-center gap-1.5 opacity-75 ${compact ? 'text-[10px]' : 'text-xs'}`}>
            <Clock3 size={compact ? 11 : 13} />
            {activity.todoElDia ? 'Todo el dia' : `${format(start, 'HH:mm')} - ${format(end, 'HH:mm')}`}
          </p>
          {!compact && (
            <div className="mt-2 space-y-1 text-xs opacity-75">
              <p className="flex items-center gap-1.5 truncate"><UserRound size={13} />{activity.responsableNombre}</p>
              {activity.ubicacion && <p className="flex items-center gap-1.5 truncate"><MapPin size={13} />{activity.ubicacion}</p>}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

function DayAgenda({
  day,
  activities,
  canManage,
  onOpen,
  onCreate,
}: {
  day: Date;
  activities: ActividadCalendario[];
  canManage: boolean;
  onOpen(activity: ActividadCalendario): void;
  onCreate(date: Date): void;
}) {
  const dayActivities = activitiesForDay(activities, day);
  return (
    <section>
      <div className="mb-3 flex items-end justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
            {isToday(day) ? 'Hoy' : format(day, 'EEEE', { locale: es })}
          </p>
          <h3 className="mt-1 text-lg font-black capitalize text-slate-900">
            {format(day, "d 'de' MMMM", { locale: es })}
          </h3>
        </div>
        {canManage && (
          <button type="button" onClick={() => onCreate(day)} className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-bold text-primary-dark hover:bg-blue-100">
            <Plus size={15} />
            <span className="hidden sm:inline">Agregar</span>
          </button>
        )}
      </div>
      {dayActivities.length === 0 ? (
        <EmptyState canManage={canManage} onCreate={() => onCreate(day)} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {dayActivities.map((activity) => (
            <ActivityCard key={activity.id} activity={activity} onOpen={() => onOpen(activity)} />
          ))}
        </div>
      )}
    </section>
  );
}

function MonthView(props: CalendarBoardProps) {
  const monthStart = startOfMonth(props.cursor);
  const days = eachDayOfInterval({
    start: startOfWeek(monthStart, { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(props.cursor), { weekStartsOn: 1 }),
  });

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
          {['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'].map((label) => (
            <div key={label} className="px-1 py-2.5 text-center text-[10px] font-black uppercase tracking-wide text-slate-400 sm:text-xs">
              {label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const dayActivities = activitiesForDay(props.activities, day);
            const selected = isSameDay(day, props.selectedDate);
            return (
              <button
                type="button"
                key={day.toISOString()}
                onClick={() => props.onSelectDate(day)}
                className={`relative min-h-16 border-b border-r border-slate-100 p-1 text-left transition hover:bg-blue-50/50 sm:min-h-28 sm:p-2 ${!isSameMonth(day, monthStart) ? 'bg-slate-50/70 text-slate-300' : 'bg-white'} ${selected ? 'ring-2 ring-inset ring-primary' : ''}`}
              >
                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold sm:h-8 sm:w-8 sm:text-sm ${isToday(day) ? 'bg-primary text-white' : ''}`}>
                  {format(day, 'd')}
                </span>
                <div className="mt-1 hidden space-y-1 sm:block">
                  {dayActivities.slice(0, 3).map((activity) => {
                    const meta = CATEGORY_META[activity.categoria];
                    return (
                      <span key={activity.id} className={`block truncate rounded-md border px-1.5 py-1 text-[10px] font-bold ${meta.card} ${activity.estado === 'cancelada' ? 'line-through opacity-60' : ''}`}>
                        {activity.todoElDia ? '' : `${format(timestampDate(activity.inicio), 'HH:mm')} `}{activity.titulo}
                      </span>
                    );
                  })}
                  {dayActivities.length > 3 && <span className="block pl-1 text-[10px] font-bold text-slate-400">+{dayActivities.length - 3} mas</span>}
                </div>
                <div className="absolute bottom-2 left-1/2 flex max-w-[90%] -translate-x-1/2 gap-1 sm:hidden">
                  {dayActivities.slice(0, 4).map((activity) => <span key={activity.id} className={`h-1.5 w-1.5 rounded-full ${CATEGORY_META[activity.categoria].dot}`} />)}
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <DayAgenda day={props.selectedDate} activities={props.activities} canManage={props.canManage} onOpen={props.onOpen} onCreate={props.onCreate} />
    </div>
  );
}

function WeekView(props: CalendarBoardProps) {
  const days = eachDayOfInterval({
    start: startOfWeek(props.cursor, { weekStartsOn: 1 }),
    end: endOfWeek(props.cursor, { weekStartsOn: 1 }),
  });

  return (
    <>
      <div className="hidden grid-cols-7 overflow-hidden rounded-2xl border border-slate-200 bg-white lg:grid">
        {days.map((day) => {
          const items = activitiesForDay(props.activities, day);
          return (
            <div key={day.toISOString()} className="min-h-[440px] border-r border-slate-100 p-2.5 last:border-r-0">
              <button type="button" onClick={() => props.onSelectDate(day)} className="mb-3 flex w-full flex-col items-center rounded-xl py-2 hover:bg-slate-50">
                <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">{format(day, 'EEE', { locale: es })}</span>
                <span className={`mt-1 flex h-9 w-9 items-center justify-center rounded-full text-sm font-black ${isToday(day) ? 'bg-primary text-white' : 'text-slate-800'}`}>{format(day, 'd')}</span>
              </button>
              <div className="space-y-2">
                {items.map((activity) => <ActivityCard key={activity.id} compact activity={activity} onOpen={() => props.onOpen(activity)} />)}
                {items.length === 0 && <p className="py-8 text-center text-[10px] font-medium text-slate-300">Sin actividades</p>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="lg:hidden">
        <div className="mb-5 flex gap-2 overflow-x-auto pb-2">
          {days.map((day) => (
            <button type="button" key={day.toISOString()} onClick={() => props.onSelectDate(day)} className={`min-w-14 rounded-2xl border px-3 py-2.5 text-center transition ${isSameDay(day, props.selectedDate) ? 'border-primary bg-primary text-white shadow-md shadow-blue-100' : 'border-slate-200 bg-white text-slate-600'}`}>
              <span className="block text-[10px] font-black uppercase">{format(day, 'EEE', { locale: es })}</span>
              <span className="mt-1 block text-lg font-black">{format(day, 'd')}</span>
            </button>
          ))}
        </div>
        <DayAgenda day={props.selectedDate} activities={props.activities} canManage={props.canManage} onOpen={props.onOpen} onCreate={props.onCreate} />
      </div>
    </>
  );
}

function ListView(props: CalendarBoardProps) {
  const upcoming = props.activities
    .filter((activity) => timestampDate(activity.fin) >= new Date(props.cursor.getFullYear(), props.cursor.getMonth(), props.cursor.getDate()))
    .slice(0, 80);
  const groups = upcoming.reduce<Map<string, ActividadCalendario[]>>((map, activity) => {
    const key = toDateKey(timestampDate(activity.inicio));
    map.set(key, [...(map.get(key) || []), activity]);
    return map;
  }, new Map());

  if (upcoming.length === 0) return <EmptyState canManage={props.canManage} onCreate={() => props.onCreate(props.cursor)} />;

  return (
    <div className="space-y-6">
      {[...groups.entries()].map(([key, items]) => {
        const day = new Date(`${key}T12:00:00`);
        return (
          <section key={key}>
            <div className="mb-3 flex items-center gap-3">
              <div className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl ${isToday(day) ? 'bg-primary text-white' : 'bg-slate-100 text-slate-700'}`}>
                <span className="text-[9px] font-black uppercase">{format(day, 'MMM', { locale: es })}</span>
                <span className="text-lg font-black leading-none">{format(day, 'd')}</span>
              </div>
              <div>
                <h3 className="text-sm font-black capitalize text-slate-900">{format(day, 'EEEE', { locale: es })}</h3>
                <p className="text-xs text-slate-400">{items.length} {items.length === 1 ? 'actividad' : 'actividades'}</p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {items.map((activity) => <ActivityCard key={activity.id} activity={activity} onOpen={() => props.onOpen(activity)} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function toDateKey(date: Date) {
  return format(date, 'yyyy-MM-dd');
}

export function CalendarBoard(props: CalendarBoardProps) {
  if (props.view === 'month') return <MonthView {...props} />;
  if (props.view === 'week') return <WeekView {...props} />;
  if (props.view === 'list') return <ListView {...props} />;
  return <DayAgenda day={props.selectedDate} activities={props.activities} canManage={props.canManage} onOpen={props.onOpen} onCreate={props.onCreate} />;
}
