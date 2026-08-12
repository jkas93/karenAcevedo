export const EDUCATION_LEVELS = [
  'secundaria',
  'tecnico',
  'universitario',
  'posgrado',
] as const;

export const TEAM_SKILLS = [
  'redaccion',
  'redes_sociales',
  'diseno',
  'analisis_datos',
  'oratoria',
  'conduccion',
  'logistica',
  'primeros_auxilios',
] as const;

export const SUPPORT_AREAS = [
  'territorial',
  'tecnico',
  'comunicaciones',
  'logistica',
  'electoral',
  'otra',
] as const;

export const WEEK_DAYS = [
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
  'domingo',
] as const;

export const DAY_SHIFTS = ['manana', 'tarde', 'noche'] as const;
export const TRAVEL_OPTIONS = ['si', 'no', 'aviso_previo'] as const;
export const TEAM_PROFILE_STATUSES = [
  'nuevo',
  'revisado',
  'contactado',
  'incorporado',
  'descartado',
] as const;

export type EducationLevel = (typeof EDUCATION_LEVELS)[number];
export type TeamSkill = (typeof TEAM_SKILLS)[number];
export type SupportArea = (typeof SUPPORT_AREAS)[number];
export type WeekDay = (typeof WEEK_DAYS)[number];
export type DayShift = (typeof DAY_SHIFTS)[number];
export type TravelOption = (typeof TRAVEL_OPTIONS)[number];
export type TeamProfileStatus = (typeof TEAM_PROFILE_STATUSES)[number];

export type TeamAvailability = Record<WeekDay, DayShift[]>;

export type TeamIntakePayload = {
  nombre: string;
  dni: string;
  telefono: string;
  fechaNacimiento: string;
  direccionZona: string;
  transportePropio: boolean;
  correo: string;
  gradoInstruccion: EducationLevel;
  carreraOficio: string;
  institucion: string;
  habilidades: TeamSkill[];
  otraHabilidad: string;
  idiomas: string;
  experienciaPrevia: boolean;
  experienciaDetalle: string;
  areaApoyo: SupportArea;
  areaOtra: string;
  disponibilidad: TeamAvailability;
  horasSemanales: number;
  desplazamiento: TravelOption;
  expectativas: string;
};

export type TeamProfile = TeamIntakePayload & {
  id: string;
  estado: TeamProfileStatus;
  fechaRegistro: string;
  updatedAt: string;
};

export const EMPTY_AVAILABILITY: TeamAvailability = {
  lunes: [],
  martes: [],
  miercoles: [],
  jueves: [],
  viernes: [],
  sabado: [],
  domingo: [],
};
