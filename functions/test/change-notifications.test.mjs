import assert from 'node:assert/strict';
import test from 'node:test';
import { changeDeliveryOptions, changeLogicalId, describeChange } from '../lib/change-notifications.js';

const dateValue = (value) => ({ toDate: () => new Date(value) });
test('resume diferencias útiles de hora, lugar, estado y responsable', () => {
  const message = describeChange(
    { inicio: dateValue('2026-08-20T10:00:00-05:00'), ubicacion: 'A', estado: 'programada', responsableId: 'a' },
    { inicio: dateValue('2026-08-20T11:00:00-05:00'), ubicacion: 'B', estado: 'confirmada', responsableId: 'b', responsableNombre: 'Beatriz' },
  );
  assert.match(message.body, /hora:/);
  assert.match(message.body, /lugar: B/);
  assert.match(message.body, /estado: confirmada/);
  assert.match(message.body, /responsable: Beatriz/);
});

test('cancelación próxima es crítica; actualización normal no lo es', () => {
  const now = Date.now();
  assert.equal(changeDeliveryOptions('cancelled', { inicio: dateValue(now + 60_000) }, now).urgency, 'high');
  assert.deepEqual(changeDeliveryOptions('updated', {}, now), { ttlSeconds: 7200, urgency: 'normal', critical: false });
});

test('idempotencia distingue versión y tipo del cambio', () => {
  assert.notEqual(changeLogicalId('a', 'updated', 'v1'), changeLogicalId('a', 'updated', 'v2'));
  assert.notEqual(changeLogicalId('a', 'updated', 'v1'), changeLogicalId('a', 'cancelled', 'v1'));
});
