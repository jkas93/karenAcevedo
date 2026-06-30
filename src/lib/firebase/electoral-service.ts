import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  Timestamp,
  updateDoc
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { app, db } from '../firebase'; // Importando desde firebase.ts

// Tipos
export type Zona = {
  id: string;
  nombre: string;
  color: string;
};

export type LocalVotacion = {
  id: string;
  nombre: string;
  direccion: string;
  latitud: number;
  longitud: number;
  zona_id: string;
  total_mesas: number;
};

export type Mesa = {
  id: string;
  numero: string;
  local_id: string;
  personero_uid: string;
  estado: 'pendiente' | 'enviada';
};

export type Acta = {
  id: string;
  mesa_id: string;
  votos_partido_a: number; // Tu partido
  votos_partido_b: number; // Rival
  votos_blancos: number;
  votos_nulos: number;
  foto_url?: string;
  timestamp: Date;
};

// Referencias a Colecciones
const zonasRef = collection(db, 'zonas');
const localesRef = collection(db, 'locales');
const mesasRef = collection(db, 'mesas');
const actasRef = collection(db, 'actas');

// Servicios
export const electoralService = {
  // Obtener todos los locales (Para el mapa)
  getLocales: async (): Promise<LocalVotacion[]> => {
    const snapshot = await getDocs(localesRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LocalVotacion));
  },

  // Obtener locales en tiempo real
  subscribeToLocales: (callback: (locales: LocalVotacion[]) => void) => {
    return onSnapshot(localesRef, (snapshot) => {
      const locales = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LocalVotacion));
      callback(locales);
    });
  },

  // Obtener mesas por local
  getMesasPorLocal: async (localId: string): Promise<Mesa[]> => {
    const q = query(mesasRef, where("local_id", "==", localId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Mesa));
  },

  // Obtener mesas en tiempo real (Para pintar colores en el mapa según el progreso)
  subscribeToMesas: (callback: (mesas: Mesa[]) => void) => {
    return onSnapshot(mesasRef, (snapshot) => {
      const mesas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Mesa));
      callback(mesas);
    });
  },

  // Obtener actas en tiempo real (Para el totalizador)
  subscribeToActas: (callback: (actas: Acta[]) => void) => {
    return onSnapshot(actasRef, (snapshot) => {
      const actas = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: (doc.data().timestamp as Timestamp).toDate()
      } as Acta));
      callback(actas);
    });
  },

  // Guardar un acta enviada por un personero
  guardarActa: async (acta: Omit<Acta, 'id' | 'timestamp'>) => {
    const nuevoActaRef = doc(actasRef); // Genera ID automático
    await setDoc(nuevoActaRef, {
      ...acta,
      timestamp: Timestamp.now()
    });

    // Actualizar el estado de la mesa a "enviada"
    const mesaRef = doc(db, 'mesas', acta.mesa_id);
    await updateDoc(mesaRef, { estado: 'enviada' });
  },

  // Subir foto comprimida (WebP) a Firebase Storage
  subirFotoActa: async (archivo: File, mesaId: string): Promise<string> => {
    const storage = getStorage(app);
    const nombreArchivo = `actas/${mesaId}_${Date.now()}.webp`;
    const storageRef = ref(storage, nombreArchivo);
    
    await uploadBytes(storageRef, archivo);
    const downloadUrl = await getDownloadURL(storageRef);
    return downloadUrl;
  },

  // Obtener la mesa asignada a un personero logueado
  obtenerMesaAsignada: async (personeroUid: string): Promise<Mesa | null> => {
    const q = query(mesasRef, where("personero_uid", "==", personeroUid));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const docData = snapshot.docs[0];
      return { id: docData.id, ...docData.data() } as Mesa;
    }
    return null;
  },

  // Obtener todos los usuarios que son personeros
  getPersoneros: (callback: (personeros: any[]) => void) => {
    const usuariosRef = collection(db, 'usuarios');
    const q = query(usuariosRef, where("rol", "==", "personero"));
    return onSnapshot(q, (snapshot) => {
      const personeros = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(personeros);
    });
  },

  // Crear un nuevo personero (Crea Auth User y Documento)
  crearPersonero: async (datos: { nombre: string, dni: string, telefono: string, contrasena: string }) => {
    const email = `${datos.dni}@fuerzaciudadana.pe`;
    
    // 1. Crear usuario en Auth usando la API REST (para no desloguear al admin actual)
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    const authRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: datos.contrasena, returnSecureToken: true })
    });
    
    const authData = await authRes.json();
    if (authData.error) {
      throw new Error(authData.error.message);
    }
    
    const uid = authData.localId;

    // 2. Crear documento en Firestore
    const userRef = doc(db, 'usuarios', email);
    await setDoc(userRef, {
      uid,
      nombre: datos.nombre,
      dni: datos.dni,
      telefono: datos.telefono,
      rol: 'personero',
      fecha_creacion: Timestamp.now()
    });
    
    return uid;
  },

  // Asignar una mesa a un personero
  asignarMesa: async (mesaId: string, personeroUid: string) => {
    // Si ya tenía mesa asignada, quitársela primero
    const qAnterior = query(mesasRef, where("personero_uid", "==", personeroUid));
    const mesasAnteriores = await getDocs(qAnterior);
    for (const d of mesasAnteriores.docs) {
      await updateDoc(doc(db, 'mesas', d.id), { personero_uid: null });
    }

    // Asignar la nueva
    const mesaRef = doc(db, 'mesas', mesaId);
    await updateDoc(mesaRef, { personero_uid: personeroUid });
  }
};
