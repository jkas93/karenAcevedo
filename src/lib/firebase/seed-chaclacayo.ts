import { collection, writeBatch, doc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

// Principales locales de votación de Chaclacayo (Datos Históricos)
const localesChaclacayo = [
  { nombre: 'I.E. FELIPE SANTIAGO ESTENOS', direccion: 'Av. Nicolás Ayllón S/N, Cuadra 23', latitud: -11.9790, longitud: -76.7725, zona: 'Centro', total_mesas: 18 },
  { nombre: 'I.E. 1188 JUAN PABLO II', direccion: 'Ca. Los Rosales S/N, Huascata', latitud: -11.9730, longitud: -76.7550, zona: 'Huascata', total_mesas: 12 },
  { nombre: 'I.E. 1190 MARIANO MELGAR', direccion: 'Ca. San Martín S/N, Miguel Grau', latitud: -11.9860, longitud: -76.7820, zona: 'Miguel Grau', total_mesas: 10 },
  { nombre: 'I.E. MIGUEL GRAU SEMINARIO', direccion: 'Ca. Libertad 123', latitud: -11.9805, longitud: -76.7680, zona: 'Centro', total_mesas: 14 },
  { nombre: 'I.E. 0053 SAN VICENTE DE PAUL', direccion: 'Av. Las Gardenias', latitud: -11.9715, longitud: -76.7490, zona: 'Huascata', total_mesas: 8 },
  { nombre: 'I.E. SAN JUAN BOSCO', direccion: 'Jr. Arequipa 450', latitud: -11.9815, longitud: -76.7650, zona: 'Centro', total_mesas: 6 },
  { nombre: 'ESTADIO MUNICIPAL TAHUANTINSUYO', direccion: 'Av. Los Laureles', latitud: -11.9770, longitud: -76.7700, zona: 'Centro', total_mesas: 22 },
];

/**
 * Interface para representar una fila leída desde Excel o pegado masivo.
 */
export interface FilaImportacionElectoral {
  mesa: string;
  local: string;
  direccion?: string;
  zona?: string;
  latitud?: number;
  longitud?: number;
}

/**
 * Elimina todos los locales, mesas y actas de Firestore.
 * Deja intactos los usuarios de acceso y los voluntarios inscritos.
 */
export const limpiarBaseElectoral = async () => {
  // Limpiar Locales
  const localesSnap = await getDocs(collection(db, 'locales'));
  const batchLocales = writeBatch(db);
  localesSnap.docs.forEach((d) => batchLocales.delete(d.ref));
  await batchLocales.commit();

  // Limpiar Mesas
  const mesasSnap = await getDocs(collection(db, 'mesas'));
  const batchMesas = writeBatch(db);
  mesasSnap.docs.forEach((d) => batchMesas.delete(d.ref));
  await batchMesas.commit();

  // Limpiar Actas
  const actasSnap = await getDocs(collection(db, 'actas'));
  const batchActas = writeBatch(db);
  actasSnap.docs.forEach((d) => batchActas.delete(d.ref));
  await batchActas.commit();
};

/**
 * Limpia y luego inserta los locales de Chaclacayo con sus mesas correlativas.
 */
export const seedColegiosChaclacayo = async () => {
  // 1. Limpiar primero para evitar duplicidad
  await limpiarBaseElectoral();

  // 2. Insertar locales y mesas en batches
  const batch = writeBatch(db);
  const localesRef = collection(db, 'locales');
  const mesasRef = collection(db, 'mesas');

  for (const local of localesChaclacayo) {
    // Crear Local
    const nuevoLocalRef = doc(localesRef);
    batch.set(nuevoLocalRef, {
      nombre: local.nombre,
      direccion: local.direccion,
      latitud: local.latitud,
      longitud: local.longitud,
      zona_id: local.zona,
      total_mesas: local.total_mesas
    });

    // Generar correlativo de mesas
    let numeroMesa = 45000 + Math.floor(Math.random() * 1000);
    for (let i = 0; i < local.total_mesas; i++) {
      const nuevaMesaRef = doc(mesasRef);
      batch.set(nuevaMesaRef, {
        numero: `0${numeroMesa + i}`,
        local_id: nuevoLocalRef.id,
        personero_uid: null,
        estado: 'pendiente'
      });
    }
  }

  await batch.commit();
};

/**
 * Procesa un listado personalizado de mesas e inserta los locales correspondientes
 * agrupándolos automáticamente. Limpia la base electoral antes de comenzar.
 */
export const importarBaseElectoralPersonalizada = async (filas: FilaImportacionElectoral[]) => {
  if (filas.length === 0) throw new Error('No hay filas para importar.');

  // 1. Limpiar base actual
  await limpiarBaseElectoral();

  // 2. Agrupar filas de mesas por Local
  const localesAgrupados: Record<string, {
    nombre: string;
    direccion: string;
    zona: string;
    latitud: number;
    longitud: number;
    mesas: string[];
  }> = {};

  // Coordenadas base de Chaclacayo para locales sin geo-referencia
  const LAT_BASE = -11.9818;
  const LNG_BASE = -76.7651;

  filas.forEach((f, idx) => {
    const nombreLocal = f.local?.trim().toUpperCase();
    if (!nombreLocal || !f.mesa) return;

    if (!localesAgrupados[nombreLocal]) {
      // Si no vienen coordenadas, generamos un pequeño desplazamiento (jitter)
      // para que los pines no queden uno encima del otro en el mapa.
      const jitterLat = (Math.random() - 0.5) * 0.015;
      const jitterLng = (Math.random() - 0.5) * 0.015;

      localesAgrupados[nombreLocal] = {
        nombre: f.local.trim(),
        direccion: f.direccion?.trim() || 'Dirección no especificada',
        zona: f.zona?.trim() || 'General',
        latitud: Number(f.latitud) || (LAT_BASE + jitterLat),
        longitud: Number(f.longitud) || (LNG_BASE + jitterLng),
        mesas: []
      };
    }

    // Agregar el número de mesa si no está duplicado para ese local
    const nroMesa = f.mesa.trim();
    if (!localesAgrupados[nombreLocal].mesas.includes(nroMesa)) {
      localesAgrupados[nombreLocal].mesas.push(nroMesa);
    }
  });

  // 3. Crear documentos en Firestore usando lotes (Batches)
  const batch = writeBatch(db);
  const localesRef = collection(db, 'locales');
  const mesasRef = collection(db, 'mesas');

  for (const key of Object.keys(localesAgrupados)) {
    const loc = localesAgrupados[key];
    const nuevoLocalRef = doc(localesRef);

    // Guardar el Local
    batch.set(nuevoLocalRef, {
      nombre: loc.nombre,
      direccion: loc.direccion,
      latitud: loc.latitud,
      longitud: loc.longitud,
      zona_id: loc.zona,
      total_mesas: loc.mesas.length
    });

    // Guardar cada mesa vinculada a ese local
    loc.mesas.forEach((nroMesa) => {
      const nuevaMesaRef = doc(mesasRef);
      batch.set(nuevaMesaRef, {
        numero: nroMesa,
        local_id: nuevoLocalRef.id,
        personero_uid: null,
        estado: 'pendiente'
      });
    });
  }

  await batch.commit();
};
