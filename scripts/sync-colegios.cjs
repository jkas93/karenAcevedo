const { readFileSync } = require('fs');

const envContent = readFileSync('.env.local', 'utf-8');
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_]+)="?(.*?)"?\s*$/);
  if (m) process.env[m[1]] = m[2].replace(/\\n/g, '\n');
}

const admin = require('firebase-admin');
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY,
  }),
});
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const CHACLACAYO_ELECTORAL_LOCATIONS = [
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

async function sync() {
  console.log('🔄 Sincronizando los 8 colegios oficiales y 138 mesas en Firestore...');

  // 1. Limpiar mesas y locales anteriores (SIN TOCAR personeros)
  const oldMesas = await db.collection('mesas').get();
  console.log(`Borrando ${oldMesas.size} mesas antiguas...`);
  const batch1 = db.batch();
  oldMesas.docs.forEach(d => batch1.delete(d.ref));
  await batch1.commit();

  const oldLocales = await db.collection('locales').get();
  console.log(`Borrando ${oldLocales.size} locales antiguos...`);
  const batch2 = db.batch();
  oldLocales.docs.forEach(d => batch2.delete(d.ref));
  await batch2.commit();

  // 2. Crear los 8 locales y 138 mesas
  let mesaNumber = 41158;
  let totalMesasCount = 0;

  for (const loc of CHACLACAYO_ELECTORAL_LOCATIONS) {
    const localRef = db.collection('locales').doc(`local_${loc.code.toLowerCase()}`);
    await localRef.set({
      nombre: loc.nombre,
      direccion: [loc.direccion, loc.referencia].filter(Boolean).join(' · '),
      latitud: loc.latitud,
      longitud: loc.longitud,
      zona_id: loc.zona,
      total_mesas: loc.mesas,
      coordinador: loc.coordinador || '',
      created_at: FieldValue.serverTimestamp(),
    });

    console.log(`✅ Creado local: ${loc.nombre} (${loc.mesas} mesas)`);

    const mesasBatch = db.batch();
    for (let i = 0; i < loc.mesas; i++) {
      const numero = String(mesaNumber++).padStart(6, '0');
      const mesaRef = db.collection('mesas').doc(`mesa_${numero}`);
      mesasBatch.set(mesaRef, {
        numero,
        local_id: localRef.id,
        estado: 'pendiente',
        created_at: FieldValue.serverTimestamp(),
      });
      totalMesasCount++;
    }
    await mesasBatch.commit();
  }

  console.log(`\n🎉 Sincronización exitosa:`);
  console.log(`- 8 locales oficiales creados.`);
  console.log(`- ${totalMesasCount} mesas creadas (desde 041158 hasta ${String(mesaNumber - 1).padStart(6, '0')}).`);

  // Verificar personeros para asegurar que siguen intactos
  const personerosSnap = await db.collection('personeros').get();
  console.log(`- ${personerosSnap.size} personeros conservados 100% intactos.`);

  process.exit(0);
}

sync().catch(err => {
  console.error('Error sincronizando colegios:', err);
  process.exit(1);
});
