import { db } from '@/lib/firebase';
import { 
  collection, 
  doc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';
import type { ActividadAgenda } from './types';

const COLLECTION_NAME = 'agenda';

export const agendaService = {
  // Suscribirse a cambios en tiempo real (para el dashboard y web pública)
  subscribe: (onData: (actividades: ActividadAgenda[]) => void, onError?: (err: Error) => void) => {
    const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
    
    return onSnapshot(
      q,
      (snapshot) => {
        const actividades: ActividadAgenda[] = [];
        snapshot.forEach((docSnap) => {
          actividades.push({ id: docSnap.id, ...docSnap.data() } as ActividadAgenda);
        });
        onData(actividades);
      },
      (error) => {
        console.error("Error al suscribirse a agenda:", error);
        if (onError) onError(error);
      }
    );
  },

  // Obtener de una sola vez (útil para la web pública si se prefiere no usar websockets)
  getActividades: async (): Promise<ActividadAgenda[]> => {
    try {
      const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const actividades: ActividadAgenda[] = [];
      snapshot.forEach((docSnap) => {
        actividades.push({ id: docSnap.id, ...docSnap.data() } as ActividadAgenda);
      });
      return actividades;
    } catch (error) {
      console.error("Error obteniendo agenda:", error);
      return [];
    }
  },

  // Agregar nueva actividad
  crearActividad: async (actividad: Omit<ActividadAgenda, 'id' | 'createdAt'>): Promise<string> => {
    try {
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...actividad,
        createdAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (error) {
      console.error("Error creando actividad:", error);
      throw error;
    }
  },

  // Actualizar actividad
  actualizarActividad: async (id: string, actividad: Partial<Omit<ActividadAgenda, 'id' | 'createdAt'>>): Promise<void> => {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, actividad);
    } catch (error) {
      console.error("Error actualizando actividad:", error);
      throw error;
    }
  },

  // Eliminar actividad
  eliminarActividad: async (id: string): Promise<void> => {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error("Error eliminando actividad:", error);
      throw error;
    }
  }
};
