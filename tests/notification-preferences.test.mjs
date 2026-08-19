import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_NOTIFICATION_PREFERENCES, isStrictNotificationPreferences, normalizeNotificationPreferences } from '../src/lib/pwa/notification-preferences.ts';

test('valores ausentes reciben defaults seguros y compatibles', () => {
  assert.deepEqual(normalizeNotificationPreferences(undefined), DEFAULT_NOTIFICATION_PREFERENCES);
});

test('normaliza categorías, anticipaciones y horas inválidas', () => {
  const value = normalizeNotificationPreferences({ categories: ['reunion', 'x', 'reunion'], reminderMinutes: [15, 999], quietHours: { start: '99:00' } });
  assert.deepEqual(value.categories, ['reunion']);
  assert.deepEqual(value.reminderMinutes, [15]);
  assert.equal(value.quietHours.start, '22:00');
});

test('validación estricta acepta solo el contrato completo normalizado', () => {
  assert.equal(isStrictNotificationPreferences(DEFAULT_NOTIFICATION_PREFERENCES), true);
  assert.equal(isStrictNotificationPreferences({ changes: true }), false);
});
