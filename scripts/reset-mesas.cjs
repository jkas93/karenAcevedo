const { readFileSync } = require('fs');

const envContent = readFileSync('.env.local', 'utf-8');
for (const line of envContent.split(/\r?\n/)) {
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

async function deleteSnapshot(db, snapshot) {
  for (let start = 0; start < snapshot.docs.length; start += 400) {
    const batch = db.batch();
    snapshot.docs.slice(start, start + 400).forEach((document) => batch.delete(document.ref));
    await batch.commit();
  }
}

async function main() {
  const execute = process.argv.includes('--execute');
  const db = admin.firestore();
  const [mesas, actas, counters] = await Promise.all([
    db.collection('mesas').get(),
    db.collection('actas').get(),
    db.collection('electoralCounters').get(),
  ]);

  console.log(JSON.stringify({
    mode: execute ? 'execute' : 'dry-run',
    mesas: mesas.size,
    actas: actas.size,
    counters: counters.size,
  }));

  if (actas.size > 0) {
    throw new Error(`Operación cancelada: existen ${actas.size} actas y no se borrará ninguna mesa asociada.`);
  }
  if (!execute) {
    console.log('Sin cambios. Vuelve a ejecutar con --execute para borrar únicamente mesas y contadores.');
    return;
  }

  await deleteSnapshot(db, mesas);
  await deleteSnapshot(db, counters);

  const [remainingMesas, remainingActas] = await Promise.all([
    db.collection('mesas').count().get(),
    db.collection('actas').count().get(),
  ]);
  console.log(JSON.stringify({
    deletedMesas: mesas.size,
    mesasRemaining: remainingMesas.data().count,
    actasRemaining: remainingActas.data().count,
  }));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => admin.app().delete());
