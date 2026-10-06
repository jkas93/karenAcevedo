import type { Timestamp } from 'firebase/firestore';

// ============================================================
// TIPOS CENTRALES — Toda la app debe importar desde aquí
// ============================================================

import type { UserRole } from '@/lib/access-control';
import type { ConteoDoble, ResultadoOrganizacion } from '@/lib/electoral/acta-schema';

export type RolUsuario = UserRole;

export type Usuario = {
  id: string;           // doc ID = email (DNI@fuerzaciudadana.pe)
  uid: string;          // Firebase Auth UID
  nombre: string;
  dni: string;
  telefono?: string | null;
  correo: string;
  rol: RolUsuario;
  fecha_creacion: Timestamp;
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
  coordinador?: string;
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

export type Personero = {
  id: string;
  dni: string;
  nombre_completo: string;
  telefono: string;
  local_id: string;
  mesa_numero: string;
  created_at?: Date;
  updated_at?: Date;
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
  votos_impugnados?: number;
  local_id?: string;
  mesa_numero?: string;
  resultados?: ResultadoOrganizacion[];
  especiales?: {
    blancos: ConteoDoble;
    nulos: ConteoDoble;
    impugnados: ConteoDoble;
  };
  totales_emitidos?: ConteoDoble;
  total_distrital?: number;
  total_provincial?: number;
  electores_habiles?: number | null;
  ciudadanos_votaron?: number | null;
  observaciones?: string;
  schema_version?: number;
  foto_url?: string;
  timestamp: Date;
  modo_dios_override?: boolean;
  motivo_modificacion?: string;
  modificado_por?: string;
  modificado_at?: any;
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

// ─── CALENDARIO OPERATIVO INTERNO ─────────────────────────────────────────────
export type CategoriaActividad =
  | 'territorio'
  | 'reunion'
  | 'comunicacion'
  | 'capacitacion'
  | 'electoral'
  | 'logistica';

export type PrioridadActividad = 'baja' | 'normal' | 'alta';
export type EstadoActividad = 'programada' | 'confirmada' | 'completada' | 'cancelada';

export interface ActividadCalendario {
  id: string;
  titulo: string;
  descripcion: string;
  inicio: Timestamp;
  fin: Timestamp;
  todoElDia: boolean;
  ubicacion: string;
  responsableId: string;
  responsableNombre: string;
  categoria: CategoriaActividad;
  prioridad: PrioridadActividad;
  estado: EstadoActividad;
  timeZone?: 'America/Lima';
  creadoPor: string;
  creadoPorNombre: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export type ActividadCalendarioInput = Omit<
  ActividadCalendario,
  'id' | 'creadoPor' | 'creadoPorNombre' | 'createdAt' | 'updatedAt'
>;

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
    id: 'alianza_para_el_progreso',
    nombre: 'Alianza para el Progreso',
    alias: 'Alianza para el Progreso',
    color: '#0284c7',   // Azul APP
    esPropio: false,
  },
  {
    id: 'peru_libre',
    nombre: 'Partido Político Nacional Perú Libre',
    alias: 'Perú Libre',
    color: '#dc2626',   // Rojo
    esPropio: false,
  },
  {
    id: 'juntos_por_el_peru',
    nombre: 'Juntos por el Perú',
    alias: 'Juntos por el Perú',
    color: '#059669',   // Verde esmeralda
    esPropio: false,
  },
  {
    id: 'accion_popular',
    nombre: 'Acción Popular',
    alias: 'Acción Popular',
    color: '#e11d48',   // Rojo bandera AP
    esPropio: false,
  },
  {
    id: 'renovacion_popular',
    nombre: 'Renovación Popular',
    alias: 'Renovación Popular',
    color: '#38bdf8',   // Celeste RP
    esPropio: false,
  },
  {
    id: 'fe_en_el_peru',
    nombre: 'Fe en el Perú',
    alias: 'Fe en el Perú',
    color: '#d97706',   // Ámbar / Dorado
    esPropio: false,
  },
  {
    id: 'democrata_verde',
    nombre: 'Partido Demócrata Verde',
    alias: 'Demócrata Verde',
    color: '#16a34a',   // Verde ecologista
    esPropio: false,
  },
  {
    id: 'avanza_pais',
    nombre: 'Avanza País Partido de Integración Social',
    alias: 'Avanza País',
    color: '#1d4ed8',   // Azul royal
    esPropio: false,
  },
  {
    id: 'fuerza_ciudadana',
    nombre: 'Fuerza Ciudadana',
    alias: 'Fuerza Ciudadana',
    color: '#0070C0',   // Azul primario de la campaña Karen Acevedo
    esPropio: true,
  },
  {
    id: 'pais_para_todos',
    nombre: 'Partido País para Todos',
    alias: 'País para Todos',
    color: '#ea580c',   // Naranja
    esPropio: false,
  },
  {
    id: 'somos_peru',
    nombre: 'Somos Perú',
    alias: 'Somos Perú',
    color: '#4f46e5',   // Azul corazón / Índigo
    esPropio: false,
  },
  {
    id: 'podemos_peru',
    nombre: 'Podemos Perú',
    alias: 'Podemos Perú',
    color: '#ca8a04',   // Dorado Podemos
    esPropio: false,
  },
];

// Helper: obtener el partido propio
export const getPartidoPropio = () =>
  PARTIDOS_CHACLACAYO.find(p => p.esPropio) ?? PARTIDOS_CHACLACAYO[0];

// Helper: obtener partidos rivales
export const getPartidosRivales = () =>
  PARTIDOS_CHACLACAYO.filter(p => !p.esPropio);
