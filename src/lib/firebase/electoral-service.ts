import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { app, db } from '../firebase';

// Re-exportar los tipos desde la fuente central de verdad
export type { LocalVotacion, Mesa, Acta } from './types';
import type { LocalVotacion, Mesa, Acta } from './types';

// Referencias a colecciones
const localesRef = collection(db, 'locales');
const mesasRef = collection(db, 'mesas');
const actasRef = collection(db, 'actas');

// Servicios electorales
export const electoralService = {
  // ─── Locales ──────────────────────────────────────────────────────────────

  /** Obtener todos los locales (one-shot, para el mapa) */
  getLocales: async (): Promise<LocalVotacion[]> => {
    const snapshot = await getDocs(localesRef);
    return snapshot.docs.map(
      (d) => ({ id: d.id, ...d.data() }) as LocalVotacion
    );
  },

  /** Suscripción en tiempo real a locales */
  subscribeToLocales: (callback: (locales: LocalVotacion[]) => void) => {
    return onSnapshot(localesRef, (snapshot) => {
      const locales = snapshot.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as LocalVotacion
      );
      callback(locales);
    });
  },

  // ─── Mesas ────────────────────────────────────────────────────────────────

  /** Obtener mesas por local (one-shot) */
  getMesasPorLocal: async (localId: string): Promise<Mesa[]> => {
    const q = query(mesasRef, where('local_id', '==', localId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Mesa);
  },

  /** Suscripción en tiempo real a todas las mesas */
  subscribeToMesas: (callback: (mesas: Mesa[]) => void) => {
    return onSnapshot(mesasRef, (snapshot) => {
      const mesas = snapshot.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as Mesa
      );
      callback(mesas);
    });
  },
  // (Lógica de asignación de mesa a personero eliminada - flujo centralizado)

  // ─── Actas ────────────────────────────────────────────────────────────────

  /** Suscripción en tiempo real a todas las actas (para el totalizador) */
  subscribeToActas: (callback: (actas: Acta[]) => void) => {
    return onSnapshot(actasRef, (snapshot) => {
      const actas = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        timestamp: (d.data().timestamp as Timestamp).toDate(),
      })) as Acta[];
      callback(actas);
    });
  },

  /**
   * Guardar un acta enviada por un personero.
   * Simultáneamente actualiza el estado de la mesa a "enviada".
   */
  guardarActa: async (acta: Omit<Acta, 'id' | 'timestamp'>) => {
    const nuevoActaRef = doc(actasRef);
    await setDoc(nuevoActaRef, {
      ...acta,
      timestamp: Timestamp.now(),
    });
    // Marcar la mesa como enviada
    const mesaRef = doc(db, 'mesas', acta.mesa_id);
    await updateDoc(mesaRef, { estado: 'enviada' });
  },

  /** Subir foto del acta (comprimida a WebP) a Firebase Storage */
  subirFotoActa: async (archivo: File, mesaId: string): Promise<string> => {
    const storage = getStorage(app);
    const nombreArchivo = `actas/${mesaId}_${Date.now()}.webp`;
    const storageRef = ref(storage, nombreArchivo);
    await uploadBytes(storageRef, archivo);
    return getDownloadURL(storageRef);
  },

  // ─── Digitadores (usuarios con rol=digitador) ───────────────────────────────

  /** Suscripción en tiempo real a usuarios con rol "digitador" */
  getDigitadores: (callback: (digitadores: any[]) => void) => {
    const usuariosRef = collection(db, 'usuarios');
    const q = query(usuariosRef, where('rol', '==', 'digitador'));
    return onSnapshot(q, (snapshot) => {
      const digitadores = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      callback(digitadores);
    });
  },
};
