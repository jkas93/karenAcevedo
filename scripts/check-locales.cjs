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

async function run() {
  const [localesSnap, mesasSnap, actasSnap, personerosSnap] = await Promise.all([
    db.collection('locales').get(),
    db.collection('mesas').get(),
    db.collection('actas').get(),
    db.collection('personeros').get(),
  ]);

  console.log('--- RECUENTO FIRESTORE ---');
  console.log('Locales:', localesSnap.size);
  console.log('Mesas:', mesasSnap.size);
  console.log('Actas:', actasSnap.size);
  console.log('Personeros:', personerosSnap.size);

  console.log('\n--- LOCALES REGISTRADOS ---');
  localesSnap.forEach((doc, i) => {
    const data = doc.data();
    console.log(`${i + 1}. [${doc.id}] ${data.nombre} | ${data.direccion} | Lat: ${data.latitud}, Lng: ${data.longitud} | Mesas: ${data.total_mesas}`);
  });

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
