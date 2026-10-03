export type ElectoralLocationSeed = {
  code: string;
  nombre: string;
  shortName: string;
  direccion: string;
  referencia?: string;
  latitud: number;
  longitud: number;
  zona: string;
  mesas: number;
  coordinador?: string;
};

// Relación operativa entregada para Chaclacayo. Las direcciones se normalizaron
// contra el padrón de instituciones educativas de MINEDU y la ubicación cartográfica.
export const CHACLACAYO_ELECTORAL_LOCATIONS: ElectoralLocationSeed[] = [
  {
    code: '0053',
    nombre: 'I.E. 0053 San Vicente de Paúl',
    shortName: 'San Vicente de Paúl',
    direccion: 'Av. El Sol 599, Santa Inés',
    referencia: 'Altura del km 23 de la Carretera Central',
    latitud: -11.9733852,
    longitud: -76.7516743,
    zona: 'Santa Inés',
    mesas: 16,
  },
  {
    code: '1218',
    nombre: 'I.E. 1218 San Luis María de Montfort',
    shortName: 'San Luis María de Montfort',
    direccion: 'Huascata Mz. M, lote 1',
    referencia: 'Cerrito Vecino de Huascata',
    latitud: -11.994538,
    longitud: -76.819274,
    zona: 'Huascata',
    mesas: 18,
    coordinador: 'Ingri · Charo (apoyo)',
  },
  {
    code: '1189',
    nombre: 'I.E. 1189 Alberto Rivera y Piérola',
    shortName: 'Alberto Rivera y Piérola',
    direccion: 'Av. Nicolás Ayllón 162',
    referencia: 'Carretera Central, Chaclacayo',
    latitud: -11.977548,
    longitud: -76.7762767,
    zona: 'Chaclacayo',
    mesas: 16,
    coordinador: 'Juan Aliaga',
  },
  {
    code: '1199',
    nombre: 'I.E. 1199 Mariscal Ramón Castilla',
    shortName: 'Mariscal Ramón Castilla',
    direccion: 'Av. Atahualpa 200',
    referencia: 'Cultura y Progreso, Ñaña',
    latitud: -11.9884416,
    longitud: -76.8177068,
    zona: 'Cultura y Progreso',
    mesas: 28,
    coordinador: 'Tino',
  },
  {
    code: '1217',
    nombre: 'I.E. 1217 Jorge Basadre',
    shortName: 'Jorge Basadre',
    direccion: 'Calle Azucenas 246',
    referencia: 'Cooperativa Alfonso Cobián, Ñaña',
    latitud: -11.9862923,
    longitud: -76.8069651,
    zona: 'Alfonso Cobián',
    mesas: 16,
    coordinador: 'Naila',
  },
  {
    code: '0787',
    nombre: 'I.E. 787 Almirante Miguel Grau',
    shortName: 'Almirante Miguel Grau',
    direccion: 'Carretera Central km 19½',
    referencia: 'Paradero de la posta de Ñaña',
    latitud: -11.9861738,
    longitud: -76.8138201,
    zona: 'Miguel Grau',
    mesas: 20,
    coordinador: 'Mónica Coros',
  },
  {
    code: 'ESTENOS',
    nombre: 'I.E. Felipe Santiago Estenós',
    shortName: 'Felipe Santiago Estenós',
    direccion: 'Av. La Ladera 132-142',
    referencia: 'Urbanización Los Halcones',
    latitud: -11.9783557,
    longitud: -76.7786139,
    zona: 'Los Halcones',
    mesas: 16,
    coordinador: 'Manuel',
  },
  {
    code: '1192',
    nombre: 'I.E. 1192 Florentino Prat',
    shortName: 'Florentino Prat',
    direccion: 'Av. Nicolás Ayllón 2032',
    referencia: 'Altura de la Carretera Central km 24.5',
    latitud: -11.9722138,
    longitud: -76.7565007,
    zona: 'Santa Inés',
    mesas: 8,
    coordinador: 'Kevin',
  },
];

export const CHACLACAYO_TOTAL_MESAS = CHACLACAYO_ELECTORAL_LOCATIONS.reduce(
  (total, local) => total + local.mesas,
  0,
);

export function googleMapsUrl(nombre: string, direccion?: string, lat?: number, lng?: number) {
  if (typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
  const query = [nombre, direccion, 'Chaclacayo, Lima, Perú'].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function findElectoralLocation(localIdOrName?: string) {
  if (!localIdOrName) return undefined;
  const term = localIdOrName.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  return CHACLACAYO_ELECTORAL_LOCATIONS.find((loc) => {
    const locName = loc.nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    const locShort = loc.shortName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    return (
      loc.code === localIdOrName ||
      `local-${loc.code}` === localIdOrName ||
      term.includes(loc.code) ||
      term.includes(loc.code.replace(/^0+/, '')) ||
      locName.includes(term) ||
      term.includes(locShort) ||
      locShort.includes(term)
    );
  });
}

