import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { app, db } from '../firebase';
import type { Acta, LocalVotacion, Mesa, Usuario } from './types';

export type { LocalVotacion, Mesa, Acta } from './types';
export type UsuarioResumen = Pick<Usuario, 'id' | 'uid' | 'nombre' | 'dni' | 'rol'>;

const localesRef = collection(db, 'locales');
const mesasRef = collection(db, 'mesas');
const actasRef = collection(db, 'actas');

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

  guardarActa: async (acta: Omit<Acta, 'id' | 'timestamp'>) => {
    const batch = writeBatch(db);
    const actaRef = doc(db, 'actas', acta.mesa_id);
    const mesaRef = doc(db, 'mesas', acta.mesa_id);

    batch.set(actaRef, {
      ...acta,
      timestamp: serverTimestamp(),
    });
    batch.update(mesaRef, { estado: 'enviada' });
    await batch.commit();
  },

  subirFotoActa: async (archivo: File, mesaId: string): Promise<string> => {
    if (!archivo.type.startsWith('image/')) {
      throw new Error('El archivo del acta debe ser una imagen.');
    }
    if (archivo.size > 10 * 1024 * 1024) {
      throw new Error('La imagen del acta no debe superar los 10 MB.');
    }

    const storage = getStorage(app);
    const nombreArchivo = `actas/${mesaId}_${Date.now()}.webp`;
    const storageRef = ref(storage, nombreArchivo);
    await uploadBytes(storageRef, archivo, { contentType: 'image/webp' });
    return getDownloadURL(storageRef);
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
