import assert from 'node:assert/strict';
import test from 'node:test';
import { calendarDateTimeToDate, calendarMinuteOfDay, isCalendarQuietTime, toCalendarWallClock } from '../src/lib/calendar-timezone.ts';

test('captura fecha y hora siempre como America/Lima', () => {
  assert.equal(calendarDateTimeToDate('2026-08-19', '09:30').toISOString(), '2026-08-19T14:30:00.000Z');
});

test('muestra un instante con campos de reloj de Lima', () => {
  const wall = toCalendarWallClock(new Date('2026-08-19T14:30:00Z'));
  assert.equal(wall.getHours(), 9);
  assert.equal(wall.getMinutes(), 30);
});

test('quiet hours cruza medianoche en hora Lima', () => {
  const instant = new Date('2026-08-20T04:00:00Z');
  assert.equal(calendarMinuteOfDay(instant), 23 * 60);
  assert.equal(isCalendarQuietTime(instant, '22:00', '07:00'), true);
  assert.equal(isCalendarQuietTime(new Date('2026-08-20T15:00:00Z'), '22:00', '07:00'), false);
});
