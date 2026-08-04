'use client';

import { BellRing, CheckCircle2, Clock3, Loader2, RefreshCw, ShieldAlert, X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authenticatedPost } from '@/lib/firebase/authenticated-request';
import { VAPID_PUBLIC_KEY } from '@/lib/pwa/push-config';
import { usePwaInstall } from '@/components/pwa/PwaInstallProvider';

export type NotificationCoverage = {
  authorizedUsers: number;
  subscribedUsers: number;
  activeDevices: number;
};

type PwaNotificationsContextValue = {
  supported: boolean;
  permission: NotificationPermission;
  pushEnabled: boolean;
  busy: boolean;
  message: string;
  coverage: NotificationCoverage | null;
  enablePush: () => Promise<boolean>;
  disablePush: () => Promise<void>;
  clearMessage: () => void;
  refreshCoverage: () => Promise<void>;
  openOnboarding: () => void;
};

const SERVICE_WORKER_TIMEOUT_MS = 15_000;
const ONBOARDING_DELAY_MS = 1_200;
const SNOOZE_MS = 3 * 24 * 60 * 60 * 1_000;
const SNOOZE_KEY = 'pwa-notification-onboarding-snooze-until';
const PwaNotificationsContext = createContext<PwaNotificationsContextValue | null>(null);

function toUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(normalized);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

function delay(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function getActiveServiceWorkerRegistration() {
  let registration = await navigator.serviceWorker.register('/sw.js', {
    scope: '/',
    updateViaCache: 'none',
  });
  const deadline = Date.now() + SERVICE_WORKER_TIMEOUT_MS;
  let requestedSkipWaiting = false;
  while (Date.now() < deadline) {
    if (registration.active?.state === 'activated') return registration;
    if (registration.waiting && !requestedSkipWaiting) {
      requestedSkipWaiting = true;
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    await delay(100);
    registration = (await navigator.serviceWorker.getRegistration('/')) || registration;
  }
  throw new Error(
    'El servicio de notificaciones sigue preparándose. Recarga la página e intenta nuevamente.',
  );
}

function notificationErrorMessage(error: unknown) {
  const detail = error instanceof Error ? error.message : '';
  if (/no active service worker/i.test(detail)) {
    return 'La aplicación aún está preparando los avisos. Intenta nuevamente.';
  }
  return detail || 'No se pudieron activar los avisos.';
}

async function getOrCreatePushSubscription() {
  let registration = await getActiveServiceWorkerRegistration();
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;
  const options: PushSubscriptionOptionsInit = {
    userVisibleOnly: true,
    applicationServerKey: toUint8Array(VAPID_PUBLIC_KEY),
  };
  try {
    return await registration.pushManager.subscribe(options);
  } catch (error) {
    const detail = error instanceof Error ? error.message : '';
    if (!/no active service worker/i.test(detail)) throw error;
    await delay(400);
    registration = await getActiveServiceWorkerRegistration();
    return (
      (await registration.pushManager.getSubscription()) ||
      (await registration.pushManager.subscribe(options))
    );
  }
}

export function PwaNotificationsProvider({
  children,
  isAdmin,
}: {
  children: ReactNode;
  isAdmin: boolean;
}) {
  const {
    installed,
    isIOS,
    onboardingOpen: installOnboardingOpen,
    openOnboarding: openInstallOnboarding,
  } = usePwaInstall();
  const [supported, setSupported] = useState(false);
  const [ready, setReady] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [serverRegistered, setServerRegistered] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [coverage, setCoverage] = useState<NotificationCoverage | null>(null);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [activationComplete, setActivationComplete] = useState(false);
  const pushEnabled = Boolean(subscription && serverRegistered && permission === 'granted');

  const refreshCoverage = useCallback(async () => {
    if (!isAdmin) return;
    try {
      setCoverage(await authenticatedPost<NotificationCoverage>('/api/push/coverage', {}));
    } catch (error) {
      console.warn('No se pudo consultar la cobertura de avisos:', error);
    }
  }, [isAdmin]);

  useEffect(() => {
    let cancelled = false;
    const setup = async () => {
      const canUsePush =
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window;
      if (!canUsePush) {
        if (!cancelled) setReady(true);
        return;
      }
      if (!cancelled) {
        setSupported(true);
        setPermission(Notification.permission);
      }
      const registration = await getActiveServiceWorkerRegistration();
      let currentSubscription = await registration.pushManager.getSubscription();
      if (Notification.permission === 'granted') {
        currentSubscription =
          currentSubscription || (await getOrCreatePushSubscription());
        await authenticatedPost('/api/push/subscribe', {
          subscription: currentSubscription.toJSON(),
        });
      }
      if (!cancelled) {
        setSubscription(currentSubscription);
        setServerRegistered(
          Boolean(currentSubscription && Notification.permission === 'granted'),
        );
        setReady(true);
      }
    };
    void setup()
      .catch((error) => {
        console.error('No se pudo preparar la PWA:', error);
        if (!cancelled) {
          setServerRegistered(false);
          setMessage(notificationErrorMessage(error));
          setReady(true);
        }
      })
      .finally(() => {
        if (!cancelled) void refreshCoverage();
      });
    return () => {
      cancelled = true;
    };
  }, [refreshCoverage]);

  useEffect(() => {
    if (
      !ready ||
      !supported ||
      pushEnabled ||
      busy ||
      installOnboardingOpen ||
      (isIOS && !installed)
    ) {
      return;
    }
    const snoozeUntil = Number(window.localStorage.getItem(SNOOZE_KEY) || 0);
    if (Number.isFinite(snoozeUntil) && Date.now() < snoozeUntil) return;
    const timer = window.setTimeout(() => {
      setActivationComplete(false);
      setOnboardingOpen(true);
    }, ONBOARDING_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [busy, installOnboardingOpen, installed, isIOS, pushEnabled, ready, supported]);

  const enablePush = useCallback(async () => {
    if (isIOS && !installed) {
      setMessage(
        'En iPhone o iPad, instala primero la aplicación y ábrela desde la pantalla de inicio.',
      );
      setOnboardingOpen(false);
      openInstallOnboarding();
      return false;
    }
    if (!supported) {
      setMessage('Este navegador no admite notificaciones web.');
      return false;
    }

    setBusy(true);
    setMessage('');
    let current: PushSubscription | null = subscription;
    try {
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);
      if (nextPermission !== 'granted') {
        setServerRegistered(false);
        setOnboardingOpen(true);
        setMessage(
          'Los avisos están bloqueados. Habilítalos desde la configuración del sitio en tu navegador.',
        );
        return false;
      }
      current = await getOrCreatePushSubscription();
      await authenticatedPost('/api/push/subscribe', {
        subscription: current.toJSON(),
      });
      setSubscription(current);
      setServerRegistered(true);
      setActivationComplete(true);
      setOnboardingOpen(true);
      window.localStorage.removeItem(SNOOZE_KEY);
      setMessage('Avisos activados para este dispositivo.');
      await refreshCoverage();
      return true;
    } catch (error) {
      if (current) setSubscription(current);
      setServerRegistered(false);
      console.error('No se pudieron activar los avisos:', error);
      setMessage(notificationErrorMessage(error));
      setOnboardingOpen(true);
      return false;
    } finally {
      setBusy(false);
    }
  }, [
    installed,
    isIOS,
    openInstallOnboarding,
    refreshCoverage,
    subscription,
    supported,
  ]);

  const disablePush = useCallback(async () => {
    if (!subscription) return;
    setBusy(true);
    try {
      let removedFromServer = true;
      try {
        await authenticatedPost('/api/push/unsubscribe', {
          endpoint: subscription.endpoint,
        });
      } catch (error) {
        removedFromServer = false;
        console.warn('No se pudo retirar el registro remoto de avisos:', error);
      }
      await subscription.unsubscribe();
      setSubscription(null);
      setServerRegistered(false);
      setActivationComplete(false);
      setMessage(
        removedFromServer
          ? 'Avisos desactivados en este dispositivo.'
          : 'Avisos desactivados en el dispositivo. El registro remoto se limpiará automáticamente.',
      );
      await refreshCoverage();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'No se pudieron desactivar los avisos.',
      );
    } finally {
      setBusy(false);
    }
  }, [refreshCoverage, subscription]);

  const clearMessage = useCallback(() => setMessage(''), []);
  const openOnboarding = useCallback(() => {
    setActivationComplete(false);
    setOnboardingOpen(true);
  }, []);
  const value = useMemo(
    () => ({
      supported,
      permission,
      pushEnabled,
      busy,
      message,
      coverage,
      enablePush,
      disablePush,
      clearMessage,
      refreshCoverage,
      openOnboarding,
    }),
    [
      busy,
      clearMessage,
      coverage,
      disablePush,
      enablePush,
      message,
      openOnboarding,
      permission,
      pushEnabled,
      refreshCoverage,
      supported,
    ],
  );

  const snoozeOnboarding = () => {
    window.localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
    setActivationComplete(false);
    setOnboardingOpen(false);
  };
  const closeOnboarding = () => {
    setActivationComplete(false);
    setOnboardingOpen(false);
  };

  return (
    <PwaNotificationsContext.Provider value={value}>
      {children}
      {onboardingOpen && !installOnboardingOpen && (
        <div
          className='fixed inset-0 z-[110] flex items-end justify-center bg-slate-950/55 sm:items-center sm:p-6'
          role='dialog'
          aria-modal='true'
          aria-labelledby='pwa-notifications-title'
        >
          <button
            type='button'
            aria-label='Cerrar avisos'
            className='absolute inset-0 cursor-default'
            onClick={activationComplete ? closeOnboarding : snoozeOnboarding}
          />
          <section className='relative w-full max-w-lg rounded-t-[2rem] bg-white px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6 shadow-2xl sm:rounded-[2rem] sm:p-7'>
            <button
              type='button'
              onClick={activationComplete ? closeOnboarding : snoozeOnboarding}
              aria-label='Cerrar'
              className='absolute right-4 top-4 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700'
            >
              <X size={20} />
            </button>
            {activationComplete ? (
              <div className='py-3 text-center'>
                <div className='mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/60'>
                  <CheckCircle2 size={42} />
                </div>
                <p className='mt-6 text-xs font-extrabold uppercase tracking-[0.16em] text-emerald-600'>
                  Dispositivo conectado
                </p>
                <h2
                  id='pwa-notifications-title'
                  className='mt-2 font-heading text-2xl font-black text-slate-900'
                >
                  Avisos activados correctamente
                </h2>
                <p className='mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-600'>
                  Este equipo recibirá cambios del calendario, recordatorios y
                  solicitudes de actualización de estado.
                </p>
                <button
                  type='button'
                  onClick={closeOnboarding}
                  className='mt-6 min-h-12 w-full rounded-xl bg-primary px-5 py-3 text-sm font-extrabold text-white transition hover:bg-primary-dark'
                >
                  Listo
                </button>
              </div>
            ) : (
              <NotificationPrompt
                permission={permission}
                busy={busy}
                message={message}
                onEnable={enablePush}
                onSnooze={snoozeOnboarding}
              />
            )}
          </section>
        </div>
      )}
    </PwaNotificationsContext.Provider>
  );
}

function NotificationPrompt({
  permission,
  busy,
  message,
  onEnable,
  onSnooze,
}: {
  permission: NotificationPermission;
  busy: boolean;
  message: string;
  onEnable: () => Promise<boolean>;
  onSnooze: () => void;
}) {
  if (permission !== 'denied') {
    return (
      <DefaultNotificationPrompt
        busy={busy}
        message={message}
        onEnable={onEnable}
        onSnooze={onSnooze}
      />
    );
  }

  return (
    <div>
      <div className='flex items-center gap-4 pr-10'>
        <div className='flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-100'>
          <ShieldAlert size={28} />
        </div>
        <div>
          <p className='text-xs font-extrabold uppercase tracking-[0.16em] text-amber-700'>
            Permiso bloqueado
          </p>
          <h2
            id='pwa-notifications-title'
            className='mt-1 font-heading text-2xl font-black leading-tight text-slate-900'
          >
            Activa los avisos en tu navegador
          </h2>
        </div>
      </div>
      <p className='mt-5 text-sm leading-6 text-slate-600'>
        Abre la configuración de este sitio, cambia Notificaciones a “Permitir” y
        vuelve a esta pantalla. En iPhone o iPad hazlo desde la aplicación
        instalada en la pantalla de inicio.
      </p>
      {message && (
        <p className='mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800'>
          {message}
        </p>
      )}
      <div className='mt-6 flex flex-col gap-2 sm:flex-row-reverse'>
        <button
          type='button'
          onClick={() => void onEnable()}
          disabled={busy}
          className='flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-extrabold text-white transition hover:bg-primary-dark disabled:opacity-60'
        >
          {busy ? (
            <Loader2 size={18} className='animate-spin' />
          ) : (
            <RefreshCw size={18} />
          )}
          Ya lo habilité
        </button>
        <button
          type='button'
          onClick={onSnooze}
          className='min-h-12 rounded-xl px-5 py-3 text-sm font-bold text-slate-500 hover:bg-slate-100'
        >
          Ahora no
        </button>
      </div>
    </div>
  );
}

function DefaultNotificationPrompt({
  busy,
  message,
  onEnable,
  onSnooze,
}: {
  busy: boolean;
  message: string;
  onEnable: () => Promise<boolean>;
  onSnooze: () => void;
}) {
  const benefits = [
    { label: 'Nuevas actividades y cambios importantes', icon: CheckCircle2 },
    { label: 'Recordatorios 24 horas, 1 hora y 15 minutos antes', icon: Clock3 },
    { label: 'Actividades cuyo estado necesita actualizarse', icon: CheckCircle2 },
  ];

  return (
    <div>
      <div className='flex items-center gap-4 pr-10'>
        <div className='flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-primary ring-1 ring-blue-100'>
          <BellRing size={28} />
        </div>
        <div>
          <p className='text-xs font-extrabold uppercase tracking-[0.16em] text-primary'>
            Calendario operativo
          </p>
          <h2
            id='pwa-notifications-title'
            className='mt-1 font-heading text-2xl font-black leading-tight text-slate-900'
          >
            Mantente informado
          </h2>
        </div>
      </div>
      <p className='mt-5 text-sm leading-6 text-slate-600'>
        Activa los avisos en este dispositivo para estar al tanto aunque la
        aplicación esté cerrada.
      </p>
      <div className='mt-5 space-y-2.5'>
        {benefits.map(({ label, icon: Icon }) => (
          <div
            key={label}
            className='flex items-center gap-3 rounded-xl bg-slate-50 px-3.5 py-3 text-sm font-semibold text-slate-700'
          >
            <Icon size={18} className='shrink-0 text-primary' />
            {label}
          </div>
        ))}
      </div>
      {message && (
        <p className='mt-4 rounded-xl bg-red-50 p-3 text-xs leading-5 text-red-700'>
          {message}
        </p>
      )}
      <div className='mt-6 flex flex-col gap-2 sm:flex-row-reverse'>
        <button
          type='button'
          onClick={() => void onEnable()}
          disabled={busy}
          className='flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-blue-200 transition hover:bg-primary-dark disabled:opacity-60'
        >
          {busy ? (
            <Loader2 size={18} className='animate-spin' />
          ) : (
            <BellRing size={18} />
          )}
          Activar avisos
        </button>
        <button
          type='button'
          onClick={onSnooze}
          className='min-h-12 rounded-xl px-5 py-3 text-sm font-bold text-slate-500 hover:bg-slate-100'
        >
          Ahora no
        </button>
      </div>
      <p className='mt-3 text-center text-[11px] leading-4 text-slate-400'>
        El navegador solo mostrará su permiso después de tocar “Activar avisos”.
      </p>
    </div>
  );
}

export function usePwaNotifications() {
  const value = useContext(PwaNotificationsContext);
  if (!value) {
    throw new Error('usePwaNotifications debe usarse dentro de PwaNotificationsProvider.');
  }
  return value;
}
