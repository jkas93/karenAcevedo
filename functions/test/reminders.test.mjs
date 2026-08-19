import assert from 'node:assert/strict';
import test from 'node:test';
import { buildReminderCandidates, reminderDeliveryOptions, reminderLogicalId } from '../lib/reminders.js';

const minute = 60_000;
const dateValue = (milliseconds) => ({ toDate: () => new Date(milliseconds) });
const activity = (start, overrides = {}) => ({
  titulo: 'Caminata', inicio: dateValue(start), fin: dateValue(start + 120 * minute),
  estado: 'programada', responsableId: 'responsable@example.com', categoria: 'territorio', ...overrides,
});

for (const [minutes, kind] of [[1440, 'day_before'], [60, 'hour_before'], [15, 'fifteen_minutes_before']]) {
  test(`genera la ventana ${minutes} minutos solo para el responsable`, () => {
    const now = Date.UTC(2026, 7, 12, 15);
    const candidates = buildReminderCandidates('a1', activity(now + minutes * minute), now);
    assert.ok(candidates.some((item) => item.kind === kind && item.audience === 'responsible'));
  });
}

test('no genera recordatorios fuera de su ventana de treinta minutos', () => {
  const start = Date.UTC(2026, 7, 12, 15);
  assert.equal(buildReminderCandidates('a1', activity(start), start - 61 * minute).some((item) => item.kind === 'hour_before'), false);
  assert.equal(buildReminderCandidates('a1', activity(start), start - 29 * minute).some((item) => item.kind === 'hour_before'), false);
});

test('pide estados post-inicio y post-fin solo a gestores', () => {
  const start = Date.UTC(2026, 7, 12, 15);
  assert.ok(buildReminderCandidates('a2', activity(start), start + 15 * minute).some((item) => item.kind === 'status_after_start' && item.audience === 'calendar_managers'));
  const end = start + 120 * minute;
  assert.ok(buildReminderCandidates('a2', activity(start), end + 15 * minute).some((item) => item.kind === 'status_after_end' && item.audience === 'calendar_managers'));
});

test('todo el día avisa a las 09:00 Lima y nunca a medianoche', () => {
  const start = Date.parse('2026-08-14T00:00:00-05:00');
  const data = activity(start, { todoElDia: true, fin: dateValue(Date.parse('2026-08-14T23:59:00-05:00')) });
  assert.equal(buildReminderCandidates('all', data, Date.parse('2026-08-13T00:00:00-05:00')).length, 0);
  const due = buildReminderCandidates('all', data, Date.parse('2026-08-13T09:00:00-05:00'));
  assert.deepEqual(due.map((item) => item.kind), ['day_before']);
});

test('canceladas y completadas no producen avisos', () => {
  const now = Date.UTC(2026, 7, 12, 15);
  for (const estado of ['cancelada', 'completada']) assert.deepEqual(buildReminderCandidates('a3', activity(now + 60 * minute, { estado }), now), []);
});

test('reprogramar cambia ID lógico y los TTL evitan avisos obsoletos', () => {
  const base = { activityId: 'a', kind: 'hour_before', scheduleVersion: 1 };
  assert.notEqual(reminderLogicalId(base), reminderLogicalId({ ...base, scheduleVersion: 2 }));
  assert.deepEqual(reminderDeliveryOptions('fifteen_minutes_before'), { ttlSeconds: 1200, urgency: 'high' });
  assert.deepEqual(reminderDeliveryOptions('hour_before'), { ttlSeconds: 3000, urgency: 'normal' });
});
