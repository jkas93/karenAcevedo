export const CALENDAR_TIME_ZONE = 'America/Lima';
export const CALENDAR_UTC_OFFSET = '-05:00';

const limaPartsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: CALENDAR_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function parts(date: Date) {
  return Object.fromEntries(
    limaPartsFormatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', number>;
}

/** A local Date whose wall-clock fields represent the same instant in America/Lima. */
export function toCalendarWallClock(date: Date) {
  const value = parts(date);
  return new Date(
    value.year,
    value.month - 1,
    value.day,
    value.hour,
    value.minute,
    value.second,
    date.getMilliseconds(),
  );
}

export function calendarNow() {
  return toCalendarWallClock(new Date());
}

export function calendarDateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function calendarTimeInput(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function calendarDateTimeToDate(date: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return new Date(Number.NaN);
  }
  return new Date(`${date}T${time}:00${CALENDAR_UTC_OFFSET}`);
}

export function calendarMinuteOfDay(date: Date) {
  const value = parts(date);
  return value.hour * 60 + value.minute;
}

export function isCalendarQuietTime(
  date: Date,
  start: string,
  end: string,
) {
  const parse = (value: string) => {
    const match = /^(\d{2}):(\d{2})$/.exec(value);
    if (!match) return null;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour > 23 || minute > 59) return null;
    return hour * 60 + minute;
  };
  const startMinute = parse(start);
  const endMinute = parse(end);
  if (startMinute === null || endMinute === null || startMinute === endMinute) return false;
  const current = calendarMinuteOfDay(date);
  return startMinute < endMinute
    ? current >= startMinute && current < endMinute
    : current >= startMinute || current < endMinute;
}
