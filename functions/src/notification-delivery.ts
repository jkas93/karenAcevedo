import { createHash, randomUUID } from 'node:crypto';
import {
  FieldValue,
  Timestamp,
  type DocumentData,
  type Firestore,
  type QueryDocumentSnapshot,
} from 'firebase-admin/firestore';
import webpush from 'web-push';
import {
  effectiveCalendarPermissions,
  shouldNotifyRecipient,
  type NotificationIntent,
  type RecipientProfile,
} from './notification-policy.js';

export type WebPushUrgency = 'very-low' | 'low' | 'normal' | 'high';
export type DeliveryResult = 'accepted' | 'expired' | 'failed';
export type StoredSubscription = {
  endpoint?: string;
  expirationTime?: number | null;
  keys?: { p256dh?: string; auth?: string };
  uid?: string;
  userEmail?: string;
  enabled?: boolean;
  preferences?: unknown;
};
type ValidSubscription = Required<Pick<StoredSubscription, 'endpoint' | 'keys' | 'userEmail'>>
  & StoredSubscription;

export type DeliverySummary = {
  total: number;
  targeted: number;
  accepted: number;
  expired: number;
  failed: number;
  ignored: number;
  alreadyAccepted: number;
  removed: number;
};

export type BroadcastRequest = {
  logicalId: string;
  activityId: string;
  title: string;
  body: string;
  url: string;
  tag: string;
  ttlSeconds: number;
  urgency: WebPushUrgency;
  intent: NotificationIntent;
};

const CLAIM_LEASE_MS = 15 * 60_000;
const RETENTION_MS = 45 * 24 * 60 * 60_000;

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
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

export function classifyPushError(statusCode: number | undefined) {
  if (statusCode === 404 || statusCode === 410) return 'expired' as const;
  if (!statusCode || statusCode === 429 || statusCode >= 500) return 'retriable' as const;
  return 'failed' as const;
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function deliverPush(
  subscription: ValidSubscription,
  payload: string,
  ttlSeconds: number,
  urgency: WebPushUrgency,
): Promise<{ status: DeliveryResult; statusCode?: number; attempts: number }> {
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
        { TTL: ttlSeconds, urgency },
      );
      return { status: 'accepted', attempts: attempt + 1 };
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      const classification = classifyPushError(statusCode);
      if (classification === 'expired') {
        return { status: 'expired', statusCode, attempts: attempt + 1 };
      }
      if (classification === 'failed' || attempt === 2) {
        return { status: 'failed', statusCode, attempts: attempt + 1 };
      }
      await wait(300 * 3 ** attempt);
    }
  }
  return { status: 'failed', attempts: 3 };
}

async function loadProfiles(
  db: Firestore,
  subscriptions: QueryDocumentSnapshot<DocumentData>[],
) {
  const emails = [...new Set(
    subscriptions
      .map((snapshot) => String(snapshot.data().userEmail || '').trim().toLowerCase())
      .filter(Boolean),
  )];
  if (emails.length === 0) return new Map<string, RecipientProfile>();
  const profileSnapshots = await db.getAll(
    ...emails.map((email) => db.collection('usuarios').doc(email)),
  );
  const roles = [...new Set(profileSnapshots.map((profile) => String(profile.data()?.rol || '')))];
  const permissionSnapshots = await db.getAll(
    ...roles.filter(Boolean).map((role) => db.collection('rolePermissions').doc(role)),
  );
  const permissionsByRole = new Map(
    permissionSnapshots.map((snapshot) => [snapshot.id, snapshot.data()?.permissions]),
  );
  const result = new Map<string, RecipientProfile>();
  profileSnapshots.forEach((profile) => {
    if (!profile.exists) return;
    const data = profile.data();
    const resolved = effectiveCalendarPermissions(
      profile.id,
      data?.rol,
      permissionsByRole.get(String(data?.rol || '')),
    );
    if (!resolved) return;
    result.set(profile.id.toLowerCase(), {
      email: profile.id.toLowerCase(),
      uid: typeof data?.uid === 'string' ? data.uid : undefined,
      ...resolved,
    });
  });
  return result;
}

async function writeInChunks(
  db: Firestore,
  writes: Array<{ ref: FirebaseFirestore.DocumentReference; data: DocumentData }>,
) {
  for (let index = 0; index < writes.length; index += 400) {
    const batch = db.batch();
    writes.slice(index, index + 400).forEach(({ ref, data }) => batch.set(ref, data, { merge: true }));
    await batch.commit();
  }
}

export async function broadcastNotification(
  db: Firestore,
  request: BroadcastRequest,
  now = new Date(),
): Promise<DeliverySummary> {
  const snapshot = await db.collection('pushSubscriptions').where('enabled', '==', true).get();
  const profiles = await loadProfiles(db, snapshot.docs);
  const receiptId = sha256(request.logicalId);
  const expiresAt = Timestamp.fromMillis(now.getTime() + RETENTION_MS);
  const targets = snapshot.docs.flatMap((subscriptionDoc) => {
    const subscription = subscriptionDoc.data() as StoredSubscription;
    const profile = profiles.get(String(subscription.userEmail || '').trim().toLowerCase());
    if (!validSubscription(subscription) || !profile) return [];
    if (!shouldNotifyRecipient(profile, subscription.preferences, request.intent, now)) return [];
    return [{ subscriptionDoc, subscription, profile }];
  });
  const eventRefs = targets.map(({ subscriptionDoc }) => ({
    subscriptionId: subscriptionDoc.id,
    ref: db.collection('notificationDeviceEvents').doc(sha256(`${receiptId}|${subscriptionDoc.id}`)),
  }));
  const previousEvents = eventRefs.length > 0
    ? await db.getAll(...eventRefs.map(({ ref }) => ref))
    : [];
  const previousById = new Map(previousEvents.map((event) => [event.id, event.data()]));
  const prepared = targets.flatMap((target, index) => {
    const eventRef = eventRefs[index].ref;
    const previous = previousById.get(eventRef.id);
    if (previous?.status === 'accepted' || previous?.status === 'clicked') return [];
    const clickToken = randomUUID();
    return [{ ...target, eventRef, clickToken }];
  });

  await writeInChunks(db, prepared.map(({ subscriptionDoc, subscription, eventRef, clickToken }) => ({
    ref: eventRef,
    data: {
      notificationId: receiptId,
      logicalId: request.logicalId.slice(0, 500),
      activityId: request.activityId,
      subscriptionId: subscriptionDoc.id,
      uid: subscription.uid || null,
      status: 'sending',
      clickTokenHash: sha256(clickToken),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt,
    },
  })));

  const expiredIds = new Set<string>();
  const counters = { accepted: 0, expired: 0, failed: 0 };
  const outcomes: Array<{ ref: FirebaseFirestore.DocumentReference; data: DocumentData }> = [];
  for (let index = 0; index < prepared.length; index += 25) {
    const results = await Promise.all(prepared.slice(index, index + 25).map(async (target) => {
      const payload = JSON.stringify({
        title: request.title,
        body: request.body,
        icon: '/brazo.png',
        badge: '/logo-fuerza.png',
        tag: request.tag,
        url: request.url,
        actions: [{ action: 'view', title: 'Ver actividad' }],
        eventId: target.eventRef.id,
        clickToken: target.clickToken,
      });
      const result = await deliverPush(
        target.subscription,
        payload,
        request.ttlSeconds,
        request.urgency,
      );
      if (result.status === 'expired') expiredIds.add(target.subscriptionDoc.id);
      outcomes.push({
        ref: target.eventRef,
        data: {
          status: result.status,
          statusCode: result.statusCode || null,
          attempts: result.attempts,
          updatedAt: FieldValue.serverTimestamp(),
          ...(result.status === 'accepted' ? { acceptedAt: FieldValue.serverTimestamp() } : {}),
        },
      });
      return result.status;
    }));
    results.forEach((status) => { counters[status] += 1; });
  }
  await writeInChunks(db, outcomes);

  if (expiredIds.size > 0) {
    const batch = db.batch();
    expiredIds.forEach((id) => batch.delete(db.collection('pushSubscriptions').doc(id)));
    await batch.commit();
  }

  return {
    total: snapshot.size,
    targeted: targets.length,
    ...counters,
    ignored: snapshot.size - targets.length,
    alreadyAccepted: targets.length - prepared.length,
    removed: expiredIds.size,
  };
}

export function canAcquireReceipt(data: DocumentData | undefined, nowMs: number) {
  if (data?.status === 'completed') return false;
  const claimedAt = data?.claimedAt?.toMillis?.() || 0;
  return !(data?.status === 'processing' && claimedAt > nowMs - CLAIM_LEASE_MS);
}

export async function acquireDeliveryReceipt(
  db: Firestore,
  logicalId: string,
  metadata: DocumentData,
  nowMs: number,
  legacyReminderId?: string,
) {
  const receiptRef = db.collection('notificationDeliveries').doc(sha256(logicalId));
  const legacyRef = legacyReminderId
    ? db.collection('notificationReminderDeliveries').doc(legacyReminderId)
    : null;
  return db.runTransaction(async (transaction) => {
    const [existing, legacy] = await Promise.all([
      transaction.get(receiptRef),
      legacyRef ? transaction.get(legacyRef) : Promise.resolve(null),
    ]);
    if (legacy?.data()?.status === 'completed' || !canAcquireReceipt(existing.data(), nowMs)) {
      return null;
    }
    transaction.set(receiptRef, {
      logicalId: logicalId.slice(0, 500),
      ...metadata,
      status: 'processing',
      claimedAt: Timestamp.fromMillis(nowMs),
      expiresAt: Timestamp.fromMillis(nowMs + RETENTION_MS),
    }, { merge: true });
    return receiptRef;
  });
}

export async function completeDeliveryReceipt(
  receiptRef: FirebaseFirestore.DocumentReference,
  summary: DeliverySummary,
) {
  await receiptRef.set({
    status: 'completed',
    completedAt: FieldValue.serverTimestamp(),
    delivery: summary,
  }, { merge: true });
}

export async function failDeliveryReceipt(
  receiptRef: FirebaseFirestore.DocumentReference,
  error: unknown,
) {
  await receiptRef.set({
    status: 'failed',
    failedAt: FieldValue.serverTimestamp(),
    lastError: error instanceof Error ? error.message.slice(0, 500) : 'Error desconocido',
  }, { merge: true });
}

export function retentionCutoff(nowMs: number) {
  return Timestamp.fromMillis(nowMs - RETENTION_MS);
}

export async function cleanupNotificationData(db: Firestore, nowMs: number) {
  const now = Timestamp.fromMillis(nowMs);
  const legacyCutoff = retentionCutoff(nowMs);
  const [receipts, deviceEvents, legacyReceipts] = await Promise.all([
    db.collection('notificationDeliveries').where('expiresAt', '<', now).limit(250).get(),
    db.collection('notificationDeviceEvents').where('expiresAt', '<', now).limit(250).get(),
    db.collection('notificationReminderDeliveries')
      .where('completedAt', '<', legacyCutoff)
      .limit(250)
      .get(),
  ]);
  const docs = [...receipts.docs, ...deviceEvents.docs, ...legacyReceipts.docs];
  if (docs.length === 0) return 0;
  const batch = db.batch();
  docs.forEach((document) => batch.delete(document.ref));
  await batch.commit();
  return docs.length;
}

export function logNotification(
  level: 'info' | 'warn' | 'error',
  event: string,
  data: Record<string, unknown>,
) {
  console[level](JSON.stringify({
    component: 'calendar_notifications',
    event,
    timestamp: new Date().toISOString(),
    ...data,
  }));
}
