import { initializeApp } from 'firebase-admin/app';
import { getFirestore, type DocumentData, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { defineJsonSecret } from 'firebase-functions/params';
import webpush from 'web-push';

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

const pushConfig = defineJsonSecret<WebPushConfig>('WEB_PUSH_CONFIG');
const db = getFirestore();

function describeChange(before: Activity | undefined, after: Activity | undefined) {
  const activity = after || before || {};
  const title = String(activity.titulo || 'Actividad del equipo').slice(0, 100);
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
    : 'Revisa el calendario';
  const details = [
    dateLabel,
    activity.responsableNombre ? `Responsable: ${activity.responsableNombre}` : '',
    activity.ubicacion || '',
  ].filter(Boolean);

  if (!before && after) {
    return { title: `Nueva actividad: ${title}`, body: details.join(' - ') };
  }
  if (before && !after) {
    return { title: `Actividad eliminada: ${title}`, body: details.join(' - ') };
  }
  if (after?.estado === 'cancelada' && before?.estado !== 'cancelada') {
    return { title: `Actividad cancelada: ${title}`, body: details.join(' - ') };
  }
  return { title: `Actividad actualizada: ${title}`, body: details.join(' - ') };
}

function validSubscription(data: StoredSubscription): data is Required<
  Pick<StoredSubscription, 'endpoint' | 'keys' | 'userEmail'>
> & StoredSubscription {
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
    if (subscriptionSnapshot.empty) return;

    const active = await activeEmails(subscriptionSnapshot.docs);
    const expiredIds = new Set<string>();
    const deliveries = subscriptionSnapshot.docs.map(async (snapshot) => {
      const subscription = snapshot.data() as StoredSubscription;
      if (!validSubscription(subscription) || !active.has(subscription.userEmail.toLowerCase())) {
        expiredIds.add(snapshot.id);
        return;
      }

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
          JSON.stringify({
            ...message,
            icon: '/brazo.png',
            badge: '/logo-fuerza.png',
            tag: `calendario-${event.params.activityId}`,
            url: `/dashboard/calendario?actividad=${event.params.activityId}`,
          }),
          { TTL: 86400, urgency: 'high' },
        );
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) expiredIds.add(snapshot.id);
        else console.error('No se pudo enviar una notificacion push.', statusCode || error);
      }
    });

    await Promise.allSettled(deliveries);
    if (expiredIds.size > 0) {
      const batch = db.batch();
      expiredIds.forEach((id) => batch.delete(db.collection('pushSubscriptions').doc(id)));
      await batch.commit();
    }
  },
);
