import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { defineJsonSecret } from 'firebase-functions/params';
import webpush from 'web-push';
import { changeDeliveryOptions, changeLogicalId, describeChange, type ActivityChange } from './change-notifications.js';
import {
  acquireDeliveryReceipt,
  broadcastNotification,
  completeDeliveryReceipt,
  failDeliveryReceipt,
  logNotification,
} from './notification-delivery.js';

export { notificarRecordatoriosCalendario } from './reminders.js';

initializeApp();
const db = getFirestore();
type WebPushConfig = { publicKey: string; privateKey: string; subject: string };
const pushConfig = defineJsonSecret<WebPushConfig>('WEB_PUSH_CONFIG');

export const notificarCambioCalendario = onDocumentWritten(
  {
    document: 'calendario_actividades/{activityId}', region: 'us-central1', secrets: [pushConfig],
    memory: '256MiB', timeoutSeconds: 60, maxInstances: 3, retry: false,
  },
  async (event) => {
    const before = event.data?.before.exists ? event.data.before.data() as ActivityChange : undefined;
    const after = event.data?.after.exists ? event.data.after.data() as ActivityChange : undefined;
    const activity = after || before || {};
    const message = describeChange(before, after);
    const version = event.data?.after.updateTime?.toMillis?.()?.toString()
      || event.data?.before.updateTime?.toMillis?.()?.toString()
      || event.id;
    const logicalId = changeLogicalId(event.params.activityId, message.kind, version);
    const receipt = await acquireDeliveryReceipt(db, logicalId, {
      activityId: event.params.activityId, kind: message.kind, version,
    }, Date.now());
    if (!receipt) {
      logNotification('info', 'change_duplicate', { logicalId });
      return;
    }

    try {
      const config = pushConfig.value();
      webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
      const options = changeDeliveryOptions(message.kind, activity, Date.now());
      const summary = await broadcastNotification(db, {
        logicalId,
        activityId: event.params.activityId,
        title: message.title,
        body: message.body,
        url: `/dashboard/calendario?actividad=${event.params.activityId}`,
        tag: `calendario-${event.params.activityId}`,
        ttlSeconds: options.ttlSeconds,
        urgency: options.urgency,
        intent: {
          kind: 'change',
          audience: 'relevant_change',
          category: activity.categoria || 'territorio',
          responsibleId: String(activity.responsableId || '').trim().toLowerCase(),
          critical: options.critical,
        },
      });
      await completeDeliveryReceipt(receipt, summary);
      logNotification(
        summary.failed > 0 || summary.targeted === 0 ? 'warn' : 'info',
        'change_completed',
        { logicalId, ...summary },
      );
    } catch (error) {
      await failDeliveryReceipt(receipt, error);
      logNotification('error', 'change_failed', {
        logicalId, error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
);
