'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  eachDayOfInterval,
  endOfWeek,
  format,
  isSameDay,
  isSameWeek,
  isToday,
  startOfWeek,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { Clock3, MapPin, Plus, UserRound } from 'lucide-react';
import type { ActividadCalendario } from '@/lib/firebase/types';
import { CATEGORY_META, timestampDate } from './calendar-config';

const START_HOUR = 6;
const END_HOUR = 23;
const HOUR_HEIGHT = 72;
const DAY_MIN_WIDTH = 96;
const GUTTER_WIDTH = 64;
const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60;
const GRID_HEIGHT = (END_HOUR - START_HOUR) * HOUR_HEIGHT;

type WeekTimeGridProps = {
  activities: ActividadCalendario[];
  cursor: Date;
  selectedDate: Date;
  canManage: boolean;
  onSelectDate(date: Date): void;
  onOpen(activity: ActividadCalendario): void;
  onCreate(date: Date): void;
};

type PositionedActivity = {
  activity: ActividadCalendario;
  startMinute: number;
  endMinute: number;
  column: number;
  columnCount: number;
};

function minuteOfDay(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

function timedActivitiesForDay(activities: ActividadCalendario[], day: Date) {
  const rangeStart = START_HOUR * 60;
  const rangeEnd = END_HOUR * 60;
  const normalized = activities
    .filter((activity) => !activity.todoElDia && isSameDay(timestampDate(activity.inicio), day))
    .map((activity) => ({
      activity,
      startMinute: Math.max(rangeStart, minuteOfDay(timestampDate(activity.inicio))),
      endMinute: Math.min(rangeEnd, minuteOfDay(timestampDate(activity.fin))),
      column: 0,
      columnCount: 1,
    }))
    .filter((item) => item.endMinute > rangeStart && item.startMinute < rangeEnd)
    .sort((a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute);

  const positioned: PositionedActivity[] = [];
  let group: typeof normalized = [];
  let groupEnd = -1;

  const flushGroup = () => {
    if (group.length === 0) return;
    let active: Array<{ endMinute: number; column: number }> = [];
    let columnCount = 1;

    group.forEach((item) => {
      active = active.filter((entry) => entry.endMinute > item.startMinute);
      const occupied = new Set(active.map((entry) => entry.column));
      let column = 0;
      while (occupied.has(column)) column += 1;
      item.column = column;
      active.push({ endMinute: item.endMinute, column });
      columnCount = Math.max(columnCount, active.length, column + 1);
    });

    group.forEach((item) => positioned.push({ ...item, columnCount }));
    group = [];
    groupEnd = -1;
  };

  normalized.forEach((item) => {
    if (group.length > 0 && item.startMinute >= groupEnd) flushGroup();
    group.push(item);
    groupEnd = Math.max(groupEnd, item.endMinute);
  });
  flushGroup();
  return positioned;
}

function hourLabel(hour: number) {
  return format(new Date(2026, 0, 1, hour), 'h a', { locale: es })
    .replace('a. m.', 'a. m.')
    .replace('p. m.', 'p. m.');
}

export function WeekTimeGrid(props: WeekTimeGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => new Date());
  const cursorTime = props.cursor.getTime();
  const weekStart = useMemo(
    () => startOfWeek(new Date(cursorTime), { weekStartsOn: 1 }),
    [cursorTime],
  );
  const days = useMemo(() => eachDayOfInterval({
    start: weekStart,
    end: endOfWeek(weekStart, { weekStartsOn: 1 }),
  }), [weekStart]);
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, index) => START_HOUR + index);
  const halfHourSlots = Array.from({ length: (END_HOUR - START_HOUR) * 2 }, (_, index) => index);
  const gridTemplateColumns = `${GUTTER_WIDTH}px repeat(7, minmax(${DAY_MIN_WIDTH}px, 1fr))`;
  const minimumWidth = GUTTER_WIDTH + DAY_MIN_WIDTH * 7;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const selectedIndex = Math.max(0, days.findIndex((day) => isSameDay(day, props.selectedDate)));
    const selectedHeader = container.querySelector<HTMLElement>(`[data-week-day="${selectedIndex}"]`);
    let horizontalFrame = 0;
    if (selectedHeader && container.clientWidth < minimumWidth) {
      const targetLeft = Math.max(0, selectedHeader.offsetLeft - GUTTER_WIDTH - 20);
      horizontalFrame = window.requestAnimationFrame(() => {
        container.scrollLeft = targetLeft;
      });
    }

    const currentTime = new Date();
    const targetHour = isSameWeek(currentTime, weekStart, { weekStartsOn: 1 })
      ? Math.max(START_HOUR, Math.min(END_HOUR - 1, currentTime.getHours()))
      : 8;
    container.scrollTop = Math.max(0, (targetHour - START_HOUR) * HOUR_HEIGHT - 90);
    return () => window.cancelAnimationFrame(horizontalFrame);
  }, [days, minimumWidth, props.selectedDate, weekStart]);

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3 text-xs text-slate-500 sm:px-5">
        <p className="font-semibold">Vista semanal por horas</p>
        <p className="hidden text-right sm:block">Toca un espacio libre para programar una actividad.</p>
        <p className="text-right sm:hidden">Desliza para ver la semana →</p>
      </div>

      <div ref={scrollRef} className="relative max-h-[72vh] overflow-auto overscroll-contain scroll-smooth">
        <div style={{ minWidth: minimumWidth }}>
          <div className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
            <div className="grid" style={{ gridTemplateColumns }}>
              <div className="sticky left-0 z-50 border-r border-slate-100 bg-white" />
              {days.map((day, index) => {
                const selected = isSameDay(day, props.selectedDate);
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    data-week-day={index}
                    onClick={() => props.onSelectDate(day)}
                    className={`border-r border-slate-100 px-2 py-3 text-center transition last:border-r-0 ${selected ? 'bg-blue-50/80' : 'hover:bg-slate-50'}`}
                  >
                    <span className={`block text-[10px] font-black uppercase tracking-[0.14em] ${isToday(day) ? 'text-primary' : 'text-slate-400'}`}>
                      {format(day, 'EEE', { locale: es })}
                    </span>
                    <span className={`mx-auto mt-1.5 flex h-9 w-9 items-center justify-center rounded-full text-sm font-black ${isToday(day) ? 'bg-primary text-white shadow-md shadow-blue-200' : selected ? 'bg-white text-primary ring-2 ring-primary/20' : 'text-slate-800'}`}>
                      {format(day, 'd')}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="grid min-h-12 border-t border-slate-100" style={{ gridTemplateColumns }}>
              <div className="sticky left-0 z-50 flex items-center justify-end border-r border-slate-100 bg-white px-2 text-[9px] font-black uppercase tracking-wide text-slate-400">
                Todo el día
              </div>
              {days.map((day) => {
                const allDay = props.activities.filter((activity) => activity.todoElDia && isSameDay(timestampDate(activity.inicio), day));
                return (
                  <div key={day.toISOString()} className="min-w-0 space-y-1 border-r border-slate-100 p-1.5 last:border-r-0">
                    {allDay.slice(0, 2).map((activity) => {
                      const category = CATEGORY_META[activity.categoria];
                      return (
                        <button key={activity.id} type="button" onClick={() => props.onOpen(activity)} className={`block w-full truncate rounded-lg border px-2 py-1 text-left text-[10px] font-bold ${category.card} ${activity.estado === 'cancelada' ? 'line-through opacity-60' : ''}`}>
                          {activity.titulo}
                        </button>
                      );
                    })}
                    {allDay.length > 2 && <p className="px-1 text-[9px] font-bold text-slate-400">+{allDay.length - 2} más</p>}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid" style={{ gridTemplateColumns, height: GRID_HEIGHT }}>
            <div className="sticky left-0 z-30 border-r border-slate-200 bg-white">
              {hours.map((hour) => (
                <span key={hour} className="absolute right-2 -translate-y-1/2 whitespace-nowrap text-[10px] font-semibold text-slate-400 sm:text-[11px]" style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}>
                  {hourLabel(hour)}
                </span>
              ))}
            </div>

            {days.map((day) => {
              const positioned = timedActivitiesForDay(props.activities, day);
              const today = isToday(day);
              const selected = isSameDay(day, props.selectedDate);
              const currentMinute = minuteOfDay(now) - START_HOUR * 60;
              const showCurrentTime = today && currentMinute >= 0 && currentMinute <= TOTAL_MINUTES;

              return (
                <div
                  key={day.toISOString()}
                  className={`relative border-r border-slate-200 last:border-r-0 ${selected ? 'bg-blue-50/25' : 'bg-white'}`}
                  style={{
                    backgroundImage: `repeating-linear-gradient(to bottom, rgb(226 232 240) 0, rgb(226 232 240) 1px, transparent 1px, transparent ${HOUR_HEIGHT}px), repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR_HEIGHT / 2 - 1}px, rgb(241 245 249) ${HOUR_HEIGHT / 2}px, transparent ${HOUR_HEIGHT / 2 + 1}px, transparent ${HOUR_HEIGHT}px)`,
                  }}
                >
                  <div className="absolute inset-0 grid" style={{ gridTemplateRows: `repeat(${halfHourSlots.length}, ${HOUR_HEIGHT / 2}px)` }}>
                    {halfHourSlots.map((slot) => {
                      const slotDate = new Date(day);
                      slotDate.setHours(START_HOUR + Math.floor(slot / 2), slot % 2 === 0 ? 0 : 30, 0, 0);
                      return (
                        <button
                          key={slot}
                          type="button"
                          disabled={!props.canManage}
                          onClick={() => {
                            props.onSelectDate(slotDate);
                            props.onCreate(slotDate);
                          }}
                          aria-label={`Crear actividad el ${format(slotDate, "EEEE d 'de' MMMM 'a las' HH:mm", { locale: es })}`}
                          className="group relative disabled:cursor-default"
                        >
                          {props.canManage && <Plus size={13} className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 text-blue-300 group-hover:block" />}
                        </button>
                      );
                    })}
                  </div>

                  {positioned.map(({ activity, startMinute, endMinute, column, columnCount }) => {
                    const start = timestampDate(activity.inicio);
                    const end = timestampDate(activity.fin);
                    const category = CATEGORY_META[activity.categoria];
                    const top = ((startMinute - START_HOUR * 60) / 60) * HOUR_HEIGHT;
                    const height = Math.max(30, ((endMinute - startMinute) / 60) * HOUR_HEIGHT - 2);
                    const width = 100 / columnCount;
                    return (
                      <button
                        key={activity.id}
                        type="button"
                        onClick={() => props.onOpen(activity)}
                        className={`absolute z-20 overflow-hidden rounded-lg border px-1.5 py-1 text-left shadow-sm transition hover:z-30 hover:shadow-md ${category.card} ${activity.estado === 'cancelada' ? 'opacity-60' : ''}`}
                        style={{
                          top: top + 1,
                          height,
                          left: `calc(${column * width}% + 2px)`,
                          width: `calc(${width}% - 4px)`,
                        }}
                        title={`${activity.titulo} · ${format(start, 'HH:mm')}–${format(end, 'HH:mm')}`}
                      >
                        <p className={`truncate text-[10px] font-black leading-tight sm:text-[11px] ${activity.estado === 'cancelada' ? 'line-through' : ''}`}>{activity.titulo}</p>
                        <p className="mt-0.5 flex items-center gap-1 truncate text-[9px] font-semibold opacity-75"><Clock3 size={9} />{format(start, 'HH:mm')}–{format(end, 'HH:mm')}</p>
                        {height >= 58 && <p className="mt-1 flex items-center gap-1 truncate text-[9px] opacity-70"><UserRound size={9} />{activity.responsableNombre}</p>}
                        {height >= 82 && activity.ubicacion && <p className="mt-1 flex items-center gap-1 truncate text-[9px] opacity-70"><MapPin size={9} />{activity.ubicacion}</p>}
                      </button>
                    );
                  })}

                  {showCurrentTime && (
                    <div className="pointer-events-none absolute left-0 right-0 z-30 h-0.5 bg-red-500" style={{ top: (currentMinute / 60) * HOUR_HEIGHT }}>
                      <span className="absolute -left-1.5 -top-1.5 h-3 w-3 rounded-full border-2 border-white bg-red-500 shadow" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
