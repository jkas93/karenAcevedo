import { createHash } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminServices } from '@/lib/firebase-admin';
import { validateVolunteerSubmission } from '@/lib/validation/volunteer';

export const runtime = 'nodejs';

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const MAX_BODY_BYTES = 20 * 1024;

function fingerprint(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const userAgent = request.headers.get('user-agent') ?? 'unknown';
  return createHash('sha256').update(`${forwardedFor}|${userAgent}`).digest('hex');
}

export async function POST(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return Response.json({ error: 'Formato no permitido.' }, { status: 415 });
  }

  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return Response.json({ error: 'Solicitud demasiado grande.' }, { status: 413 });
    }

    let body: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(rawBody);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
      body = parsed as Record<string, unknown>;
    } catch {
      return Response.json({ error: 'Los datos enviados no son válidos.' }, { status: 400 });
    }

    if (typeof body.website === 'string' && body.website.trim()) {
      return Response.json({ ok: true }, { status: 201 });
    }

    let submission;
    try {
      submission = validateVolunteerSubmission(body);
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : 'Los datos enviados no son válidos.' },
        { status: 400 },
      );
    }

    const { adminDb } = getAdminServices();
    const now = Date.now();
    const rateRef = adminDb.collection('volunteerRateLimits').doc(fingerprint(request));
    const allowed = await adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(rateRef);
      const data = snapshot.data();
      const windowStart = typeof data?.windowStart === 'number' ? data.windowStart : 0;
      const attempts = typeof data?.attempts === 'number' ? data.attempts : 0;
      if (now - windowStart < WINDOW_MS && attempts >= MAX_ATTEMPTS) return false;
      transaction.set(rateRef, {
        windowStart: now - windowStart < WINDOW_MS ? windowStart : now,
        attempts: now - windowStart < WINDOW_MS ? attempts + 1 : 1,
        expiresAt: new Date(now + WINDOW_MS * 2),
      });
      return true;
    });

    if (!allowed) {
      return Response.json(
        { error: 'Demasiados intentos. Espera unos minutos antes de volver a intentar.' },
        { status: 429 },
      );
    }

    await adminDb.collection('voluntarios').add({
      ...submission,
      estado: 'pendiente',
      fecha: FieldValue.serverTimestamp(),
    });
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error('Error en registro público de voluntariado:', error);
    return Response.json({ error: 'No se pudo guardar el registro. Intenta nuevamente.' }, { status: 500 });
  }
}
