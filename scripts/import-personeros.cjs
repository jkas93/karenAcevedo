// Importar los 35 personeros directamente a Firestore usando firebase-admin
// Ejecutar desde la carpeta del proyecto donde está node_modules
const { readFileSync } = require('fs');

// Cargar env
const envContent = readFileSync('.env.local', 'utf-8');
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_]+)="?(.*?)"?\s*$/);
  if (m) process.env[m[1]] = m[2].replace(/\\n/g, '\n');
}

const admin = require('firebase-admin');

const app = admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY,
  }),
});
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const PERSONEROS = [
  { nombre: "FLORES TOVAR LOYDA INES", dni: "10296612", celular: "" },
  { nombre: "SILVERA MOSCOSO GLORIA", dni: "06961959", celular: "963113330" },
  { nombre: "TAPULLIMA COTOS DENNER DIXON", dni: "75343531", celular: "979404694" },
  { nombre: "DOMINGUEZ VALDEZ DIANA KARINA", dni: "75958805", celular: "951620518" },
  { nombre: "LIPA ALATA HERMINIA", dni: "45658528", celular: "912098884" },
  { nombre: "CASTILLO ARGANDOÑA NOEMI ANET", dni: "41711382", celular: "910593805" },
  { nombre: "SILVERA GAMBOA CARMEN GIOVANNA", dni: "43614569", celular: "936733623" },
  { nombre: "CARRANZA YAHUA JOSE TEOFILO", dni: "09729971", celular: "" },
  { nombre: "LAZO ESPINOZA DE CASTRO CARMELA ISABEL", dni: "41756864", celular: "" },
  { nombre: "YARIN MELCHOR MAURA ISABEL", dni: "43224815", celular: "935651501" },
  { nombre: "ALARCON ARQUIÑEGO YANDERY LIZETH", dni: "77484342", celular: "917350526" },
  { nombre: "TANTA YARIN ENIGER ISABEL", dni: "77000908", celular: "917350526" },
  { nombre: "CARRILLO SANCHEZ LINDA ROSMERI", dni: "74858638", celular: "" },
  { nombre: "CARRILLO OLIVA CESAR JOHAN", dni: "71746898", celular: "979772569" },
  { nombre: "CARRILLO OLIVA BRAYAN GUILLERMO", dni: "71746905", celular: "" },
  { nombre: "LAVADO SANCHEZ HECTOR ALBERT", dni: "46197324", celular: "969363853" },
  { nombre: "ASTE CHANG OLENKA LUANA", dni: "78442124", celular: "978694863" },
  { nombre: "ARCE VALENTIN MARYCIELO KIARAH", dni: "71692387", celular: "900346438" },
  { nombre: "CAMPOS DE LA CRUZ MARICRUZ", dni: "47262765", celular: "922476203" },
  { nombre: "ALCANTARA QUIROZ GIANELLA XIOMARA", dni: "70091962", celular: "900186991" },
  { nombre: "VARGAS IPUSHIMA PAOLA SILVANA", dni: "63292213", celular: "928979500" },
  { nombre: "TANTA GARAMENDI EDITH", dni: "47813046", celular: "926243829" },
  { nombre: "SALDIVAR CHERRES ANGIE CAROLINA", dni: "46717672", celular: "994027270" },
  { nombre: "SALDIVAR CHERRES ASTRID AVRIL", dni: "60863299", celular: "957746969" },
  { nombre: "SOTO CORDOVA GABRIEL ANTHONNY", dni: "60188483", celular: "" },
  { nombre: "VASQUEZ MANRIQUE DERICK", dni: "60310384", celular: "" },
  { nombre: "COZ SOTO JUAN DIEGO", dni: "71162186", celular: "" },
  { nombre: "OLARTE ROMERO FLOR MARIA", dni: "40138426", celular: "924068800" },
  { nombre: "DE LA CRUZ CHAVEZ JESUS FAUSTINO", dni: "40282070", celular: "992010303" },
  { nombre: "CHUMBE SINARAHUA ZOILA ISABEL", dni: "75180839", celular: "991636323" },
  { nombre: "BERNILLA CESPEDES JAVIER ALEXANDER", dni: "45148067", celular: "" },
  { nombre: "AVALOS SALDIVAR JOHN KEVIN", dni: "71260540", celular: "" },
  { nombre: "LOAYZA VELARDE IRIS DIANA", dni: "09726670", celular: "927460905" },
  { nombre: "PALOMINO LOAYZA ALEXIS ANTUHAN", dni: "45195414", celular: "986870120" },
  { nombre: "LOAYZA NIGARO JOYCEE DENPHRA", dni: "71158630", celular: "925607783" },
];

async function main() {
  console.log(`Importando ${PERSONEROS.length} personeros a Firestore...\n`);

  // Verificar existentes
  const existingSnapshot = await db.collection('personeros').get();
  const existingByDni = new Map();
  existingSnapshot.forEach(doc => {
    const data = doc.data();
    if (data.dni) existingByDni.set(data.dni, { id: doc.id, ...data });
  });
  console.log(`Personeros ya en BD: ${existingByDni.size}\n`);

  let created = 0, skipped = 0, updated = 0;
  const batch = db.batch();

  for (const p of PERSONEROS) {
    const existing = existingByDni.get(p.dni);
    
    if (existing) {
      const updates = {};
      if (!existing.nombre_completo && p.nombre) updates.nombre_completo = p.nombre;
      if (!existing.telefono && p.celular) updates.telefono = p.celular;
      
      if (Object.keys(updates).length > 0) {
        updates.updated_at = FieldValue.serverTimestamp();
        batch.update(db.collection('personeros').doc(existing.id), updates);
        updated++;
        console.log(`  ✏️  Actualizado: ${p.dni} - ${p.nombre}`);
      } else {
        skipped++;
        console.log(`  ⏭️  Ya existe:   ${p.dni} - ${p.nombre}`);
      }
    } else {
      const ref = db.collection('personeros').doc();
      batch.set(ref, {
        dni: p.dni,
        nombre_completo: p.nombre,
        telefono: p.celular,
        local_id: '',
        mesa_numero: '',
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      });
      created++;
      console.log(`  ✅ Nuevo:        ${p.dni} - ${p.nombre}${p.celular ? ` (${p.celular})` : ''}`);
    }
  }

  await batch.commit();

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`  ✅ Creados:      ${created}`);
  console.log(`  ✏️  Actualizados: ${updated}`);
  console.log(`  ⏭️  Sin cambios:  ${skipped}`);
  console.log(`  📊 Total:        ${PERSONEROS.length}`);
  console.log(`${'═'.repeat(50)}`);

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
