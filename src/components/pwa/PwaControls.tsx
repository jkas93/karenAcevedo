'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff, Download, Loader2, Share2, Smartphone, X } from 'lucide-react';
import { authenticatedPost } from '@/lib/firebase/authenticated-request';
import { VAPID_PUBLIC_KEY } from '@/lib/pwa/push-config';

type InstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

function toUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(normalized);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

function isStandaloneMode() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

function isAppleMobile() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function PwaControls() {
  const [supported, setSupported] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [serverRegistered, setServerRegistered] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [busy, setBusy] = useState<'install' | 'push' | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const setup = async () => {
      setInstalled(isStandaloneMode());
      setIsIOS(isAppleMobile());
      if (
        !('serviceWorker' in navigator) ||
        !('PushManager' in window) ||
        !('Notification' in window)
      ) return;

      setSupported(true);
      setPermission(Notification.permission);
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none',
      });
      const currentSubscription = await registration.pushManager.getSubscription();
      setSubscription(currentSubscription);

      if (currentSubscription && Notification.permission === 'granted') {
        try {
          await authenticatedPost('/api/push/subscribe', {
            subscription: currentSubscription.toJSON(),
          });
          setServerRegistered(true);
        } catch (error) {
          setServerRegistered(false);
          setMessage(
            error instanceof Error
              ? `El dispositivo conserva el permiso, pero no pudo registrarse: ${error.message}`
              : 'El dispositivo conserva el permiso, pero no pudo registrarse.',
          );
        }
      }
    };

    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setMessage('Aplicacion instalada correctamente.');
    };

    void setup().catch((error) => {
      console.error('No se pudo preparar la PWA:', error);
    });
    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const installApp = async () => {
    if (installed) return;
    if (!installPrompt) {
      setMessage(
        isIOS
          ? 'En Safari toca Compartir y luego Agregar a pantalla de inicio.'
          : 'Abre el menu del navegador y elige Instalar aplicacion.',
      );
      return;
    }

    setBusy('install');
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') setInstalled(true);
      setInstallPrompt(null);
    } finally {
      setBusy(null);
    }
  };

  const enablePush = async () => {
    if (isIOS && !installed) {
      setMessage('En iPhone o iPad, instala primero la aplicacion y abrela desde la pantalla de inicio.');
      return;
    }

    if (!supported) {
      setMessage('Este navegador no admite notificaciones web.');
      return;
    }

    setBusy('push');
    let current: PushSubscription | null = subscription;
    try {
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);
      if (nextPermission !== 'granted') {
        setServerRegistered(false);
        setMessage('Debes permitir notificaciones desde la configuracion del navegador.');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      current =
        (await registration.pushManager.getSubscription()) ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: toUint8Array(VAPID_PUBLIC_KEY),
        }));
      await authenticatedPost('/api/push/subscribe', {
        subscription: current.toJSON(),
      });
      setSubscription(current);
      setServerRegistered(true);
      setMessage('Avisos activados para este dispositivo.');
    } catch (error) {
      if (current) setSubscription(current);
      setServerRegistered(false);
      console.error('No se pudieron activar los avisos:', error);
      setMessage(error instanceof Error ? error.message : 'No se pudieron activar los avisos.');
    } finally {
      setBusy(null);
    }
  };

  const disablePush = async () => {
    if (!subscription) return;
    setBusy('push');
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
      setMessage(
        removedFromServer
          ? 'Avisos desactivados en este dispositivo.'
          : 'Avisos desactivados en el dispositivo. El registro remoto se limpiara automaticamente.',
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudieron desactivar los avisos.');
    } finally {
      setBusy(null);
    }
  };

  const pushEnabled = Boolean(
    subscription && serverRegistered && permission === 'granted',
  );

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-2">
        {!installed && (
          <button
            type="button"
            onClick={installApp}
            disabled={busy !== null}
            className="flex w-full items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5 text-left text-xs font-bold text-primary-dark transition hover:border-blue-200 hover:bg-blue-100 disabled:opacity-60"
          >
            {busy === 'install' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            <span>Instalar aplicaci&oacute;n</span>
          </button>
        )}
        {supported && (
          <button
            type="button"
            onClick={pushEnabled ? disablePush : enablePush}
            disabled={busy !== null}
            className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-xs font-bold transition disabled:opacity-60 ${
              pushEnabled
                ? 'border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                : 'border-amber-100 bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
          >
            {busy === 'push' ? (
              <Loader2 size={16} className="animate-spin" />
            ) : pushEnabled ? (
              <Bell size={16} />
            ) : (
              <BellOff size={16} />
            )}
            <span>
              {pushEnabled
                ? 'Avisos activados'
                : subscription
                  ? 'Reintentar avisos'
                  : 'Activar avisos'}
            </span>
          </button>
        )}
      </div>

      {message && (
        <div className="relative rounded-xl bg-slate-100 p-3 pr-8 text-xs leading-relaxed text-slate-600">
          <span className="mb-1 flex items-center gap-1.5 font-bold text-slate-800">
            {isIOS ? <Share2 size={14} /> : <Smartphone size={14} />}
            Aplicaci&oacute;n del equipo
          </span>
          {message}
          <button
            type="button"
            onClick={() => setMessage('')}
            aria-label="Cerrar mensaje"
            className="absolute right-2 top-2 rounded p-1 text-slate-400 hover:bg-white hover:text-slate-700"
          >
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
