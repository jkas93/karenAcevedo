// Explicit operator diagnostic for Kevin's connected phone. No role or Android permission changes.
import { initializeApp, cert } from 'firebase-admin/app';
import { initializeFirestore, Timestamp } from 'firebase-admin/firestore';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const serial = '183c4881';
const id = 'bd98c577c58777d34b83a2fe88ca9083d1c49d9106bdeed7bc9d9b7bc5621bc4';
const app = initializeApp({ credential: cert({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') }) });
const db = initializeFirestore(app, { preferRest: true });
const ref = db.collection('autoClickerDevices').doc(id);
const initial = (await ref.get()).data();
assert.equal(initial.owner, 'Kevin 3');
assert.equal(initial.metadata.model, '2510ERA8BG');
assert(['enabled', 'suspended', 'disabled'].includes(initial.state), 'Never alter a revoked identity.');
const adb = (...args) => execFileSync('C:/Android/Sdk/platform-tools/adb.exe', ['-s', serial, ...args], { encoding: 'utf8', timeout: 20000 });
const grantedBefore = adb('shell', 'settings', 'get', 'secure', 'enabled_accessibility_services').trim();
assert(grantedBefore.includes('pe.karen.autoclicker'));
async function transition(state) {
  await db.runTransaction(async tx => {
    const snapshot = await tx.get(ref); const d = snapshot.data();
    assert.notEqual(d.state, 'revoked');
    tx.update(ref, { state, version: d.version + 1, sessionId: null, updatedAt: Timestamp.now() });
    tx.create(ref.collection('audit').doc(), { action: 'authorize', actor: 'diagnostic:connected-phone', reason: 'Prueba solicitada por Kevin: conservación de accesibilidad al suspender/habilitar.', before: { state: d.state }, after: { state }, createdAt: Timestamp.now() });
  });
  await new Promise(resolve => setTimeout(resolve, 9000));
  assert.equal(adb('shell', 'settings', 'get', 'secure', 'enabled_accessibility_services').trim(), grantedBefore);
  const status = adb('shell', 'dumpsys', 'accessibility').split('\n').filter(line => /Bound services:|Crashed services:/.test(line));
  console.log(JSON.stringify({ server: state, permissionPreserved: true, service: status.map(s => s.trim()) }));
}
try { for (const state of ['suspended', 'enabled', 'disabled', 'enabled']) await transition(state); }
finally {
  const current = (await ref.get()).data();
  if (['suspended', 'disabled'].includes(current.state)) await transition('enabled');
  await db.terminate();
}
