'use client';

import {
  Bell,
  BellOff,
  Download,
  Loader2,
  Share2,
  Smartphone,
  Users,
  X,
} from 'lucide-react';
import { usePwaInstall } from '@/components/pwa/PwaInstallProvider';
import { usePwaNotifications } from '@/components/pwa/PwaNotificationsProvider';

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
  } = usePwaNotifications();

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
      </div>

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
