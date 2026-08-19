import assert from 'node:assert/strict';
import test from 'node:test';
import { effectiveCalendarPermissions, shouldNotifyRecipient } from '../lib/notification-policy.js';

const profile = { email: 'responsable@example.com', role: 'usuario', canViewCalendar: true, canManageCalendar: false };
const intent = { kind: 'reminder', audience: 'responsible', category: 'territorio', responsibleId: profile.email, critical: false, reminderMinutes: 60 };

test('respeta permiso efectivo calendar.view configurado en servidor', () => {
  const denied = effectiveCalendarPermissions(profile.email, 'usuario', { 'calendar.view': false, 'calendar.manage': true });
  assert.equal(denied.canViewCalendar, false);
  assert.equal(denied.canManageCalendar, false);
  assert.equal(shouldNotifyRecipient({ ...profile, ...denied }, {}, intent, new Date()), false);
});

test('recordatorios ordinarios solo llegan al responsable', () => {
  assert.equal(shouldNotifyRecipient(profile, {}, intent, new Date()), true);
  assert.equal(shouldNotifyRecipient({ ...profile, email: 'otro@example.com' }, {}, intent, new Date()), false);
});

test('alertas de estado requieren calendar.manage', () => {
  const status = { ...intent, kind: 'status_request', audience: 'calendar_managers' };
  assert.equal(shouldNotifyRecipient(profile, {}, status, new Date()), false);
  assert.equal(shouldNotifyRecipient({ ...profile, canManageCalendar: true }, {}, status, new Date()), true);
});

test('preferencias, anticipación, categorías y horario silencioso se aplican', () => {
  assert.equal(shouldNotifyRecipient(profile, { reminders: false }, intent, new Date()), false);
  assert.equal(shouldNotifyRecipient(profile, { reminderMinutes: [15] }, intent, new Date()), false);
  assert.equal(shouldNotifyRecipient(profile, { categories: ['reunion'] }, intent, new Date()), false);
  const lima2300 = new Date('2026-08-20T23:00:00-05:00');
  const quiet = { quietHours: { enabled: true, start: '22:00', end: '07:00', allowCritical: true } };
  assert.equal(shouldNotifyRecipient(profile, quiet, intent, lima2300), false);
  assert.equal(shouldNotifyRecipient(profile, quiet, { ...intent, critical: true }, lima2300), true);
});

test('solo relevantes deja pasar responsable o gestor', () => {
  const change = { ...intent, kind: 'change', audience: 'relevant_change', responsibleId: 'otra@example.com' };
  assert.equal(shouldNotifyRecipient(profile, { onlyRelevant: true }, change, new Date()), false);
  assert.equal(shouldNotifyRecipient({ ...profile, canManageCalendar: true }, { onlyRelevant: true }, change, new Date()), true);
});
