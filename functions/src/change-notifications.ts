import { CALENDAR_TIME_ZONE, type NotificationCategory } from './notification-policy.js';
import type { WebPushUrgency } from './notification-delivery.js';

type DateValue = { toDate(): Date; toMillis?(): number };
export type ActivityChange = {
  titulo?: string;
  inicio?: DateValue;
  ubicacion?: string;
  responsableId?: string;
  responsableNombre?: string;
  estado?: string;
  categoria?: NotificationCategory;
  prioridad?: string;
};
export type ChangeKind = 'created' | 'deleted' | 'cancelled' | 'completed' | 'updated';

function formatDate(value?: DateValue) {
  const date = value?.toDate?.();
  return date && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat('es-PE', {
        timeZone: CALENDAR_TIME_ZONE, weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
      }).format(date)
    : 'Fecha por confirmar';
}

export function describeChange(before: ActivityChange | undefined, after: ActivityChange | undefined) {
  const activity = after || before || {};
  const title = String(activity.titulo || 'Actividad').trim().slice(0, 100);
  let kind: ChangeKind = 'updated';
  if (!before && after) kind = 'created';
  else if (before && !after) kind = 'deleted';
  else if (after?.estado === 'cancelada' && before?.estado !== 'cancelada') kind = 'cancelled';
  else if (after?.estado === 'completada' && before?.estado !== 'completada') kind = 'completed';

  const labels: Record<ChangeKind, string> = {
    created: `Nueva actividad: ${title}`,
    deleted: `Actividad eliminada: ${title}`,
    cancelled: `Actividad cancelada: ${title}`,
    completed: `Actividad completada: ${title}`,
    updated: `Actividad actualizada: ${title}`,
  };
  const changes: string[] = [];
  if (before && after) {
    if (before.inicio?.toDate?.().getTime() !== after.inicio?.toDate?.().getTime()) changes.push(`hora: ${formatDate(after.inicio)}`);
    if ((before.ubicacion || '') !== (after.ubicacion || '')) changes.push(`lugar: ${after.ubicacion || 'por confirmar'}`);
    if ((before.estado || '') !== (after.estado || '')) changes.push(`estado: ${after.estado || 'sin definir'}`);
    if ((before.responsableId || '') !== (after.responsableId || '') || (before.responsableNombre || '') !== (after.responsableNombre || '')) {
      changes.push(`responsable: ${after.responsableNombre || after.responsableId || 'por asignar'}`);
    }
  }
  const body = changes.length > 0
    ? `Cambió ${changes.slice(0, 4).join('; ')}.`
    : `${formatDate(activity.inicio)}. Abre el calendario para consultar los detalles.`;
  return { kind, title: labels[kind], body };
}

export function changeDeliveryOptions(kind: ChangeKind, activity: ActivityChange, nowMs: number) {
  const startMs = activity.inicio?.toDate?.().getTime() || Number.POSITIVE_INFINITY;
  const urgentCancellation = kind === 'cancelled'
    && (activity.prioridad === 'alta' || (startMs >= nowMs && startMs - nowMs <= 6 * 60 * 60_000));
  if (urgentCancellation) return { ttlSeconds: 4 * 60 * 60, urgency: 'high' as WebPushUrgency, critical: true };
  if (kind === 'completed') return { ttlSeconds: 60 * 60, urgency: 'normal' as WebPushUrgency, critical: false };
  return { ttlSeconds: 2 * 60 * 60, urgency: 'normal' as WebPushUrgency, critical: false };
}

export function changeLogicalId(activityId: string, kind: ChangeKind, version: string) {
  return `change|${activityId}|${kind}|${version}`;
}
