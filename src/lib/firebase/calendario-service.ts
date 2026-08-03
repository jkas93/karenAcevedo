import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type {
  ActividadCalendario,
  ActividadCalendarioInput,
  RolUsuario,
} from './types';

const COLLECTION_NAME = 'calendario_actividades';

export type ResponsableCalendario = {
  id: string;
  nombre: string;
  rol: RolUsuario;
};

function currentIdentity() {
  const user = auth.currentUser;
  const email = user?.email?.trim().toLowerCase();
  if (!user || !email) {
    throw new Error('Tu sesion vencio. Vuelve a iniciar sesion.');
  }

  return {
    email,
    nombre: user.displayName?.trim() || `DNI ${email.split('@')[0]}`,
  };
}

export const calendarioService = {
  subscribe(
    onData: (actividades: ActividadCalendario[]) => void,
    onError?: (error: Error) => void,
  ) {
    const activitiesQuery = query(
      collection(db, COLLECTION_NAME),
      orderBy('inicio', 'asc'),
    );

    return onSnapshot(
      activitiesQuery,
      (snapshot) => {
        onData(
          snapshot.docs.map((snapshotDoc) => ({
            id: snapshotDoc.id,
            ...snapshotDoc.data(),
          })) as ActividadCalendario[],
        );
      },
      (error) => {
        console.error('Error al consultar el calendario operativo:', error);
        onError?.(error);
      },
    );
  },

  async getResponsables(): Promise<ResponsableCalendario[]> {
    const snapshot = await getDocs(
      query(collection(db, 'usuarios'), orderBy('nombre', 'asc')),
    );

    return snapshot.docs.map((snapshotDoc) => ({
      id: snapshotDoc.id,
      nombre: String(snapshotDoc.data().nombre || snapshotDoc.id.split('@')[0]),
      rol: snapshotDoc.data().rol as RolUsuario,
    }));
  },

  async create(input: ActividadCalendarioInput): Promise<string> {
    const identity = currentIdentity();
    const activityRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...input,
      creadoPor: identity.email,
      creadoPorNombre: identity.nombre,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return activityRef.id;
  },

  async update(id: string, input: ActividadCalendarioInput): Promise<void> {
    await updateDoc(doc(db, COLLECTION_NAME, id), {
      ...input,
      updatedAt: serverTimestamp(),
    });
  },

  async remove(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
  },
};
