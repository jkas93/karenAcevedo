export const CALENDAR_TIME_ZONE = 'America/Lima';
export const SUPERUSER_EMAIL = '71260540@fuerzaciudadana.pe';
export const NOTIFICATION_CATEGORIES = [
  'territorio',
  'reunion',
  'comunicacion',
  'capacitacion',
  'electoral',
  'logistica',
] as const;
export const REMINDER_MINUTES = [1440, 60, 15] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];
export type ReminderMinute = (typeof REMINDER_MINUTES)[number];
export type UserRole = 'superusuario' | 'administrador' | 'candidata' | 'digitador' | 'usuario';
export type NotificationKind = 'change' | 'reminder' | 'status_request';
export type NotificationAudience = 'relevant_change' | 'responsible' | 'calendar_managers';

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

export type RecipientProfile = {
  email: string;
  uid?: string;
  role: UserRole;
  canViewCalendar: boolean;
  canManageCalendar: boolean;
};

export type NotificationIntent = {
  kind: NotificationKind;
  audience: NotificationAudience;
  category: NotificationCategory;
  responsibleId: string;
  critical: boolean;
  reminderMinutes?: ReminderMinute;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  schemaVersion: 1,
  changes: true,
  reminders: true,
  statusRequests: true,
  categories: [...NOTIFICATION_CATEGORIES],
  reminderMinutes: [...REMINDER_MINUTES],
  onlyRelevant: true,
  quietHours: { enabled: false, start: '22:00', end: '07:00', allowCritical: true },
};

const DEFAULT_CALENDAR_PERMISSIONS: Record<UserRole, { view: boolean; manage: boolean }> = {
  superusuario: { view: true, manage: true },
  administrador: { view: true, manage: true },
  candidata: { view: true, manage: true },
  digitador: { view: true, manage: false },
  usuario: { view: true, manage: false },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isRole(value: unknown): value is UserRole {
  return typeof value === 'string'
    && ['superusuario', 'administrador', 'candidata', 'digitador', 'usuario'].includes(value);
}

function normalizeTime(value: unknown, fallback: string) {
  return typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)
    ? value
    : fallback;
}

export function normalizePreferences(value: unknown): NotificationPreferences {
  const source = isRecord(value) ? value : {};
  const quiet = isRecord(source.quietHours) ? source.quietHours : {};
  const categories = Array.isArray(source.categories)
    ? source.categories.filter(
        (item): item is NotificationCategory =>
          typeof item === 'string' && NOTIFICATION_CATEGORIES.includes(item as NotificationCategory),
      )
    : DEFAULT_NOTIFICATION_PREFERENCES.categories;
  const reminderMinutes = Array.isArray(source.reminderMinutes)
    ? source.reminderMinutes.filter(
        (item): item is ReminderMinute =>
          typeof item === 'number' && REMINDER_MINUTES.includes(item as ReminderMinute),
      )
    : DEFAULT_NOTIFICATION_PREFERENCES.reminderMinutes;
  return {
    schemaVersion: 1,
    changes: typeof source.changes === 'boolean' ? source.changes : true,
    reminders: typeof source.reminders === 'boolean' ? source.reminders : true,
    statusRequests: typeof source.statusRequests === 'boolean' ? source.statusRequests : true,
    categories: [...new Set(categories)],
    reminderMinutes: [...new Set(reminderMinutes)].sort((a, b) => b - a),
    onlyRelevant: typeof source.onlyRelevant === 'boolean' ? source.onlyRelevant : true,
    quietHours: {
      enabled: typeof quiet.enabled === 'boolean' ? quiet.enabled : false,
      start: normalizeTime(quiet.start, '22:00'),
      end: normalizeTime(quiet.end, '07:00'),
      allowCritical: typeof quiet.allowCritical === 'boolean' ? quiet.allowCritical : true,
    },
  };
}

export function effectiveCalendarPermissions(
  email: string,
  storedRole: unknown,
  configuredPermissions: unknown,
): { role: UserRole; canViewCalendar: boolean; canManageCalendar: boolean } | null {
  const canonicalEmail = email.trim().toLowerCase();
  const role: UserRole | null = canonicalEmail === SUPERUSER_EMAIL
    ? 'superusuario'
    : isRole(storedRole) && storedRole !== 'superusuario'
      ? storedRole
      : null;
  if (!role) return null;
  if (role === 'superusuario') {
    return { role, canViewCalendar: true, canManageCalendar: true };
  }
  const source = isRecord(configuredPermissions) ? configuredPermissions : {};
  let canViewCalendar = typeof source['calendar.view'] === 'boolean'
    ? source['calendar.view']
    : DEFAULT_CALENDAR_PERMISSIONS[role].view;
  let canManageCalendar = typeof source['calendar.manage'] === 'boolean'
    ? source['calendar.manage']
    : DEFAULT_CALENDAR_PERMISSIONS[role].manage;
  if (!canViewCalendar) canManageCalendar = false;
  if (canManageCalendar) canViewCalendar = true;
  return { role, canViewCalendar, canManageCalendar };
}

function minuteOfDay(date: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: CALENDAR_TIME_ZONE,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date).map((part) => [part.type, Number(part.value)]),
  );
  return Number(parts.hour) * 60 + Number(parts.minute);
}

export function isQuietTime(now: Date, start: string, end: string) {
  const parse = (value: string) => {
    const match = /^(\d{2}):(\d{2})$/.exec(value);
    if (!match) return null;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    return hour <= 23 && minute <= 59 ? hour * 60 + minute : null;
  };
  const startMinute = parse(start);
  const endMinute = parse(end);
  if (startMinute === null || endMinute === null || startMinute === endMinute) return false;
  const current = minuteOfDay(now);
  return startMinute < endMinute
    ? current >= startMinute && current < endMinute
    : current >= startMinute || current < endMinute;
}

export function shouldNotifyRecipient(
  profile: RecipientProfile | undefined,
  rawPreferences: unknown,
  intent: NotificationIntent,
  now: Date,
) {
  if (!profile?.canViewCalendar) return false;
  const preferences = normalizePreferences(rawPreferences);
  if (!preferences.categories.includes(intent.category)) return false;
  if (intent.kind === 'change' && !preferences.changes) return false;
  if (intent.kind === 'reminder') {
    if (!preferences.reminders) return false;
    if (intent.reminderMinutes && !preferences.reminderMinutes.includes(intent.reminderMinutes)) {
      return false;
    }
  }
  if (intent.kind === 'status_request' && !preferences.statusRequests) return false;

  const email = profile.email.toLowerCase();
  const responsible = intent.responsibleId.trim().toLowerCase();
  if (intent.audience === 'responsible' && email !== responsible) return false;
  if (intent.audience === 'calendar_managers' && !profile.canManageCalendar) return false;
  if (
    intent.audience === 'relevant_change'
    && preferences.onlyRelevant
    && email !== responsible
    && !profile.canManageCalendar
  ) {
    return false;
  }

  if (
    preferences.quietHours.enabled
    && isQuietTime(now, preferences.quietHours.start, preferences.quietHours.end)
    && !(intent.critical && preferences.quietHours.allowCritical)
  ) {
    return false;
  }
  return true;
}
