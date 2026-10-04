const { readFileSync } = require('fs');

const envContent = readFileSync('.env.local', 'utf-8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([A-Z_]+)="?(.*?)"?\s*$/);
  if (match) process.env[match[1]] = match[2].replace(/\\n/g, '\n');
}

const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY,
  }),
});

async function main() {
  const db = admin.firestore();
  const [locales, mesas, actas] = await Promise.all([
    db.collection('locales').count().get(),
    db.collection('mesas').count().get(),
    db.collection('actas').count().get(),
  ]);

  console.log(JSON.stringify({
    locales: locales.data().count,
    mesas: mesas.data().count,
    actas: actas.data().count,
  }));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => admin.app().delete());
