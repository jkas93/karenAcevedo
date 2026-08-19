export const NOTIFICATION_CATEGORY_VALUES = [
  'territorio',
  'reunion',
  'comunicacion',
  'capacitacion',
  'electoral',
  'logistica',
] as const;

export const REMINDER_MINUTE_VALUES = [1440, 60, 15] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORY_VALUES)[number];
export type ReminderMinute = (typeof REMINDER_MINUTE_VALUES)[number];

export type NotificationPreferences = {
  schemaVersion: 1;
  changes: boolean;
  reminders: boolean;
  statusRequests: boolean;
  categories: NotificationCategory[];
  reminderMinutes: ReminderMinute[];
  onlyRelevant: boolean;
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
    allowCritical: boolean;
  };
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  schemaVersion: 1,
  changes: true,
  reminders: true,
  statusRequests: true,
  categories: [...NOTIFICATION_CATEGORY_VALUES],
  reminderMinutes: [...REMINDER_MINUTE_VALUES],
  onlyRelevant: true,
  quietHours: {
    enabled: false,
    start: '22:00',
    end: '07:00',
    allowCritical: true,
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeTime(value: unknown, fallback: string) {
  if (typeof value !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    return fallback;
  }
  return value;
}

export function normalizeNotificationPreferences(value: unknown): NotificationPreferences {
  const source = isRecord(value) ? value : {};
  const quiet = isRecord(source.quietHours) ? source.quietHours : {};
  const categories = Array.isArray(source.categories)
    ? source.categories.filter(
        (item): item is NotificationCategory =>
          typeof item === 'string'
          && NOTIFICATION_CATEGORY_VALUES.includes(item as NotificationCategory),
      )
    : DEFAULT_NOTIFICATION_PREFERENCES.categories;
  const reminderMinutes = Array.isArray(source.reminderMinutes)
    ? source.reminderMinutes.filter(
        (item): item is ReminderMinute =>
          typeof item === 'number'
          && REMINDER_MINUTE_VALUES.includes(item as ReminderMinute),
      )
    : DEFAULT_NOTIFICATION_PREFERENCES.reminderMinutes;

  return {
    schemaVersion: 1,
    changes: typeof source.changes === 'boolean'
      ? source.changes
      : DEFAULT_NOTIFICATION_PREFERENCES.changes,
    reminders: typeof source.reminders === 'boolean'
      ? source.reminders
      : DEFAULT_NOTIFICATION_PREFERENCES.reminders,
    statusRequests: typeof source.statusRequests === 'boolean'
      ? source.statusRequests
      : DEFAULT_NOTIFICATION_PREFERENCES.statusRequests,
    categories: [...new Set(categories)],
    reminderMinutes: [...new Set(reminderMinutes)].sort((a, b) => b - a),
    onlyRelevant: typeof source.onlyRelevant === 'boolean'
      ? source.onlyRelevant
      : DEFAULT_NOTIFICATION_PREFERENCES.onlyRelevant,
    quietHours: {
      enabled: typeof quiet.enabled === 'boolean'
        ? quiet.enabled
        : DEFAULT_NOTIFICATION_PREFERENCES.quietHours.enabled,
      start: normalizeTime(quiet.start, DEFAULT_NOTIFICATION_PREFERENCES.quietHours.start),
      end: normalizeTime(quiet.end, DEFAULT_NOTIFICATION_PREFERENCES.quietHours.end),
      allowCritical: typeof quiet.allowCritical === 'boolean'
        ? quiet.allowCritical
        : DEFAULT_NOTIFICATION_PREFERENCES.quietHours.allowCritical,
    },
  };
}

export function isStrictNotificationPreferences(value: unknown) {
  if (!isRecord(value) || value.schemaVersion !== 1) return false;
  const normalized = normalizeNotificationPreferences(value);
  return JSON.stringify(normalized) === JSON.stringify(value);
}
