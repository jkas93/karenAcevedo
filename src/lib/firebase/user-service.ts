import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import type { RolUsuario } from './types';

interface CrearUsuarioParams {
  nombre: string;
  dni: string;
  contrasena: string;
  rol: RolUsuario;
  telefono?: string;
}

export const userService = {
  /**
   * Crea un usuario en Firebase Auth (via REST API, sin desloguear al admin)
   * y luego crea su documento en Firestore con esquema UNIFICADO.
   * Punto único de creación de usuarios para toda la aplicación.
   */
  crearUsuario: async (datos: CrearUsuarioParams): Promise<string> => {
    const email = `${datos.dni}@fuerzaciudadana.pe`;
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

    if (!apiKey) throw new Error('Firebase API Key no configurada en el entorno.');

    // 1. Crear en Firebase Auth (REST API — no hace logout del usuario actual)
    const authRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password: datos.contrasena,
          returnSecureToken: true,
        }),
      }
    );

    const authData = await authRes.json();
    if (authData.error) {
      if (authData.error.message === 'EMAIL_EXISTS') {
        throw new Error('Este DNI ya tiene un usuario registrado en el sistema.');
      }
      throw new Error(authData.error.message || 'Error al crear la cuenta en Firebase Auth.');
    }

    const uid: string = authData.localId;

    // 2. Crear documento en Firestore con esquema UNIFICADO
    // Todos los campos presentes para todos los roles
    const userRef = doc(db, 'usuarios', email);
    await setDoc(userRef, {
      uid,
      nombre: datos.nombre,
      dni: datos.dni,
      telefono: datos.telefono ?? null,
      correo: email,
      rol: datos.rol,
      fecha_creacion: Timestamp.now(),
    });

    return uid;
  },
};
