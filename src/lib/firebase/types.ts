// ============================================================
// TIPOS CENTRALES — Toda la app debe importar desde aquí
// ============================================================

export type RolUsuario = 'administrador' | 'candidata' | 'digitador' | 'usuario';

export type Usuario = {
  id: string;           // doc ID = email (DNI@fuerzaciudadana.pe)
  uid: string;          // Firebase Auth UID
  nombre: string;
  dni: string;
  telefono?: string | null;
  correo: string;
  rol: RolUsuario;
  fecha_creacion: Date;
};

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
  estado: 'pendiente' | 'enviada';
};

export type Acta = {
  id: string;
  mesa_id: string;
  votos_partido_a: number;
  votos_partido_b: number;
  votos_partido_c: number;
  votos_partido_d: number;
  votos_blancos: number;
  votos_nulos: number;
  foto_url?: string;
  timestamp: Date;
};

export type Voluntario = {
  id: string;
  nombre: string;
  telefono: string;
  dni: string;
  zona: string;
  ayuda: 'difusion' | 'voluntariado' | 'personero' | string;
  estado: 'pendiente' | 'contactado' | 'rechazado';
  fecha: { seconds: number; nanoseconds: number };
};

// ─── TIPOS PARA AGENDA (PÚBLICA) ──────────────────────────────────────────────

export interface ActividadAgenda {
  id: string;
  titulo: string;
  descripcion: string;
  ubicacion: string;
  etiqueta: string; // Ej. "Próx.", "Hoy", "Terminado"
  fechaDestacada: string; // Ej. "2027", "15/10"
  fechaReal?: any; // Firestore Timestamp opcional para ordenamiento
  createdAt?: any; // Firestore Timestamp
}

// ============================================================
// PARTIDOS POLÍTICOS — Chaclacayo Elecciones 2026
// Fuente: JNE Lima Este 1 (actualizado julio 2026)
// Lista configurable — agregar/editar según confirme el JNE
// ============================================================
export type Partido = {
  id: string;           // Clave única interna
  nombre: string;       // Nombre oficial del partido
  alias: string;        // Nombre corto para UI
  color: string;        // Color hex para gráficos
  esPropio: boolean;    // true = partido de Karen
};

export const PARTIDOS_CHACLACAYO: Partido[] = [
  {
    id: 'partido_a',
    nombre: 'Fuerza Ciudadana',
    alias: 'Fuerza Ciudadana',
    color: '#0070C0',   // Azul primario de la campaña
    esPropio: true,
  },
  {
    id: 'partido_b',
    nombre: 'Acción Popular',
    alias: 'Acción Popular',
    color: '#dc2626',   // Rojo
    esPropio: false,
  },
  {
    id: 'partido_c',
    nombre: 'Renovación Popular',
    alias: 'Renovación Popular',
    color: '#7c3aed',   // Morado
    esPropio: false,
  },
  {
    id: 'partido_d',
    nombre: 'Partido Rival 4',  // Actualizar cuando JNE confirme lista definitiva (agosto 2026)
    alias: 'Rival 4',
    color: '#94a3b8',   // Gris
    esPropio: false,
  },
];

// Helper: obtener el partido propio
export const getPartidoPropio = () =>
  PARTIDOS_CHACLACAYO.find(p => p.esPropio) ?? PARTIDOS_CHACLACAYO[0];

// Helper: obtener partidos rivales
export const getPartidosRivales = () =>
  PARTIDOS_CHACLACAYO.filter(p => !p.esPropio);
