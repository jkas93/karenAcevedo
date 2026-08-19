'use client';

import {
  Bell,
  BellOff,
  Download,
  Loader2,
  Save,
  Settings2,
  Share2,
  Smartphone,
  Users,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { usePwaInstall } from '@/components/pwa/PwaInstallProvider';
import { usePwaNotifications } from '@/components/pwa/PwaNotificationsProvider';
import {
  NOTIFICATION_CATEGORY_VALUES,
  REMINDER_MINUTE_VALUES,
  type NotificationCategory,
  type NotificationPreferences,
  type ReminderMinute,
} from '@/lib/pwa/notification-preferences';

const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  territorio: 'Territorio', reunion: 'Reuniones', comunicacion: 'Comunicación',
  capacitacion: 'Capacitación', electoral: 'Electoral', logistica: 'Logística',
};
const REMINDER_LABELS: Record<ReminderMinute, string> = { 1440: '24 h', 60: '1 h', 15: '15 min' };

export function PwaControls() {
  const { installed, isIOS, installing, installApp } = usePwaInstall();
  const {
    supported,
    pushEnabled,
    busy,
    message,
    coverage,
    enablePush,
    disablePush,
    clearMessage,
    preferences,
    savingPreferences,
    updatePreferences,
  } = usePwaNotifications();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draft, setDraft] = useState<NotificationPreferences | null>(null);

  const toggleList = <T extends string | number,>(values: T[], value: T) =>
    values.includes(value) ? values.filter((item) => item !== value) : [...values, value];

  return (
    <div className='space-y-2'>
      <div className='grid grid-cols-1 gap-2'>
        {!installed && (
          <button
            type='button'
            onClick={() => void installApp()}
            disabled={busy || installing}
            className='flex w-full items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5 text-left text-xs font-bold text-primary-dark transition hover:border-blue-200 hover:bg-blue-100 disabled:opacity-60'
          >
            {installing ? (
              <Loader2 size={16} className='animate-spin' />
            ) : (
              <Download size={16} />
            )}
            <span>Instalar aplicación</span>
          </button>
        )}
        {supported && (
          <button
            type='button'
            onClick={() => void (pushEnabled ? disablePush() : enablePush())}
            disabled={busy || installing}
            className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-xs font-bold transition disabled:opacity-60 ${
              pushEnabled
                ? 'border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                : 'border-amber-100 bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
          >
            {busy ? (
              <Loader2 size={16} className='animate-spin' />
            ) : pushEnabled ? (
              <Bell size={16} />
            ) : (
              <BellOff size={16} />
            )}
            <span>{pushEnabled ? 'Avisos activados' : 'Activar avisos'}</span>
          </button>
        )}
        {pushEnabled && (
          <button
            type='button'
            onClick={() => {
              if (!settingsOpen) setDraft(preferences);
              setSettingsOpen(!settingsOpen);
            }}
            className='flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-xs font-bold text-slate-700 transition hover:bg-slate-50'
            aria-expanded={settingsOpen}
          >
            <Settings2 size={16} />
            Preferencias de este dispositivo
          </button>
        )}
      </div>

      {pushEnabled && settingsOpen && draft && (
        <section className='space-y-4 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700'>
          <p className='font-extrabold text-slate-900'>Qué avisos recibir</p>
          <div className='grid grid-cols-1 gap-2'>
            {([
              ['changes', 'Cambios del calendario'],
              ['reminders', 'Recordatorios próximos'],
              ['statusRequests', 'Solicitudes de actualizar estado'],
              ['onlyRelevant', 'Solo actividades relevantes para mí'],
            ] as const).map(([key, label]) => (
              <label key={key} className='flex items-center gap-2'>
                <input type='checkbox' checked={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: event.target.checked })} />
                {label}
              </label>
            ))}
          </div>
          <fieldset>
            <legend className='mb-2 font-bold'>Anticipación</legend>
            <div className='flex flex-wrap gap-3'>
              {REMINDER_MINUTE_VALUES.map((minutes) => (
                <label key={minutes} className='flex items-center gap-1.5'>
                  <input type='checkbox' checked={draft.reminderMinutes.includes(minutes)} onChange={() => setDraft({ ...draft, reminderMinutes: toggleList(draft.reminderMinutes, minutes) })} />
                  {REMINDER_LABELS[minutes]}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className='mb-2 font-bold'>Categorías</legend>
            <div className='grid grid-cols-2 gap-2'>
              {NOTIFICATION_CATEGORY_VALUES.map((category) => (
                <label key={category} className='flex items-center gap-1.5'>
                  <input type='checkbox' checked={draft.categories.includes(category)} onChange={() => setDraft({ ...draft, categories: toggleList(draft.categories, category) })} />
                  {CATEGORY_LABELS[category]}
                </label>
              ))}
            </div>
          </fieldset>
          <div className='space-y-2 border-t border-slate-100 pt-3'>
            <label className='flex items-center gap-2 font-bold'>
              <input type='checkbox' checked={draft.quietHours.enabled} onChange={(event) => setDraft({ ...draft, quietHours: { ...draft.quietHours, enabled: event.target.checked } })} />
              Horario silencioso
            </label>
            {draft.quietHours.enabled && (
              <>
                <div className='flex items-center gap-2'>
                  <input aria-label='Inicio del horario silencioso' type='time' value={draft.quietHours.start} onChange={(event) => setDraft({ ...draft, quietHours: { ...draft.quietHours, start: event.target.value } })} className='rounded-lg border border-slate-200 px-2 py-1.5' />
                  <span>a</span>
                  <input aria-label='Fin del horario silencioso' type='time' value={draft.quietHours.end} onChange={(event) => setDraft({ ...draft, quietHours: { ...draft.quietHours, end: event.target.value } })} className='rounded-lg border border-slate-200 px-2 py-1.5' />
                </div>
                <label className='flex items-center gap-2'>
                  <input type='checkbox' checked={draft.quietHours.allowCritical} onChange={(event) => setDraft({ ...draft, quietHours: { ...draft.quietHours, allowCritical: event.target.checked } })} />
                  Permitir avisos críticos durante ese horario
                </label>
              </>
            )}
          </div>
          <button
            type='button'
            disabled={savingPreferences}
            onClick={() => void updatePreferences(draft).catch(() => undefined)}
            className='flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 font-extrabold text-white disabled:opacity-60'
          >
            {savingPreferences ? <Loader2 size={15} className='animate-spin' /> : <Save size={15} />}
            Guardar preferencias
          </button>
          <p className='text-[10px] leading-4 text-slate-400'>Estas preferencias se aplican solo a este navegador o dispositivo.</p>
        </section>
      )}

      {coverage && (
        <div className='rounded-xl border border-slate-100 bg-white px-3 py-2.5 text-[11px] leading-5 text-slate-500'>
          <span className='flex items-center gap-1.5 font-bold text-slate-700'>
            <Users size={13} className='text-primary' />
            Cobertura de avisos
          </span>
          <span className='mt-0.5 block'>
            {coverage.subscribedUsers} de {coverage.authorizedUsers} usuarios ·{' '}
            {coverage.activeDevices} dispositivos
          </span>
        </div>
      )}

      {message && (
        <div className='relative rounded-xl bg-slate-100 p-3 pr-8 text-xs leading-relaxed text-slate-600'>
          <span className='mb-1 flex items-center gap-1.5 font-bold text-slate-800'>
            {isIOS ? <Share2 size={14} /> : <Smartphone size={14} />}
            Aplicación del equipo
          </span>
          {message}
          <button
            type='button'
            onClick={clearMessage}
            aria-label='Cerrar mensaje'
            className='absolute right-2 top-2 rounded p-1 text-slate-400 hover:bg-white hover:text-slate-700'
          >
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
