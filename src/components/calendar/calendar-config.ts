import type { CategoriaActividad, EstadoActividad, PrioridadActividad } from '@/lib/firebase/types';
import {
  calendarDateInput,
  calendarDateTimeToDate,
  calendarTimeInput,
  toCalendarWallClock,
} from '@/lib/calendar-timezone';

export type CalendarView = 'month' | 'week' | 'day' | 'list';

export const CATEGORY_META: Record<CategoriaActividad, { label: string; dot: string; card: string }> = {
  territorio: { label: 'Territorio', dot: 'bg-blue-500', card: 'border-blue-200 bg-blue-50 text-blue-900' },
  reunion: { label: 'Reunion', dot: 'bg-violet-500', card: 'border-violet-200 bg-violet-50 text-violet-900' },
  comunicacion: { label: 'Comunicacion', dot: 'bg-pink-500', card: 'border-pink-200 bg-pink-50 text-pink-900' },
  capacitacion: { label: 'Capacitacion', dot: 'bg-amber-500', card: 'border-amber-200 bg-amber-50 text-amber-900' },
  electoral: { label: 'Electoral', dot: 'bg-emerald-500', card: 'border-emerald-200 bg-emerald-50 text-emerald-900' },
  logistica: { label: 'Logistica', dot: 'bg-slate-500', card: 'border-slate-200 bg-slate-50 text-slate-900' },
};

export const STATUS_META: Record<EstadoActividad, { label: string; className: string }> = {
  programada: { label: 'Programada', className: 'bg-slate-100 text-slate-700' },
  confirmada: { label: 'Confirmada', className: 'bg-blue-100 text-blue-800' },
  completada: { label: 'Completada', className: 'bg-emerald-100 text-emerald-800' },
  cancelada: { label: 'Cancelada', className: 'bg-red-100 text-red-700' },
};

export const PRIORITY_META: Record<PrioridadActividad, { label: string; className: string }> = {
  baja: { label: 'Baja', className: 'text-slate-500' },
  normal: { label: 'Normal', className: 'text-blue-700' },
  alta: { label: 'Alta', className: 'text-red-700' },
};

export const CATEGORY_OPTIONS = Object.entries(CATEGORY_META) as [
  CategoriaActividad,
  (typeof CATEGORY_META)[CategoriaActividad],
][];

export const STATUS_OPTIONS = Object.entries(STATUS_META) as [
  EstadoActividad,
  (typeof STATUS_META)[EstadoActividad],
][];

export function timestampDate(value: { toDate(): Date } | null | undefined) {
  return value?.toDate?.() ? toCalendarWallClock(value.toDate()) : new Date(0);
}

export function toDateInput(date: Date) {
  return calendarDateInput(date);
}

export function toTimeInput(date: Date) {
  return calendarTimeInput(date);
}

export function combineLocal(date: string, time: string) {
  return calendarDateTimeToDate(date, time || '00:00');
}
