import { collection, writeBatch, doc, getFirestore } from 'firebase/firestore';
import { app } from '../firebase';

const db = getFirestore(app);

// Principales locales de votación de Chaclacayo (Datos Históricos)
const localesChaclacayo = [
  { nombre: 'I.E. FELIPE SANTIAGO ESTENOS', direccion: 'Av. Nicolás Ayllón S/N, Cuadra 23', latitud: -11.9790, longitud: -76.7725, zona: 'Centro', total_mesas: 18 },
  { nombre: 'I.E. 1188 JUAN PABLO II', direccion: 'Ca. Los Rosales S/N, Huascata', latitud: -11.9730, longitud: -76.7550, zona: 'Huascata', total_mesas: 12 },
  { nombre: 'I.E. 1190 MARIANO MELGAR', direccion: 'Ca. San Martín S/N, Miguel Grau', latitud: -11.9860, longitud: -76.7820, zona: 'Miguel Grau', total_mesas: 10 },
  { nombre: 'I.E. MIGUEL GRAU SEMINARIO', direccion: 'Ca. Libertad 123', latitud: -11.9805, longitud: -76.7680, zona: 'Centro', total_mesas: 14 },
  { nombre: 'I.E. 0053 SAN VICENTE DE PAUL', direccion: 'Av. Las Gardenias', latitud: -11.9715, longitud: -76.7490, zona: 'Huascata', total_mesas: 8 },
  { nombre: 'I.E. SAN JUAN BOSCO', direccion: 'Jr. Arequipa 450', latitud: -11.9815, longitud: -76.7650, zona: 'Centro', total_mesas: 6 },
  { nombre: 'ESTADIO MUNICIPAL TAHUANTINSUYO', direccion: 'Av. Los Laureles', latitud: -11.9770, longitud: -76.7700, zona: 'Centro', total_mesas: 22 }, // Usado a veces en elecciones grandes
];

export const seedColegiosChaclacayo = async () => {
  const batch = writeBatch(db);
  const localesRef = collection(db, 'locales');
  const mesasRef = collection(db, 'mesas');

  console.log('Iniciando carga de colegios...');

  for (const local of localesChaclacayo) {
    // 1. Crear el Local
    const nuevoLocalRef = doc(localesRef);
    batch.set(nuevoLocalRef, {
      nombre: local.nombre,
      direccion: local.direccion,
      latitud: local.latitud,
      longitud: local.longitud,
      zona_id: local.zona,
      total_mesas: local.total_mesas
    });

    // 2. Crear las mesas para este local (Numeración correlativa 045xxx)
    let numeroMesa = 45000 + Math.floor(Math.random() * 1000); // Base para las mesas
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
  console.log('✅ Colegios y Mesas creados exitosamente en Firestore');
};
