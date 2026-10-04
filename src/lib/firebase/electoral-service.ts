import {
  collection,
  getDocs,
  onSnapshot,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Acta, LocalVotacion, Mesa, Personero, Usuario } from './types';

export type { LocalVotacion, Mesa, Acta, Personero } from './types';
export type UsuarioResumen = Pick<Usuario, 'id' | 'uid' | 'nombre' | 'dni' | 'rol'>;

const localesRef = collection(db, 'locales');
const mesasRef = collection(db, 'mesas');
const actasRef = collection(db, 'actas');
const personerosRef = collection(db, 'personeros');

import { authenticatedPost } from './authenticated-request';

type SubscriptionErrorHandler = (error: Error) => void;

function dateFromTimestamp(value: unknown): Date {
  return value instanceof Timestamp ? value.toDate() : new Date(0);
}

export const electoralService = {
  getLocales: async (): Promise<LocalVotacion[]> => {
    const snapshot = await getDocs(localesRef);
    return snapshot.docs.map(
      (document) => ({ id: document.id, ...document.data() }) as LocalVotacion,
    );
  },

  subscribeToLocales: (
    callback: (locales: LocalVotacion[]) => void,
    onError?: SubscriptionErrorHandler,
  ) =>
    onSnapshot(
      localesRef,
      (snapshot) => {
        callback(
          snapshot.docs.map(
            (document) =>
              ({ id: document.id, ...document.data() }) as LocalVotacion,
          ),
        );
      },
      (error) => onError?.(error),
    ),

  getMesasPorLocal: async (localId: string): Promise<Mesa[]> => {
    const mesasQuery = query(mesasRef, where('local_id', '==', localId));
    const snapshot = await getDocs(mesasQuery);
    return snapshot.docs.map(
      (document) => ({ id: document.id, ...document.data() }) as Mesa,
    );
  },

  subscribeToMesas: (
    callback: (mesas: Mesa[]) => void,
    onError?: SubscriptionErrorHandler,
  ) =>
    onSnapshot(
      mesasRef,
      (snapshot) => {
        callback(
          snapshot.docs.map(
            (document) => ({ id: document.id, ...document.data() }) as Mesa,
          ),
        );
      },
      (error) => onError?.(error),
    ),

  subscribeToActas: (
    callback: (actas: Acta[]) => void,
    onError?: SubscriptionErrorHandler,
  ) =>
    onSnapshot(
      actasRef,
      (snapshot) => {
        callback(
          snapshot.docs.map((document) => {
            const data = document.data();
            return {
              id: document.id,
              ...data,
              timestamp: dateFromTimestamp(data.timestamp),
            } as Acta;
          }),
        );
      },
      (error) => onError?.(error),
    ),

  fetchPersoneros: async (): Promise<Personero[]> => {
    try {
      const res = await authenticatedPost<{ success: boolean; personeros: Personero[] }>(
        '/api/electoral/personeros',
        { action: 'list' }
      );
      if (res?.personeros) {
        return res.personeros.map((p) => ({
          ...p,
          created_at: p.created_at ? new Date(p.created_at) : undefined,
          updated_at: p.updated_at ? new Date(p.updated_at) : undefined,
        }));
      }
    } catch (e) {
      console.warn('Error al cargar personeros por API:', e);
    }
    return [];
  },

  subscribeToPersoneros: (
    callback: (personeros: Personero[]) => void,
    onError?: SubscriptionErrorHandler,
  ) => {
    authenticatedPost<{ success: boolean; personeros: Personero[] }>(
      '/api/electoral/personeros',
      { action: 'list' }
    )
      .then((res) => {
        if (res?.personeros && res.personeros.length > 0) {
          callback(
            res.personeros.map((p) => ({
              ...p,
              created_at: p.created_at ? new Date(p.created_at) : undefined,
              updated_at: p.updated_at ? new Date(p.updated_at) : undefined,
            }))
          );
        }
      })
      .catch((err) => {
        console.warn('Fallback API personeros:', err);
      });

    return onSnapshot(
      personerosRef,
      (snapshot) => {
        callback(
          snapshot.docs.map((document) => {
            const data = document.data();
            return {
              id: document.id,
              ...data,
              created_at: dateFromTimestamp(data.created_at),
              updated_at: dateFromTimestamp(data.updated_at),
            } as Personero;
          }),
        );
      },
      (error) => {
        console.warn('onSnapshot personeros warning:', error);
        authenticatedPost<{ success: boolean; personeros: Personero[] }>(
          '/api/electoral/personeros',
          { action: 'list' }
        )
          .then((res) => {
            if (res?.personeros) {
              callback(
                res.personeros.map((p) => ({
                  ...p,
                  created_at: p.created_at ? new Date(p.created_at) : undefined,
                  updated_at: p.updated_at ? new Date(p.updated_at) : undefined,
                }))
              );
            }
          })
          .catch(() => {})
          .finally(() => {
            onError?.(error);
          });
      },
    );
  },

  getDigitadores: (
    callback: (digitadores: UsuarioResumen[]) => void,
    onError?: SubscriptionErrorHandler,
  ) => {
    const usuariosRef = collection(db, 'usuarios');
    const digitadoresQuery = query(usuariosRef, where('rol', '==', 'digitador'));

    return onSnapshot(
      digitadoresQuery,
      (snapshot) => {
        callback(
          snapshot.docs.map(
            (document) =>
              ({ id: document.id, ...document.data() }) as UsuarioResumen,
          ),
        );
      },
      (error) => onError?.(error),
    );
  },
};
