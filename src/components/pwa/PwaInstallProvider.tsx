'use client';

import Image from 'next/image';
import {
  BellRing,
  Download,
  Loader2,
  MonitorSmartphone,
  Share2,
  Smartphone,
  X,
} from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type InstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

type InstallResult = 'accepted' | 'dismissed' | 'manual' | 'installed';

type PwaInstallContextValue = {
  installed: boolean;
  isIOS: boolean;
  canPrompt: boolean;
  installing: boolean;
  onboardingOpen: boolean;
  dismissOnboarding: () => void;
  installApp: () => Promise<InstallResult>;
  openOnboarding: () => void;
};

const DISMISSED_KEY = 'pwa-install-onboarding-dismissed';
const PwaInstallContext = createContext<PwaInstallContextValue | null>(null);

function isStandaloneMode() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

function isAppleMobile() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function PwaInstallProvider({ children }: { children: ReactNode }) {
  const [installed, setInstalled] = useState(
    () => typeof window !== 'undefined' && isStandaloneMode(),
  );
  const [isIOS] = useState(() => typeof navigator !== 'undefined' && isAppleMobile());
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  useEffect(() => {
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setOnboardingOpen(false);
    };

    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const dismissOnboarding = useCallback(() => {
    window.sessionStorage.setItem(DISMISSED_KEY, 'true');
    setOnboardingOpen(false);
  }, []);

  const openOnboarding = useCallback(() => {
    if (!isStandaloneMode()) setOnboardingOpen(true);
  }, []);

  const installApp = useCallback(async (): Promise<InstallResult> => {
    if (installed || isStandaloneMode()) {
      setInstalled(true);
      setOnboardingOpen(false);
      return 'installed';
    }

    if (!installPrompt) {
      setOnboardingOpen(true);
      return 'manual';
    }

    setInstalling(true);
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setInstallPrompt(null);
      if (choice.outcome === 'accepted') {
        setInstalled(true);
        setOnboardingOpen(false);
      } else {
        dismissOnboarding();
      }
      return choice.outcome;
    } finally {
      setInstalling(false);
    }
  }, [dismissOnboarding, installPrompt, installed]);

  const value = useMemo(
    () => ({
      installed,
      isIOS,
      canPrompt: Boolean(installPrompt),
      installing,
      onboardingOpen,
      dismissOnboarding,
      installApp,
      openOnboarding,
    }),
    [
      dismissOnboarding,
      installApp,
      installPrompt,
      installed,
      installing,
      isIOS,
      onboardingOpen,
      openOnboarding,
    ],
  );

  return <PwaInstallContext.Provider value={value}>{children}</PwaInstallContext.Provider>;
}

export function usePwaInstall() {
  const value = useContext(PwaInstallContext);
  if (!value) throw new Error('usePwaInstall debe usarse dentro de PwaInstallProvider.');
  return value;
}

export function PwaInstallOnboarding() {
  const {
    installed,
    isIOS,
    canPrompt,
    installing,
    onboardingOpen,
    dismissOnboarding,
    installApp,
    openOnboarding,
  } = usePwaInstall();

  useEffect(() => {
    if (installed || window.sessionStorage.getItem(DISMISSED_KEY) === 'true') return;
    const timer = window.setTimeout(openOnboarding, 900);
    return () => window.clearTimeout(timer);
  }, [installed, openOnboarding]);

  if (installed || !onboardingOpen) return null;

  const manualInstructions = isIOS
    ? 'En Safari toca Compartir y luego Agregar a pantalla de inicio.'
    : 'Abre el menú del navegador y elige Instalar aplicación o Agregar a pantalla principal.';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/50 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-install-title"
    >
      <button
        type="button"
        aria-label="Cerrar instalación"
        className="absolute inset-0 cursor-default"
        onClick={dismissOnboarding}
      />
      <section className="relative w-full max-w-lg rounded-t-[2rem] bg-white px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 shadow-2xl sm:rounded-[2rem] sm:p-7">
        <button
          type="button"
          onClick={dismissOnboarding}
          aria-label="Ahora no"
          className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-4 pr-10">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-blue-50 p-2 shadow-sm ring-1 ring-blue-100">
            <Image src="/brazo.png" alt="Logo de Karen Acevedo" width={52} height={52} className="h-full w-full object-contain" />
          </div>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary">Aplicación del equipo</p>
            <h2 id="pwa-install-title" className="mt-1 font-heading text-2xl font-black leading-tight text-slate-900">
              Instala la aplicación
            </h2>
          </div>
        </div>

        <p className="mt-5 text-sm leading-6 text-slate-600 sm:text-base">
          Entra más rápido al calendario operativo y mantente al día con las actividades del equipo.
        </p>

        <div className="mt-5 grid grid-cols-3 gap-2">
          {[
            { icon: Smartphone, label: 'Acceso directo' },
            { icon: BellRing, label: 'Avisos del calendario' },
            { icon: MonitorSmartphone, label: 'En cualquier equipo' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="rounded-2xl bg-slate-50 px-2 py-3 text-center ring-1 ring-slate-100">
              <Icon size={20} className="mx-auto text-primary" />
              <span className="mt-2 block text-[11px] font-bold leading-tight text-slate-700 sm:text-xs">{label}</span>
            </div>
          ))}
        </div>

        {!canPrompt && (
          <div className="mt-5 flex gap-3 rounded-2xl bg-blue-50 p-4 text-sm leading-5 text-primary-dark">
            {isIOS ? <Share2 size={20} className="mt-0.5 shrink-0" /> : <Download size={20} className="mt-0.5 shrink-0" />}
            <p>{manualInstructions}</p>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
          {canPrompt ? (
            <button
              type="button"
              onClick={() => void installApp()}
              disabled={installing}
              className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-blue-200 transition hover:bg-primary-dark disabled:opacity-60"
            >
              {installing ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
              Instalar ahora
            </button>
          ) : (
            <button
              type="button"
              onClick={dismissOnboarding}
              className="min-h-12 flex-1 rounded-xl bg-primary px-5 py-3 text-sm font-extrabold text-white transition hover:bg-primary-dark"
            >
              Entendido
            </button>
          )}
          <button
            type="button"
            onClick={dismissOnboarding}
            className="min-h-12 rounded-xl px-5 py-3 text-sm font-bold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          >
            Ahora no
          </button>
        </div>
        <p className="mt-3 text-center text-[11px] leading-4 text-slate-400">
          Después de instalarla, activa los avisos desde el menú de la aplicación.
        </p>
      </section>
    </div>
  );
}
