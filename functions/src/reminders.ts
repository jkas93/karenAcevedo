import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { defineJsonSecret } from 'firebase-functions/params';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import webpush from 'web-push';
import {
  acquireDeliveryReceipt,
  broadcastNotification,
  cleanupNotificationData,
  completeDeliveryReceipt,
  failDeliveryReceipt,
  logNotification,
  type WebPushUrgency,
} from './notification-delivery.js';
import { CALENDAR_TIME_ZONE, type NotificationCategory, type ReminderMinute } from './notification-policy.js';

type WebPushConfig = { publicKey: string; privateKey: string; subject: string };
type DateValue = { toDate(): Date };
type ActivityStatus = 'programada' | 'confirmada' | 'completada' | 'cancelada';
type Activity = {
  titulo?: string;
  inicio?: DateValue;
  fin?: DateValue;
  todoElDia?: boolean;
  responsableId?: string;
  responsableNombre?: string;
  estado?: ActivityStatus;
  categoria?: NotificationCategory;
};
type ReminderKind = 'day_before' | 'hour_before' | 'fifteen_minutes_before' | 'status_after_start' | 'status_after_end';

export type ReminderCandidate = {
  activityId: string;
  kind: ReminderKind;
  dueAtMs: number;
  scheduleVersion: number;
  title: string;
  body: string;
  category: NotificationCategory;
  responsibleId: string;
  intentKind: 'reminder' | 'status_request';
  audience: 'responsible' | 'calendar_managers';
  reminderMinutes?: ReminderMinute;
};

const pushConfig = defineJsonSecret<WebPushConfig>('WEB_PUSH_CONFIG');
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
export const DUE_WINDOW_MS = 30 * MINUTE_MS;

function formatActivityDate(date: Date, allDay = false) {
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: CALENDAR_TIME_ZONE,
    weekday: 'short', day: '2-digit', month: 'short',
    ...(allDay ? {} : { hour: '2-digit', minute: '2-digit' }),
  }).format(date);
}

export function isDue(dueAtMs: number, nowMs: number) {
  return nowMs >= dueAtMs && nowMs < dueAtMs + DUE_WINDOW_MS;
}

function atLimaHour(instantMs: number, hour: number) {
  const limaDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: CALENDAR_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(instantMs));
  return new Date(`${limaDate}T${String(hour).padStart(2, '0')}:00:00-05:00`).getTime();
}

export function buildReminderCandidates(activityId: string, activity: Activity, nowMs: number): ReminderCandidate[] {
  const start = activity.inicio?.toDate?.();
  const end = activity.fin?.toDate?.();
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  if (activity.estado === 'cancelada' || activity.estado === 'completada') return [];

  const startMs = start.getTime();
  const endMs = end.getTime();
  const allDay = activity.todoElDia === true;
  const title = String(activity.titulo || 'Actividad').trim().slice(0, 100);
  const responsibleId = String(activity.responsableId || '').trim().toLowerCase();
  const responsible = String(activity.responsableNombre || '').trim();
  const category = activity.categoria || 'territorio';
  const dateLabel = formatActivityDate(start, allDay);
  const responsibility = responsible ? ` Responsable: ${responsible}.` : '';
  const candidates: ReminderCandidate[] = [];
  const reminderDefinitions = allDay
    ? [{ kind: 'day_before' as const, minutes: 1440 as const, dueAtMs: atLimaHour(startMs - DAY_MS, 9), label: `Mañana: ${title}` }]
    : [
        { kind: 'day_before' as const, minutes: 1440 as const, dueAtMs: startMs - DAY_MS, label: `Mañana: ${title}` },
        { kind: 'hour_before' as const, minutes: 60 as const, dueAtMs: startMs - HOUR_MS, label: `Inicia en 1 hora: ${title}` },
        { kind: 'fifteen_minutes_before' as const, minutes: 15 as const, dueAtMs: startMs - 15 * MINUTE_MS, label: `Inicia en 15 minutos: ${title}` },
      ];

  for (const reminder of reminderDefinitions) {
    if (!isDue(reminder.dueAtMs, nowMs)) continue;
    candidates.push({
      activityId, kind: reminder.kind, dueAtMs: reminder.dueAtMs, scheduleVersion: startMs,
      title: reminder.label,
      body: `${dateLabel}.${responsibility} Abre el calendario para revisar los detalles.`,
      category, responsibleId, intentKind: 'reminder', audience: 'responsible', reminderMinutes: reminder.minutes,
    });
  }

  const afterStartAt = allDay ? atLimaHour(startMs, 9) : startMs + 15 * MINUTE_MS;
  if (activity.estado === 'programada' && isDue(afterStartAt, nowMs)) {
    candidates.push({
      activityId, kind: 'status_after_start', dueAtMs: afterStartAt, scheduleVersion: startMs,
      title: `Confirma el estado: ${title}`,
      body: 'La actividad ya debió iniciar y continúa como Programada. Actualiza su estado real.',
      category, responsibleId, intentKind: 'status_request', audience: 'calendar_managers',
    });
  }
  const afterEndAt = allDay ? atLimaHour(endMs + DAY_MS, 9) : endMs + 15 * MINUTE_MS;
  if ((activity.estado === 'programada' || activity.estado === 'confirmada') && isDue(afterEndAt, nowMs)) {
    candidates.push({
      activityId, kind: 'status_after_end', dueAtMs: afterEndAt, scheduleVersion: endMs,
      title: `Actualiza el estado final: ${title}`,
      body: 'La hora de término ya pasó. Marca la actividad como Completada o Cancelada.',
      category, responsibleId, intentKind: 'status_request', audience: 'calendar_managers',
    });
  }
  return candidates;
}

export function reminderDeliveryOptions(kind: ReminderKind): { ttlSeconds: number; urgency: WebPushUrgency } {
  if (kind === 'fifteen_minutes_before') return { ttlSeconds: 20 * 60, urgency: 'high' };
  if (kind === 'hour_before') return { ttlSeconds: 50 * 60, urgency: 'normal' };
  if (kind === 'day_before') return { ttlSeconds: 6 * 60 * 60, urgency: 'normal' };
  return { ttlSeconds: 4 * 60 * 60, urgency: 'normal' };
}

export function reminderLogicalId(candidate: ReminderCandidate) {
  return `reminder|${candidate.activityId}|${candidate.kind}|${candidate.scheduleVersion}`;
}

export function legacyReminderReceiptId(candidate: ReminderCandidate) {
  return `${candidate.activityId}_${candidate.kind}_${candidate.scheduleVersion}`;
}

async function reminderActivities(nowMs: number) {
  const db = getFirestore();
  const [starting, ending] = await Promise.all([
    db.collection('calendario_actividades')
      .where('inicio', '>=', Timestamp.fromMillis(nowMs - 12 * HOUR_MS))
      .where('inicio', '<=', Timestamp.fromMillis(nowMs + 25 * HOUR_MS)).get(),
    db.collection('calendario_actividades')
      .where('fin', '>=', Timestamp.fromMillis(nowMs - 36 * HOUR_MS))
      .where('fin', '<=', Timestamp.fromMillis(nowMs + DAY_MS)).get(),
  ]);
  const activities = new Map<string, Activity>();
  starting.docs.forEach((doc) => activities.set(doc.id, doc.data() as Activity));
  ending.docs.forEach((doc) => activities.set(doc.id, doc.data() as Activity));
  return activities;
}

export const notificarRecordatoriosCalendario = onSchedule(
  {
    schedule: 'every 5 minutes', timeZone: CALENDAR_TIME_ZONE, region: 'us-central1',
    secrets: [pushConfig], memory: '256MiB', timeoutSeconds: 120, maxInstances: 1, retryCount: 1,
  },
  async () => {
    const nowMs = Date.now();
    const config = pushConfig.value();
    webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
    const db = getFirestore();
    const activities = await reminderActivities(nowMs);
    const candidates = [...activities.entries()].flatMap(([id, activity]) => buildReminderCandidates(id, activity, nowMs));
    let processed = 0;
    let duplicates = 0;
    let errors = 0;

    for (const candidate of candidates) {
      const logicalId = reminderLogicalId(candidate);
      const receipt = await acquireDeliveryReceipt(db, logicalId, {
        activityId: candidate.activityId, kind: candidate.kind, scheduleVersion: candidate.scheduleVersion,
      }, nowMs, legacyReminderReceiptId(candidate));
      if (!receipt) { duplicates += 1; continue; }
      try {
        const options = reminderDeliveryOptions(candidate.kind);
        const summary = await broadcastNotification(db, {
          logicalId, activityId: candidate.activityId, title: candidate.title, body: candidate.body,
          url: `/dashboard/calendario?actividad=${candidate.activityId}`,
          tag: `calendario-${candidate.activityId}`,
          ...options,
          intent: {
            kind: candidate.intentKind, audience: candidate.audience, category: candidate.category,
            responsibleId: candidate.responsibleId, critical: candidate.kind === 'fifteen_minutes_before',
            reminderMinutes: candidate.reminderMinutes,
          },
        }, new Date(nowMs));
        if (summary.failed > 0) throw new Error(`${summary.failed} dispositivo(s) rechazaron el envío tras los reintentos.`);
        await completeDeliveryReceipt(receipt, summary);
        processed += 1;
        logNotification(summary.targeted === 0 ? 'warn' : 'info', 'reminder_completed', { logicalId, ...summary });
      } catch (error) {
        errors += 1;
        await failDeliveryReceipt(receipt, error);
        logNotification('error', 'reminder_failed', { logicalId, error: error instanceof Error ? error.message : String(error) });
      }
    }

    const removed = await cleanupNotificationData(db, nowMs);
    logNotification(errors > 0 ? 'error' : 'info', 'scheduler_health', {
      activities: activities.size, candidates: candidates.length, processed, duplicates, errors, removed,
    });
  },
);
