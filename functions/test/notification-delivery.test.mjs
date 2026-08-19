import assert from 'node:assert/strict';
import test from 'node:test';
import { canAcquireReceipt, classifyPushError, retentionCutoff } from '../lib/notification-delivery.js';

const timestamp = (value) => ({ toMillis: () => value });
test('lease evita duplicados activos y permite reintentar fallos antiguos', () => {
  const now = Date.now();
  assert.equal(canAcquireReceipt({ status: 'completed' }, now), false);
  assert.equal(canAcquireReceipt({ status: 'processing', claimedAt: timestamp(now - 1_000) }, now), false);
  assert.equal(canAcquireReceipt({ status: 'processing', claimedAt: timestamp(now - 16 * 60_000) }, now), true);
  assert.equal(canAcquireReceipt({ status: 'failed' }, now), true);
});

test('clasifica expirados, reintentables y errores permanentes', () => {
  assert.equal(classifyPushError(410), 'expired');
  assert.equal(classifyPushError(429), 'retriable');
  assert.equal(classifyPushError(503), 'retriable');
  assert.equal(classifyPushError(400), 'failed');
});

test('retención de recibos es de 45 días', () => {
  const now = Date.parse('2026-08-19T12:00:00Z');
  assert.equal(retentionCutoff(now).toMillis(), now - 45 * 24 * 60 * 60_000);
});
