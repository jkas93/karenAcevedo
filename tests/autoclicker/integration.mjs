import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import { generateKeyPairSync, sign, randomUUID } from 'node:crypto';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { adminCommand, createChallenge, deviceCommand, rateLimit } from '../../src/lib/server/autoclicker.ts';
import { canonical, codeHash } from '../../src/lib/autoclicker/protocol.ts';
import { SUPERUSER_EMAIL } from '../../src/lib/access-control.ts';

assert.equal(process.env.GCLOUD_PROJECT, 'demo-karen-autoclicker', 'These tests only run against a demo emulator project.');
assert.match(process.env.FIRESTORE_EMULATOR_HOST || '', /^(127\.0\.0\.1|localhost):8188$/);
assert.match(process.env.FIREBASE_AUTH_EMULATOR_HOST || '', /^(127\.0\.0\.1|localhost):9198$/);
process.env.AUTOCLICKER_PAIRING_SECRET = 'test-only-secret-not-for-production-123456';
const app = initializeApp({ projectId: 'demo-karen-autoclicker' });
const db = getFirestore(app);
let admin, editor, viewer;
async function login(email, role) {
  const u = await getAuth(app).createUser({ email, password: 'OnlyEmulator!2026' });
  await db.collection('usuarios').doc(email).set({ uid: u.uid, rol: role, nombre: 'Test operator' });
  const r = await fetch('http://127.0.0.1:9198/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'OnlyEmulator!2026', returnSecureToken: true })
  });
  const token = (await r.json()).idToken; assert(token);
  return { request: new Request('http://localhost/api/autoclicker/admin', { headers: { Authorization: 'Bearer ' + token } }), uid: u.uid, token };
}
function mobile() {
  const keys = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const publicKey = keys.publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  async function envelope(command) {
    const c = await createChallenge({ publicKey });
    const payload = JSON.stringify(command);
    return { challengeId: c.challengeId, payload, signature: sign('sha256', Buffer.from(canonical(c.challengeId, c.nonce, payload)), keys.privateKey).toString('base64') };
  }
  return { envelope, command: async c => deviceCommand(await envelope(c)) };
}
const meta = { manufacturer: 'Test', model: 'Pixel', android: '16', appVersion: '1', width: 1080, height: 2400 };
async function linked() {
  const phone = mobile(); const pairing = await phone.command({ action: 'pair', metadata: meta });
  const { device } = await adminCommand(admin, { action: 'claim', code: pairing.code, owner: 'Propietario Test', alias: 'Ensayo' });
  return { phone, device, pairing };
}
async function authorize(device, state='enabled') {
  return (await adminCommand(admin, { action: 'authorize', deviceId: device.id, version: device.version, state, expiresAt: null, reason: 'Prueba', operationId: randomUUID() })).device;
}
before(async () => {
  admin = (await login(SUPERUSER_EMAIL, 'superusuario')).request;
  const e = await login('editor@example.test', 'administrador'); editor = e.request;
  viewer = await login('viewer@example.test', 'usuario');
  await db.collection('rolePermissions').doc('administrador').set({ permissions: { 'devices.view': true, 'devices.manage': true } });
  await db.collection('rolePermissions').doc('usuario').set({ permissions: { 'devices.view': true } });
});
after(async () => { await db.terminate(); await deleteApp(app); });

test('registration -> denied start -> enable -> running -> suspend -> renewal denied', async () => {
  const { phone, device } = await linked();
  assert.equal(device.state, 'disabled');
  assert.equal((await phone.command({ action: 'start' })).allowed, false);
  const enabled = await authorize(device);
  const lease = await phone.command({ action: 'start' });
  assert.equal(lease.allowed, true); assert(lease.durationMs <= 30000);
  await authorize(enabled, 'suspended');
  const renewal = await phone.command({ action: 'renew', sessionId: lease.sessionId, version: lease.version });
  assert.equal(renewal.allowed, false);
  assert.equal((await phone.command({ action: 'start' })).allowed, false);
});
test('consumed code cannot be claimed twice, including concurrently', async () => {
  const phone = mobile(); const p = await phone.command({ action: 'pair', metadata: meta });
  const results = await Promise.allSettled([1,2].map(() => adminCommand(admin, { action: 'claim', code: p.code, owner: 'Concurrent', alias: '' })));
  assert.equal(results.filter(r=>r.status==='fulfilled').length, 1);
});
test('regeneration invalidates prior code and expiry is checked before TTL cleanup', async () => {
  const phone = mobile(); const old = await phone.command({ action: 'pair', metadata: meta });
  const current = await phone.command({ action: 'pair', metadata: meta });
  await assert.rejects(adminCommand(admin, { action:'preview',code:old.code }), e=>e.status===404);
  const hash=codeHash(current.code,process.env.AUTOCLICKER_PAIRING_SECRET);
  await db.collection('autoClickerPairings').doc(hash).update({expiresAt:Timestamp.fromMillis(Date.now()-1)});
  await assert.rejects(adminCommand(admin,{action:'claim',code:current.code,owner:'Expired'}),e=>e.status===409);
});
test('single-use challenge rejects replay, altered payload and expired nonce', async () => {
  const phone=mobile();const env=await phone.envelope({action:'status'});
  await deviceCommand(env);
  await assert.rejects(deviceCommand(env),e=>e.status===401);
  const altered=await phone.envelope({action:'status'});
  await assert.rejects(deviceCommand({...altered,payload:'{"action":"start"}'}),e=>e.status===401);
  const expired=await phone.envelope({action:'status'});
  await db.collection('autoClickerChallenges').doc(expired.challengeId).update({expiresAt:Timestamp.fromMillis(Date.now()-1)});
  await assert.rejects(deviceCommand(expired),e=>e.status===401);
});
test('editing permission cannot enable devices and role removal applies immediately', async () => {
  const {device}=await linked();
  await assert.rejects(adminCommand(editor,{action:'authorize',deviceId:device.id,version:1,state:'enabled',reason:'attempt',operationId:randomUUID()}),e=>e.status===403);
  await assert.rejects(adminCommand(viewer.request,{action:'claim',code:'ABC234',owner:'attempt'}),e=>e.status===403);
  await assert.rejects(adminCommand(new Request('http://localhost'),{action:'list'}),e=>e.status===401);
  await db.collection('rolePermissions').doc('administrador').set({permissions:{'devices.view':false}});
  await assert.rejects(adminCommand(editor,{action:'list'}),e=>e.status===403);
  await db.collection('rolePermissions').doc('administrador').set({permissions:{'devices.view':true,'devices.manage':true}});
});
test('authorization version and idempotency protect concurrent edits', async () => {
  const {device}=await linked(); const operationId=randomUUID();
  const command={action:'authorize',deviceId:device.id,version:device.version,state:'enabled',reason:'idempotent',operationId};
  const a=await adminCommand(admin,command), b=await adminCommand(admin,command);
  assert.equal(a.device.version,b.device.version);
  await assert.rejects(adminCommand(admin,{...command,reason:'altered'}),e=>e.status===409);
  await assert.rejects(adminCommand(admin,{...command,operationId:randomUUID()}),e=>e.status===409);
});
test('revoked identity cannot be re-enabled or paired again', async () => {
  const {phone,device}=await linked();const revoked=await authorize(device,'revoked');
  await assert.rejects(authorize(revoked),e=>e.status===409);
  await assert.rejects(phone.command({action:'pair',metadata:meta}),e=>e.status===409);
});
test('distributed limiter permits only the configured attempts under contention', async () => {
  const outcomes=await Promise.allSettled(Array.from({length:4},()=>rateLimit('concurrency-test',2)));
  assert.equal(outcomes.filter(o=>o.status==='fulfilled').length,2);
  assert(outcomes.filter(o=>o.status==='rejected').every(o=>o.reason.status===429));
});
test('renewal cannot revive an expired lease', async () => {
  const { phone, device } = await linked(); await authorize(device);
  const lease = await phone.command({ action: 'start' });
  await db.collection('autoClickerDevices').doc(device.id).update({ leaseExpiresAt: Timestamp.fromMillis(Date.now()-1) });
  const renewal = await phone.command({ action:'renew', sessionId:lease.sessionId, version:lease.version });
  assert.equal(renewal.allowed,false);
});
test('concurrent renewal/revocation never allows subsequent renewal or start', async () => {
  const { phone, device } = await linked(); const enabled = await authorize(device);
  const lease = await phone.command({ action:'start' });
  const [renewal] = await Promise.all([
    phone.command({action:'renew',sessionId:lease.sessionId,version:lease.version}),
    authorize(enabled,'revoked'),
  ]);
  if (renewal.allowed) assert(renewal.durationMs <= 30000);
  assert.equal((await phone.command({action:'renew',sessionId:lease.sessionId,version:lease.version})).allowed,false);
  assert.equal((await phone.command({action:'start'})).allowed,false);
});
test('Firestore denies direct client reads/writes of devices even for dashboard users', async () => {
  const {device}=await linked();
  const url='http://127.0.0.1:8188/v1/projects/demo-karen-autoclicker/databases/(default)/documents/autoClickerDevices/'+device.id;
  const headers={Authorization:'Bearer '+viewer.token,'Content-Type':'application/json'};
  const read=await fetch(url,{headers});assert.equal(read.status,403);
  const write=await fetch(url,{method:'PATCH',headers,body:JSON.stringify({fields:{state:{stringValue:'enabled'}}})});assert.equal(write.status,403);
});
