'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  ReactNode,
} from 'react';
import { electoralService } from './electoral-service';
import type { LocalVotacion, Mesa, Acta } from './types';

// ─── Tipos del contexto ───────────────────────────────────────────────────────

interface ElectoralContextType {
  locales: LocalVotacion[];
  mesas: Mesa[];
  actas: Acta[];
  digitadores: any[];
  loading: boolean;
}

// ─── Contexto con valores vacíos por defecto ──────────────────────────────────

const ElectoralContext = createContext<ElectoralContextType>({
  locales: [],
  mesas: [],
  actas: [],
  digitadores: [],
  loading: true,
});

// ─── Provider ────────────────────────────────────────────────────────────────

export function ElectoralProvider({ children }: { children: ReactNode }) {
  const [locales, setLocales] = useState<LocalVotacion[]>([]);
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [actas, setActas] = useState<Acta[]>([]);
  const [digitadores, setDigitadores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Usamos un ref para contar cuántas colecciones ya emitieron su primer snapshot
  // y solo entonces ponemos loading=false (evita mostrar UIs vacías brevemente)
  const loadedCount = useRef(0);

  const markLoaded = () => {
    loadedCount.current += 1;
    if (loadedCount.current >= 4) setLoading(false);
  };

  useEffect(() => {
    // UNA SOLA suscripción a cada colección, compartida por todos los módulos del dashboard
    const unsubLocales = electoralService.subscribeToLocales((data) => {
      setLocales(data);
      markLoaded();
    });

    const unsubMesas = electoralService.subscribeToMesas((data) => {
      setMesas(data);
      markLoaded();
    });

    const unsubActas = electoralService.subscribeToActas((data) => {
      setActas(data);
      markLoaded();
    });

    const unsubDigitadores = electoralService.getDigitadores((data) => {
      setDigitadores(data);
      markLoaded();
    });

    // Cleanup: desuscribir cuando el layout se desmonta
    return () => {
      unsubLocales();
      unsubMesas();
      unsubActas();
      unsubDigitadores();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ElectoralContext.Provider value={{ locales, mesas, actas, digitadores, loading }}>
      {children}
    </ElectoralContext.Provider>
  );
}

// ─── Hook de consumo ─────────────────────────────────────────────────────────

export const useElectoral = () => useContext(ElectoralContext);
