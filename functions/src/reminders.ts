import {
  getFirestore,
  Timestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase-admin/firestore';
import { defineJsonSecret } from 'firebase-functions/params';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import webpush from 'web-push';

type WebPushConfig = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

type DateValue = { toDate(): Date; toMillis?(): number };
type ActivityStatus = 'programada' | 'confirmada' | 'completada' | 'cancelada';

type Activity = {
  titulo?: string;
  inicio?: DateValue;
  fin?: DateValue;
  todoElDia?: boolean;
  responsableNombre?: string;
  estado?: ActivityStatus;
};

type StoredSubscription = {
  endpoint?: string;
  expirationTime?: number | null;
  keys?: { p256dh?: string; auth?: string };
  userEmail?: string;
  enabled?: boolean;
};

type ValidSubscription = Required<Pick<StoredSubscription, 'endpoint' | 'keys' | 'userEmail'>>
  & StoredSubscription;

type ReminderAudience = 'all' | 'managers';
type ReminderKind =
  | 'day_before'
  | 'hour_before'
  | 'fifteen_minutes_before'
  | 'status_after_start'
  | 'status_after_end';

export type ReminderCandidate = {
  activityId: string;
  kind: ReminderKind;
  audience: ReminderAudience;
  dueAtMs: number;
  scheduleVersion: number;
  title: string;
  body: string;
};

type DeliveryResult = 'sent' | 'expired' | 'failed';
type DeliverySummary = {
  total: number;
  targeted: number;
  sent: number;
  expired: number;
  failed: number;
  ignored: number;
  removed: number;
};

const pushConfig = defineJsonSecret<WebPushConfig>('WEB_PUSH_CONFIG');
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const DUE_WINDOW_MS = 30 * MINUTE_MS;
const CLAIM_LEASE_MS = 15 * MINUTE_MS;
const RECEIPT_RETENTION_MS = 45 * DAY_MS;
const MANAGER_ROLES = new Set(['superusuario', 'administrador', 'candidata']);

function formatActivityDate(date: Date) {
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function isDue(dueAtMs: number, nowMs: number) {
  return nowMs >= dueAtMs && nowMs < dueAtMs + DUE_WINDOW_MS;
}

export function buildReminderCandidates(
  activityId: string,
  activity: Activity,
  nowMs: number,
): ReminderCandidate[] {
  const start = activity.inicio?.toDate?.();
  const end = activity.fin?.toDate?.();
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return [];
  }

  const status = activity.estado;
  if (status === 'cancelada' || status === 'completada') return [];

  const startMs = start.getTime();
  const endMs = end.getTime();
  const title = String(activity.titulo || 'Actividad').trim().slice(0, 100);
  const responsible = String(activity.responsableNombre || '').trim();
  const dateLabel = formatActivityDate(start);
  const responsibilityLabel = responsible ? ` Responsable: ${responsible}.` : '';
  const candidates: ReminderCandidate[] = [];

  const beforeStart = [
    {
      kind: 'day_before' as const,
      dueAtMs: startMs - DAY_MS,
      title: `Mañana: ${title}`,
      body: `${dateLabel}.${responsibilityLabel} Revisa los detalles de la actividad.`,
    },
    {
      kind: 'hour_before' as const,
      dueAtMs: startMs - HOUR_MS,
      title: `Inicia en 1 hora: ${title}`,
      body: `${dateLabel}.${responsibilityLabel} Verifica el punto de encuentro y las indicaciones.`,
    },
    {
      kind: 'fifteen_minutes_before' as const,
      dueAtMs: startMs - 15 * MINUTE_MS,
      title: `Inicia en 15 minutos: ${title}`,
      body: `${dateLabel}.${responsibilityLabel} La actividad está próxima a comenzar.`,
    },
  ];

  for (const reminder of beforeStart) {
    if (!isDue(reminder.dueAtMs, nowMs)) continue;
    candidates.push({
      activityId,
      kind: reminder.kind,
      audience: 'all',
      dueAtMs: reminder.dueAtMs,
      scheduleVersion: startMs,
      title: reminder.title,
      body: reminder.body,
    });
  }

  const statusAfterStartAt = startMs + 15 * MINUTE_MS;
  if (status === 'programada' && isDue(statusAfterStartAt, nowMs)) {
    candidates.push({
      activityId,
      kind: 'status_after_start',
      audience: 'managers',
      dueAtMs: statusAfterStartAt,
      scheduleVersion: startMs,
      title: `Confirma el estado: ${title}`,
      body: 'La actividad ya debió iniciar y continúa como Programada. Actualiza su estado real.',
    });
  }

  const statusAfterEndAt = endMs + 15 * MINUTE_MS;
  if (
    (status === 'programada' || status === 'confirmada')
    && isDue(statusAfterEndAt, nowMs)
  ) {
    candidates.push({
      activityId,
      kind: 'status_after_end',
      audience: 'managers',
      dueAtMs: statusAfterEndAt,
      scheduleVersion: endMs,
      title: `Actualiza el estado final: ${title}`,
      body: 'La hora de término ya pasó. Marca la actividad como Completada o Cancelada.',
    });
  }

  return candidates;
}

function validSubscription(data: StoredSubscription): data is ValidSubscription {
  return Boolean(
    data.enabled
      && data.endpoint?.startsWith('https://')
      && data.keys?.p256dh
      && data.keys?.auth
      && data.userEmail,
  );
}

async function activeProfiles(subscriptions: QueryDocumentSnapshot<DocumentData>[]) {
  const db = getFirestore();
  const emails = [...new Set(
    subscriptions
      .map((snapshot) => String(snapshot.data().userEmail || '').toLowerCase())
      .filter(Boolean),
  )];
  if (emails.length === 0) return new Map<string, string>();

  const profiles = await db.getAll(
    ...emails.map((email) => db.collection('usuarios').doc(email)),
  );
  return new Map(
    profiles
      .filter((profile) => profile.exists)
      .map((profile) => [profile.id, String(profile.data()?.rol || '')]),
  );
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function deliverPush(
  subscription: ValidSubscription,
  payload: string,
): Promise<DeliveryResult> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          expirationTime: subscription.expirationTime ?? null,
          keys: {
            p256dh: subscription.keys.p256dh!,
            auth: subscription.keys.auth!,
          },
        },
        payload,
        { TTL: 86_400, urgency: 'high' },
      );
      return 'sent';
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) return 'expired';

      const retriable = !statusCode || statusCode === 429 || statusCode >= 500;
      if (!retriable || attempt === 2) {
        console.error('No se pudo enviar un recordatorio push.', statusCode || error);
        return 'failed';
      }
      await wait(300 * 3 ** attempt);
    }
  }
  return 'failed';
}

async function broadcastReminder(
  candidate: ReminderCandidate,
): Promise<DeliverySummary> {
  const db = getFirestore();
  const snapshot = await db
    .collection('pushSubscriptions')
    .where('enabled', '==', true)
    .get();
  const profiles = await activeProfiles(snapshot.docs);
  const expiredIds = new Set<string>();
  const counters = { sent: 0, expired: 0, failed: 0, ignored: 0 };
  let targeted = 0;
  const payload = JSON.stringify({
    title: candidate.title,
    body: candidate.body,
    icon: '/brazo.png',
    badge: '/logo-fuerza.png',
    tag: `recordatorio-${candidate.activityId}-${candidate.kind}-${candidate.scheduleVersion}`,
    url: `/dashboard/calendario?actividad=${candidate.activityId}`,
  });

  for (let index = 0; index < snapshot.docs.length; index += 25) {
    const results = await Promise.all(
      snapshot.docs.slice(index, index + 25).map(async (subscriptionDoc) => {
        const subscription = subscriptionDoc.data() as StoredSubscription;
        const email = String(subscription.userEmail || '').toLowerCase();
        const currentRole = profiles.get(email);
        if (!validSubscription(subscription) || !currentRole) {
          expiredIds.add(subscriptionDoc.id);
          return 'ignored' as const;
        }
        if (candidate.audience === 'managers' && !MANAGER_ROLES.has(currentRole)) {
          return 'ignored' as const;
        }

        targeted += 1;
        const result = await deliverPush(subscription, payload);
        if (result === 'expired') expiredIds.add(subscriptionDoc.id);
        return result;
      }),
    );
    results.forEach((result) => {
      counters[result] += 1;
    });
  }

  if (expiredIds.size > 0) {
    const batch = db.batch();
    expiredIds.forEach((id) => batch.delete(db.collection('pushSubscriptions').doc(id)));
    await batch.commit();
  }

  return {
    total: snapshot.size,
    targeted,
    ...counters,
    removed: expiredIds.size,
  };
}

function reminderReceiptId(candidate: ReminderCandidate) {
  return `${candidate.activityId}_${candidate.kind}_${candidate.scheduleVersion}`;
}

async function acquireReminder(candidate: ReminderCandidate, nowMs: number) {
  const db = getFirestore();
  const receiptRef = db
    .collection('notificationReminderDeliveries')
    .doc(reminderReceiptId(candidate));

  return db.runTransaction(async (transaction) => {
    const existing = await transaction.get(receiptRef);
    const data = existing.data();
    if (data?.status === 'completed') return false;

    const claimedAt = data?.claimedAt?.toMillis?.() || 0;
    if (data?.status === 'processing' && claimedAt > nowMs - CLAIM_LEASE_MS) {
      return false;
    }

    transaction.set(receiptRef, {
      activityId: candidate.activityId,
      kind: candidate.kind,
      audience: candidate.audience,
      dueAt: Timestamp.fromMillis(candidate.dueAtMs),
      scheduleVersion: candidate.scheduleVersion,
      status: 'processing',
      claimedAt: Timestamp.fromMillis(nowMs),
    }, { merge: true });
    return true;
  });
}

async function completeReminder(
  candidate: ReminderCandidate,
  summary: DeliverySummary,
  nowMs: number,
) {
  const db = getFirestore();
  await db
    .collection('notificationReminderDeliveries')
    .doc(reminderReceiptId(candidate))
    .set({
      status: 'completed',
      completedAt: Timestamp.fromMillis(nowMs),
      delivery: summary,
    }, { merge: true });
}

async function releaseFailedReminder(candidate: ReminderCandidate, error: unknown) {
  const db = getFirestore();
  await db
    .collection('notificationReminderDeliveries')
    .doc(reminderReceiptId(candidate))
    .set({
      status: 'failed',
      lastError: error instanceof Error ? error.message.slice(0, 500) : 'Error desconocido',
      failedAt: Timestamp.now(),
    }, { merge: true });
}

async function cleanupOldReceipts(nowMs: number) {
  const db = getFirestore();
  const oldReceipts = await db
    .collection('notificationReminderDeliveries')
    .where('completedAt', '<', Timestamp.fromMillis(nowMs - RECEIPT_RETENTION_MS))
    .limit(250)
    .get();
  if (oldReceipts.empty) return 0;

  const batch = db.batch();
  oldReceipts.docs.forEach((receipt) => batch.delete(receipt.ref));
  await batch.commit();
  return oldReceipts.size;
}

async function reminderActivities(nowMs: number) {
  const db = getFirestore();
  const lowerBound = Timestamp.fromMillis(nowMs - 2 * HOUR_MS);
  const endingLowerBound = Timestamp.fromMillis(nowMs - 2 * HOUR_MS);
  const [starting, ending] = await Promise.all([
    db.collection('calendario_actividades')
      .where('inicio', '>=', lowerBound)
      .where('inicio', '<=', Timestamp.fromMillis(nowMs + 25 * HOUR_MS))
      .get(),
    db.collection('calendario_actividades')
      .where('fin', '>=', endingLowerBound)
      .where('fin', '<=', Timestamp.fromMillis(nowMs))
      .get(),
  ]);

  const activities = new Map<string, Activity>();
  starting.docs.forEach((activity) => activities.set(activity.id, activity.data() as Activity));
  ending.docs.forEach((activity) => activities.set(activity.id, activity.data() as Activity));
  return activities;
}

export const notificarRecordatoriosCalendario = onSchedule(
  {
    schedule: 'every 5 minutes',
    timeZone: 'America/Lima',
    region: 'us-central1',
    secrets: [pushConfig],
    memory: '256MiB',
    timeoutSeconds: 120,
    maxInstances: 1,
    retryCount: 1,
  },
  async () => {
    const nowMs = Date.now();
    const config = pushConfig.value();
    webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
    const activities = await reminderActivities(nowMs);
    const candidates = [...activities.entries()].flatMap(([activityId, activity]) =>
      buildReminderCandidates(activityId, activity, nowMs));
    let processed = 0;
    let duplicates = 0;
    let errors = 0;

    for (const candidate of candidates) {
      const acquired = await acquireReminder(candidate, nowMs);
      if (!acquired) {
        duplicates += 1;
        continue;
      }

      try {
        const summary = await broadcastReminder(candidate);
        await completeReminder(candidate, summary, Date.now());
        processed += 1;
        console.info('Resumen de recordatorio.', {
          activityId: candidate.activityId,
          kind: candidate.kind,
          ...summary,
        });
      } catch (error) {
        errors += 1;
        console.error('No se pudo procesar un recordatorio.', {
          activityId: candidate.activityId,
          kind: candidate.kind,
          error,
        });
        await releaseFailedReminder(candidate, error);
      }
    }

    const removedReceipts = await cleanupOldReceipts(nowMs);
    console.info('Revision programada de recordatorios.', {
      activities: activities.size,
      candidates: candidates.length,
      processed,
      duplicates,
      errors,
      removedReceipts,
    });
  },
);
