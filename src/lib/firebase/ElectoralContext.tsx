'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { electoralService, type UsuarioResumen } from './electoral-service';
import type { Acta, LocalVotacion, Mesa, RolUsuario } from './types';

interface ElectoralContextType {
  locales: LocalVotacion[];
  mesas: Mesa[];
  actas: Acta[];
  digitadores: UsuarioResumen[];
  loading: boolean;
}

const ElectoralContext = createContext<ElectoralContextType>({
  locales: [],
  mesas: [],
  actas: [],
  digitadores: [],
  loading: true,
});

export function ElectoralProvider({
  children,
  role,
}: {
  children: ReactNode;
  role: RolUsuario;
}) {
  const [locales, setLocales] = useState<LocalVotacion[]>([]);
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [actas, setActas] = useState<Acta[]>([]);
  const [digitadores, setDigitadores] = useState<UsuarioResumen[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const privileged = role === 'administrador' || role === 'candidata';
    const expectedSubscriptions = privileged ? 4 : 2;
    const loadedSubscriptions = new Set<string>();
    const unsubscribers: Array<() => void> = [];

    const markLoaded = (key: string) => {
      loadedSubscriptions.add(key);
      if (loadedSubscriptions.size >= expectedSubscriptions) {
        setLoading(false);
      }
    };

    const handleError = (key: string) => (error: Error) => {
      console.error(`Error en suscripción electoral (${key}):`, error);
      markLoaded(key);
    };

    unsubscribers.push(
      electoralService.subscribeToLocales(
        (data) => {
          setLocales(data);
          markLoaded('locales');
        },
        handleError('locales'),
      ),
      electoralService.subscribeToMesas(
        (data) => {
          setMesas(data);
          markLoaded('mesas');
        },
        handleError('mesas'),
      ),
    );

    if (privileged) {
      unsubscribers.push(
        electoralService.subscribeToActas(
          (data) => {
            setActas(data);
            markLoaded('actas');
          },
          handleError('actas'),
        ),
        electoralService.getDigitadores(
          (data) => {
            setDigitadores(data);
            markLoaded('digitadores');
          },
          handleError('digitadores'),
        ),
      );
    }

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [role]);

  return (
    <ElectoralContext.Provider
      value={{ locales, mesas, actas, digitadores, loading }}
    >
      {children}
    </ElectoralContext.Provider>
  );
}

export const useElectoral = () => useContext(ElectoralContext);
