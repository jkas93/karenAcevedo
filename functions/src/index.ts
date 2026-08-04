import { initializeApp } from 'firebase-admin/app';
import { getFirestore, type DocumentData, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { defineJsonSecret } from 'firebase-functions/params';
import webpush from 'web-push';

export { notificarRecordatoriosCalendario } from './reminders.js';

initializeApp();

type WebPushConfig = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

type Activity = {
  titulo?: string;
  inicio?: { toDate(): Date };
  ubicacion?: string;
  responsableNombre?: string;
  estado?: string;
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


const pushConfig = defineJsonSecret<WebPushConfig>('WEB_PUSH_CONFIG');
const db = getFirestore();

function describeChange(before: Activity | undefined, after: Activity | undefined) {
  const activity = after || before || {};
  const date = activity.inicio?.toDate?.();
  const dateLabel = date
    ? new Intl.DateTimeFormat('es-PE', {
        timeZone: 'America/Lima',
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date)
    : 'Fecha por confirmar';
  const body = `${dateLabel}. Abre la aplicacion para consultar los detalles.`;

  if (!before && after) {
    return { title: 'Nueva actividad en el calendario', body };
  }
  if (before && !after) {
    return { title: 'Actividad eliminada del calendario', body };
  }
  if (after?.estado === 'cancelada' && before?.estado !== 'cancelada') {
    return { title: 'Actividad cancelada', body };
  }
  if (after?.estado === 'completada' && before?.estado !== 'completada') {
    return { title: 'Actividad completada', body };
  }
  return { title: 'Actividad actualizada', body };
}

function validSubscription(data: StoredSubscription): data is ValidSubscription {
  return Boolean(
    data.enabled &&
      data.endpoint?.startsWith('https://') &&
      data.keys?.p256dh &&
      data.keys?.auth &&
      data.userEmail,
  );
}

async function activeEmails(subscriptions: QueryDocumentSnapshot<DocumentData>[]) {
  const emails = [...new Set(
    subscriptions
      .map((snapshot) => String(snapshot.data().userEmail || '').toLowerCase())
      .filter(Boolean),
  )];
  if (emails.length === 0) return new Set<string>();

  const profiles = await db.getAll(
    ...emails.map((email) => db.collection('usuarios').doc(email)),
  );
  return new Set(profiles.filter((profile) => profile.exists).map((profile) => profile.id));
}
type DeliveryResult = 'sent' | 'expired' | 'failed';

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
        { TTL: 86400, urgency: 'high' },
      );
      return 'sent';
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) return 'expired';

      const retriable = !statusCode || statusCode === 429 || statusCode >= 500;
      if (!retriable || attempt === 2) {
        console.error('No se pudo enviar una notificacion push.', statusCode || error);
        return 'failed';
      }
      await wait(300 * 3 ** attempt);
    }
  }
  return 'failed';
}

export const notificarCambioCalendario = onDocumentWritten(
  {
    document: 'calendario_actividades/{activityId}',
    region: 'us-central1',
    secrets: [pushConfig],
    memory: '256MiB',
    timeoutSeconds: 60,
    maxInstances: 3,
    retry: false,
  },
  async (event) => {
    const before = event.data?.before.exists
      ? (event.data.before.data() as Activity)
      : undefined;
    const after = event.data?.after.exists
      ? (event.data.after.data() as Activity)
      : undefined;
    const message = describeChange(before, after);
    const config = pushConfig.value();
    webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);

    const subscriptionSnapshot = await db
      .collection('pushSubscriptions')
      .where('enabled', '==', true)
      .get();
    if (subscriptionSnapshot.empty) {
      console.info('Resumen de notificaciones.', { activityId: event.params.activityId, total: 0 });
      return;
    }

    const active = await activeEmails(subscriptionSnapshot.docs);
    const expiredIds = new Set<string>();
    const payload = JSON.stringify({
      ...message,
      icon: '/brazo.png',
      badge: '/logo-fuerza.png',
      tag: `calendario-${event.params.activityId}`,
      url: `/dashboard/calendario?actividad=${event.params.activityId}`,
    });
    const counters: Record<DeliveryResult | 'ignored', number> = { sent: 0, expired: 0, failed: 0, ignored: 0 };

    for (
      let index = 0;
      index < subscriptionSnapshot.docs.length;
      index += 25
    ) {
      const results = await Promise.all(
        subscriptionSnapshot.docs.slice(index, index + 25).map(async (snapshot) => {
          const subscription = snapshot.data() as StoredSubscription;
          if (!validSubscription(subscription) || !active.has(subscription.userEmail.toLowerCase())) {
            expiredIds.add(snapshot.id);
            return 'ignored' as const;
          }

          const result = await deliverPush(subscription, payload);
          if (result === 'expired') expiredIds.add(snapshot.id);
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
    console.info('Resumen de notificaciones.', {
      activityId: event.params.activityId,
      total: subscriptionSnapshot.size,
      ...counters,
      removed: expiredIds.size,
    });
  },
);
