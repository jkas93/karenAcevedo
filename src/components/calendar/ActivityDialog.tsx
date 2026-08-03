'use client';

import { useState, type FormEvent } from 'react';
import { Timestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  CalendarClock,
  Check,
  Clock3,
  Flag,
  Loader2,
  MapPin,
  Pencil,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import type {
  ActividadCalendario,
  ActividadCalendarioInput,
  CategoriaActividad,
  EstadoActividad,
  PrioridadActividad,
} from '@/lib/firebase/types';
import {
  calendarioService,
  type ResponsableCalendario,
} from '@/lib/firebase/calendario-service';
import {
  CATEGORY_META,
  CATEGORY_OPTIONS,
  combineLocal,
  PRIORITY_META,
  STATUS_META,
  STATUS_OPTIONS,
  timestampDate,
  toDateInput,
  toTimeInput,
} from './calendar-config';

type ActivityDialogProps = {
  activity: ActividadCalendario | null;
  initialDate: Date;
  responsables: ResponsableCalendario[];
  canManage: boolean;
  startInEdit?: boolean;
  onClose(): void;
  onSaved(): void;
  onDeleted(): void;
};

type FormState = {
  titulo: string;
  descripcion: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  todoElDia: boolean;
  ubicacion: string;
  responsableId: string;
  categoria: CategoriaActividad;
  prioridad: PrioridadActividad;
  estado: EstadoActividad;
};

function nextRoundedHour(base: Date) {
  const value = new Date(base);
  value.setMinutes(value.getMinutes() < 30 ? 30 : 60, 0, 0);
  return value;
}

function initialForm(
  activity: ActividadCalendario | null,
  initialDate: Date,
  responsables: ResponsableCalendario[],
): FormState {
  const start = activity ? timestampDate(activity.inicio) : nextRoundedHour(initialDate);
  const end = activity ? timestampDate(activity.fin) : new Date(start.getTime() + 60 * 60_000);
  const defaultResponsible = responsables[0];

  return {
    titulo: activity?.titulo || '',
    descripcion: activity?.descripcion || '',
    fecha: toDateInput(start),
    horaInicio: toTimeInput(start),
    horaFin: toTimeInput(end),
    todoElDia: activity?.todoElDia || false,
    ubicacion: activity?.ubicacion || '',
    responsableId: activity?.responsableId || defaultResponsible?.id || '',
    categoria: activity?.categoria || 'territorio',
    prioridad: activity?.prioridad || 'normal',
    estado: activity?.estado || 'programada',
  };
}

function ActivityDetails({
  activity,
  canManage,
  onEdit,
  onClose,
}: {
  activity: ActividadCalendario;
  canManage: boolean;
  onEdit(): void;
  onClose(): void;
}) {
  const start = timestampDate(activity.inicio);
  const end = timestampDate(activity.fin);
  const category = CATEGORY_META[activity.categoria];
  const status = STATUS_META[activity.estado];

  return (
    <>
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-7">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${category.dot}`} />
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              {category.label}
            </span>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${status.className}`}>
              {status.label}
            </span>
          </div>
          <h2 className="text-xl font-black leading-tight text-slate-900 sm:text-2xl">
            {activity.titulo}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="shrink-0 rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <X size={20} />
        </button>
      </div>

      <div className="space-y-5 overflow-y-auto px-5 py-5 sm:px-7">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex gap-3">
            <CalendarClock size={19} className="mt-0.5 shrink-0 text-primary" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Fecha y hora</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">
                {format(start, "EEEE d 'de' MMMM", { locale: es })}
              </p>
              <p className="text-sm text-slate-600">
                {activity.todoElDia
                  ? 'Todo el dia'
                  : `${format(start, 'HH:mm')} - ${format(end, 'HH:mm')}`}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <UserRound size={19} className="mt-0.5 shrink-0 text-primary" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Responsable</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">
                {activity.responsableNombre}
              </p>
            </div>
          </div>
          {activity.ubicacion && (
            <div className="flex gap-3">
              <MapPin size={19} className="mt-0.5 shrink-0 text-primary" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Lugar</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{activity.ubicacion}</p>
              </div>
            </div>
          )}
          <div className="flex gap-3">
            <Flag size={19} className="mt-0.5 shrink-0 text-primary" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Prioridad</p>
              <p className={`mt-1 text-sm font-bold ${PRIORITY_META[activity.prioridad].className}`}>
                {PRIORITY_META[activity.prioridad].label}
              </p>
            </div>
          </div>
        </div>

        {activity.descripcion && (
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Detalle</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
              {activity.descripcion}
            </p>
          </div>
        )}

        <p className="text-xs text-slate-400">
          Registrado por {activity.creadoPorNombre || activity.creadoPor}
        </p>
      </div>

      {canManage && (
        <div className="border-t border-slate-100 px-5 py-4 sm:px-7">
          <button
            type="button"
            onClick={onEdit}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white transition hover:bg-primary-dark"
          >
            <Pencil size={17} />
            Editar actividad
          </button>
        </div>
      )}
    </>
  );
}

export function ActivityDialog({
  activity,
  initialDate,
  responsables,
  canManage,
  startInEdit = false,
  onClose,
  onSaved,
  onDeleted,
}: ActivityDialogProps) {
  const [editing, setEditing] = useState(!activity || startInEdit);
  const [form, setForm] = useState(() => initialForm(activity, initialDate, responsables));
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null);
  const [error, setError] = useState('');

  if (activity && !editing) {
    return (
      <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-6">
        <div className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-w-2xl sm:rounded-3xl">
          <ActivityDetails
            activity={activity}
            canManage={canManage}
            onEdit={() => setEditing(true)}
            onClose={onClose}
          />
        </div>
      </div>
    );
  }

  const setField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    const start = combineLocal(form.fecha, form.todoElDia ? '00:00' : form.horaInicio);
    const end = combineLocal(form.fecha, form.todoElDia ? '23:59' : form.horaFin);
    if (!form.titulo.trim() || !form.responsableId) {
      setError('Completa el titulo y el responsable.');
      return;
    }
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      setError('La hora de termino debe ser posterior a la hora de inicio.');
      return;
    }

    const responsible = responsables.find((item) => item.id === form.responsableId);
    const input: ActividadCalendarioInput = {
      titulo: form.titulo.trim(),
      descripcion: form.descripcion.trim(),
      inicio: Timestamp.fromDate(start),
      fin: Timestamp.fromDate(end),
      todoElDia: form.todoElDia,
      ubicacion: form.ubicacion.trim(),
      responsableId: form.responsableId,
      responsableNombre: responsible?.nombre || activity?.responsableNombre || form.responsableId,
      categoria: form.categoria,
      prioridad: form.prioridad,
      estado: form.estado,
    };

    setBusy('save');
    try {
      if (activity) await calendarioService.update(activity.id, input);
      else await calendarioService.create(input);
      onSaved();
    } catch (saveError) {
      console.error(saveError);
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar la actividad.');
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!activity || !window.confirm('Esta actividad se eliminara y se notificara al equipo. Continuar?')) return;
    setBusy('delete');
    try {
      await calendarioService.remove(activity.id);
      onDeleted();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'No se pudo eliminar la actividad.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <form
        onSubmit={save}
        className="flex max-h-[94vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-w-3xl sm:rounded-3xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-7">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.17em] text-primary">Calendario operativo</p>
            <h2 className="mt-1 text-xl font-black text-slate-900">
              {activity ? 'Editar actividad' : 'Nueva actividad'}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5 sm:px-7">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Titulo *</span>
              <input
                value={form.titulo}
                onChange={(event) => setField('titulo', event.target.value)}
                maxLength={120}
                required
                autoFocus
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-blue-50"
                placeholder="Ej. Recorrido vecinal en Moron"
              />
            </label>

            <label>
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Fecha *</span>
              <input type="date" value={form.fecha} onChange={(event) => setField('fecha', event.target.value)} required className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-blue-50" />
            </label>

            <label className="flex items-end">
              <span className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
                <input type="checkbox" checked={form.todoElDia} onChange={(event) => setField('todoElDia', event.target.checked)} className="h-4 w-4 accent-primary" />
                Actividad de todo el dia
              </span>
            </label>

            {!form.todoElDia && (
              <>
                <label>
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Hora de inicio *</span>
                  <input type="time" value={form.horaInicio} onChange={(event) => setField('horaInicio', event.target.value)} required className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-blue-50" />
                </label>
                <label>
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Hora de termino *</span>
                  <input type="time" value={form.horaFin} onChange={(event) => setField('horaFin', event.target.value)} required className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-blue-50" />
                </label>
              </>
            )}

            <label>
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Responsable *</span>
              <select value={form.responsableId} onChange={(event) => setField('responsableId', event.target.value)} required className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-blue-50">
                <option value="">Selecciona una persona</option>
                {responsables.map((responsable) => <option key={responsable.id} value={responsable.id}>{responsable.nombre}</option>)}
              </select>
            </label>

            <label>
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Lugar</span>
              <input value={form.ubicacion} onChange={(event) => setField('ubicacion', event.target.value)} maxLength={200} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-blue-50" placeholder="Local, sector o enlace" />
            </label>

            <label>
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Categoria</span>
              <select value={form.categoria} onChange={(event) => setField('categoria', event.target.value as CategoriaActividad)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-blue-50">
                {CATEGORY_OPTIONS.map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
              </select>
            </label>

            <label>
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Prioridad</span>
              <select value={form.prioridad} onChange={(event) => setField('prioridad', event.target.value as PrioridadActividad)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-blue-50">
                {Object.entries(PRIORITY_META).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
              </select>
            </label>

            <label>
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Estado</span>
              <select value={form.estado} onChange={(event) => setField('estado', event.target.value as EstadoActividad)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-blue-50">
                {STATUS_OPTIONS.map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
              </select>
            </label>

            <label className="sm:col-span-2">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Descripcion y acuerdos</span>
              <textarea value={form.descripcion} onChange={(event) => setField('descripcion', event.target.value)} maxLength={2000} rows={4} className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-blue-50" placeholder="Objetivo, materiales, indicaciones o puntos de encuentro..." />
            </label>
          </div>

          {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <div>
            {activity && (
              <button type="button" onClick={remove} disabled={busy !== null} className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50 sm:w-auto">
                {busy === 'delete' ? <Loader2 size={17} className="animate-spin" /> : <Trash2 size={17} />}
                Eliminar
              </button>
            )}
          </div>
          <div className="flex gap-3">
            {activity && <button type="button" onClick={() => setEditing(false)} className="flex-1 rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 sm:flex-none">Cancelar</button>}
            <button type="submit" disabled={busy !== null} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white transition hover:bg-primary-dark disabled:opacity-60 sm:flex-none">
              {busy === 'save' ? <Loader2 size={17} className="animate-spin" /> : activity ? <Check size={17} /> : <Clock3 size={17} />}
              {activity ? 'Guardar cambios' : 'Crear actividad'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
