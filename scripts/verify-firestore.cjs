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

async function check() {
  const snap = await db.collection('personeros').get();
  console.log('Total documentos en Firestore /personeros:', snap.size);
  const list = [];
  snap.forEach(doc => {
    list.push({ id: doc.id, ...doc.data() });
  });

  list.sort((a, b) => (a.nombre_completo || '').localeCompare(b.nombre_completo || '', 'es'));
  list.forEach((p, idx) => {
    console.log(`${idx + 1}. DNI: ${p.dni} | ${p.nombre_completo || '(sin nombre)'} | Cel: ${p.telefono || '(sin cel)'} | Local: ${p.local_id || 'sin local'} | Mesa: ${p.mesa_numero || 'sin mesa'}`);
  });

  process.exit(0);
}

check().catch(e => {
  console.error(e);
  process.exit(1);
});
