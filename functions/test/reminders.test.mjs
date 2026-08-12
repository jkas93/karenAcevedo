import assert from 'node:assert/strict';
import test from 'node:test';
import { buildReminderCandidates } from '../lib/reminders.js';

const dateValue = (milliseconds) => ({ toDate: () => new Date(milliseconds) });

test('genera recordatorio para todos exactamente un día antes', () => {
  const now = Date.UTC(2026, 7, 12, 15, 0, 0);
  const start = now + 24 * 60 * 60 * 1000;
  const candidates = buildReminderCandidates('actividad-1', {
    titulo: 'Caminata',
    inicio: dateValue(start),
    fin: dateValue(start + 60 * 60 * 1000),
    estado: 'programada',
  }, now);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].kind, 'day_before');
  assert.equal(candidates[0].audience, 'all');
});

test('pide estado real a responsables después del inicio', () => {
  const start = Date.UTC(2026, 7, 12, 15, 0, 0);
  const now = start + 15 * 60 * 1000;
  const candidates = buildReminderCandidates('actividad-2', {
    titulo: 'Reunión',
    inicio: dateValue(start),
    fin: dateValue(start + 60 * 60 * 1000),
    estado: 'programada',
  }, now);
  assert.ok(candidates.some((candidate) => candidate.kind === 'status_after_start' && candidate.audience === 'managers'));
});

test('no genera avisos para actividades canceladas o completadas', () => {
  const now = Date.UTC(2026, 7, 12, 15, 0, 0);
  for (const estado of ['cancelada', 'completada']) {
    assert.deepEqual(buildReminderCandidates('actividad-3', {
      inicio: dateValue(now + 60 * 60 * 1000),
      fin: dateValue(now + 2 * 60 * 60 * 1000),
      estado,
    }, now), []);
  }
});
