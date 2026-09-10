import assert from 'node:assert/strict';
import test from 'node:test';
import { generateKeyPairSync, sign } from 'node:crypto';
import { canonical, codeHash, leaseDuration, pairingCode, parseKey, searchPrefixes, validSignature } from '../src/lib/autoclicker/protocol.ts';
import { normalizePermissions, permissionForDashboardPath } from '../src/lib/access-control.ts';

test('los roles existentes no adquieren permisos de dispositivos por defecto', () => {
  for (const role of ['administrador', 'candidata', 'digitador', 'usuario']) {
    const p = normalizePermissions(role, {});
    for (const key of ['view', 'manage', 'authorize', 'audit']) assert.equal(p[`devices.${key}`], false);
  }
  const p = normalizePermissions('usuario', { 'devices.view': false, 'devices.authorize': true, 'devices.audit': true, 'devices.manage': true });
  for (const key of ['view', 'manage', 'authorize', 'audit']) assert.equal(p[`devices.${key}`], false);
  assert.equal(permissionForDashboardPath('/dashboard/dispositivos'), 'devices.view');
});
test('gestionar propietario no concede autorización', () => {
  const p = normalizePermissions('administrador', { 'devices.view': true, 'devices.manage': true });
  assert.equal(p['devices.manage'], true); assert.equal(p['devices.authorize'], false);
});
test('leases respetan deshabilitación y vencimiento administrativo', () => {
  for (const state of ['disabled', 'pending', 'suspended', 'revoked']) assert.equal(leaseDuration(state, null, 100), 0);
  assert.equal(leaseDuration('enabled', null, 100), 30000);
  assert.equal(leaseDuration('enabled', 200, 100), 100);
  assert.equal(leaseDuration('enabled', 100, 100), 0);
  assert.equal(leaseDuration('enabled', 10, 100), 0);
});
test('firma ligada al desafío y al contenido; otra clave o contenido se rechazan', () => {
  const keys = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const publicKey = keys.publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  const message = canonical('challenge', 'nonce', '{"action":"start"}');
  const signature = sign('sha256', Buffer.from(message), keys.privateKey).toString('base64');
  assert.equal(validSignature(publicKey, message, signature), true);
  assert.equal(validSignature(publicKey, canonical('challenge2', 'nonce', '{"action":"start"}'), signature), false);
  assert.equal(validSignature(publicKey, canonical('challenge', 'nonce', '{"action":"stop"}'), signature), false);
  const other = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  assert.equal(validSignature(other.publicKey.export({ type: 'spki', format: 'der' }).toString('base64'), message, signature), false);
  assert.match(parseKey(publicKey).deviceId, /^[a-f0-9]{64}$/);
});
test('códigos legibles de longitud fija y HMAC dependiente del secreto', () => {
  for (let n = 0; n < 100; n++) assert.match(pairingCode(), /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  assert.equal(codeHash(' abc234 ', 'a'), codeHash('ABC234', 'a'));
  assert.notEqual(codeHash('ABC234', 'a'), codeHash('ABC234', 'b'));
});
test('búsqueda normaliza acentos y limita los prefijos', () => {
  const prefixes = searchPrefixes('Ávalos Kevin', 'Móvil', 'Galaxy');
  assert(prefixes.includes('ava')); assert(prefixes.includes('mov')); assert(prefixes.includes('galaxy'));
});
