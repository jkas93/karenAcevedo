// Production-safe smoke: temporary unlinked identity, no administrator or device mutations.
import assert from 'node:assert/strict';
import { generateKeyPairSync, createHash, sign } from 'node:crypto';
const origin = process.argv[2] || 'https://karenacevedo.com';
assert.equal(new URL(origin).protocol, 'https:');
const keys = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const publicKey = keys.publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
async function post(path, body, status = 200) {
  const r = await fetch(`${origin}/api/autoclicker/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) });
  const data = await r.json();
  assert.equal(r.status, status, `${path}: ${JSON.stringify(data)}`);
  assert.match(r.headers.get('cache-control'), /no-store/);
  return data;
}
async function envelope(command) {
  const c = await post('device/challenge', { publicKey });
  const payload = JSON.stringify(command);
  const digest = createHash('sha256').update(payload).digest('hex');
  const message = `karen-autoclicker-v1\n${c.challengeId}\n${c.nonce}\n${digest}`;
  return { challengeId: c.challengeId, payload, signature: sign('sha256', Buffer.from(message), keys.privateKey).toString('base64') };
}
await post('admin', { action: 'list' }, 401);
console.log('PASS: administrator endpoint rejects unauthenticated access');
await post('device/challenge', { publicKey: 'invalid' }, 400);
console.log('PASS: invalid public key rejected');
const status = await envelope({ action: 'status' });
assert.equal((await post('device/command', status)).state, 'pending');
await post('device/command', status, 401);
console.log('PASS: signed status accepted and replay rejected');
const pairing = await post('device/command', await envelope({ action: 'pair', metadata: { manufacturer: 'Smoke test', model: 'Temporary unlinked identity', android: 'test', appVersion: 'test', width: 1080, height: 2400 } }));
assert.match(pairing.code, /^[A-HJ-NP-Z2-9]{6}$/);
console.log('PASS: six-character pairing code issued (not displayed)');
assert.equal((await post('device/command', await envelope({ action: 'start' }))).allowed, false);
console.log('PASS: unregistered identity cannot start');
console.log('Smoke completed. Temporary challenges and unclaimed pairing expire through TTL.');
