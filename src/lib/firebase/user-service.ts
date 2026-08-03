import type { RolUsuario } from './types';
import { authenticatedPost } from './authenticated-request';

interface CrearUsuarioParams {
  nombre: string;
  dni: string;
  contrasena: string;
  rol: RolUsuario;
  telefono?: string;
}

type CrearUsuarioResponse = {
  success: true;
  uid: string;
};

export const userService = {
  crearUsuario: async (datos: CrearUsuarioParams): Promise<string> => {
    const result = await authenticatedPost<CrearUsuarioResponse>('/api/auth/create-user', {
      nombre: datos.nombre,
      dni: datos.dni,
      password: datos.contrasena,
      rol: datos.rol,
      telefono: datos.telefono ?? '',
    });

    return result.uid;
  },
};
