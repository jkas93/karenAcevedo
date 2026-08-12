import { createHash } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { getAdminServices } from '@/lib/firebase-admin';
import { ApiError, apiErrorResponse } from '@/lib/server/admin-auth';
import { getTeamInvitation, TEAM_INTAKE_CONFIG_PATH } from '@/lib/server/team-intake';
import {
  DAY_SHIFTS,
  EDUCATION_LEVELS,
  SUPPORT_AREAS,
  TEAM_SKILLS,
  TRAVEL_OPTIONS,
  WEEK_DAYS,
  type TeamAvailability,
  type TeamIntakePayload,
} from '@/lib/team-intake-types';

export const runtime = 'nodejs';

function cleanString(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function cleanList(value: unknown, allowed: readonly string[]) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === 'string' && allowed.includes(item)))];
}

function validatePayload(body: Record<string, unknown>): TeamIntakePayload {
  const nombre = cleanString(body.nombre, 120);
  const dni = cleanString(body.dni, 8);
  const telefono = cleanString(body.telefono, 15).replace(/\s+/g, '');
  const fechaNacimiento = cleanString(body.fechaNacimiento, 10);
  const direccionZona = cleanString(body.direccionZona, 200);
  const correo = cleanString(body.correo, 254).toLowerCase();
  const gradoInstruccion = cleanString(body.gradoInstruccion, 30);
  const carreraOficio = cleanString(body.carreraOficio, 120);
  const institucion = cleanString(body.institucion, 160);
  const habilidades = cleanList(body.habilidades, TEAM_SKILLS);
  const otraHabilidad = cleanString(body.otraHabilidad, 160);
  const idiomas = cleanString(body.idiomas, 160);
  const experienciaDetalle = cleanString(body.experienciaDetalle, 600);
  const areaApoyo = cleanString(body.areaApoyo, 30);
  const areaOtra = cleanString(body.areaOtra, 120);
  const desplazamiento = cleanString(body.desplazamiento, 30);
  const expectativas = cleanString(body.expectativas, 1200);
  const horasSemanales = Number(body.horasSemanales);

  if (nombre.length < 3) throw new ApiError(400, 'Ingresa tus nombres y apellidos.');
  if (!/^\d{8}$/.test(dni)) throw new ApiError(400, 'El DNI debe contener 8 dígitos.');
  if (!/^\+?\d{9,15}$/.test(telefono)) throw new ApiError(400, 'Ingresa un celular válido.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaNacimiento)) throw new ApiError(400, 'Ingresa una fecha de nacimiento válida.');
  const birthDate = new Date(`${fechaNacimiento}T00:00:00Z`);
  const earliest = new Date();
  earliest.setFullYear(earliest.getFullYear() - 100);
  const latest = new Date();
  latest.setFullYear(latest.getFullYear() - 14);
  if (Number.isNaN(birthDate.getTime()) || birthDate < earliest || birthDate > latest) {
    throw new ApiError(400, 'La fecha de nacimiento no está dentro del rango permitido.');
  }
  if (direccionZona.length < 3) throw new ApiError(400, 'Ingresa tu dirección o zona.');
  if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) throw new ApiError(400, 'El correo no es válido.');
  if (!EDUCATION_LEVELS.includes(gradoInstruccion as never)) throw new ApiError(400, 'Selecciona tu grado de instrucción.');
  if (!SUPPORT_AREAS.includes(areaApoyo as never)) throw new ApiError(400, 'Selecciona un área de apoyo.');
  if (areaApoyo === 'otra' && areaOtra.length < 2) throw new ApiError(400, 'Especifica el área donde puedes apoyar.');
  if (!TRAVEL_OPTIONS.includes(desplazamiento as never)) throw new ApiError(400, 'Selecciona tu disponibilidad para desplazamientos.');
  if (!Number.isInteger(horasSemanales) || horasSemanales < 1 || horasSemanales > 80) throw new ApiError(400, 'Las horas semanales deben estar entre 1 y 80.');
  if (expectativas.length < 10) throw new ApiError(400, 'Cuéntanos brevemente tus expectativas.');

  const rawAvailability = body.disponibilidad;
  if (!rawAvailability || typeof rawAvailability !== 'object' || Array.isArray(rawAvailability)) {
    throw new ApiError(400, 'Selecciona tu disponibilidad semanal.');
  }
  const availability = {} as TeamAvailability;
  let selectedShifts = 0;
  for (const day of WEEK_DAYS) {
    const shifts = cleanList((rawAvailability as Record<string, unknown>)[day], DAY_SHIFTS);
    availability[day] = shifts as TeamAvailability[typeof day];
    selectedShifts += shifts.length;
  }
  if (selectedShifts === 0) throw new ApiError(400, 'Selecciona al menos un turno disponible.');

  return {
    nombre,
    dni,
    telefono,
    fechaNacimiento,
    direccionZona,
    transportePropio: body.transportePropio === true,
    correo,
    gradoInstruccion: gradoInstruccion as TeamIntakePayload['gradoInstruccion'],
    carreraOficio,
    institucion,
    habilidades: habilidades as TeamIntakePayload['habilidades'],
    otraHabilidad,
    idiomas,
    experienciaPrevia: body.experienciaPrevia === true,
    experienciaDetalle,
    areaApoyo: areaApoyo as TeamIntakePayload['areaApoyo'],
    areaOtra,
    disponibilidad: availability,
    horasSemanales,
    desplazamiento: desplazamiento as TeamIntakePayload['desplazamiento'],
    expectativas,
  };
}

function clientFingerprint(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '';
  const agent = request.headers.get('user-agent') || '';
  return createHash('sha256').update(`${forwarded}|${agent}`).digest('hex');
}

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > 50_000) throw new ApiError(413, 'La ficha enviada es demasiado grande.');
    const { token } = await context.params;
    const invitation = await getTeamInvitation(token);
    if (!invitation) throw new ApiError(404, 'Este enlace no está activo. Solicita uno nuevo al equipo.');

    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError(400, 'La ficha no es válida.');
    const raw = body as Record<string, unknown>;
    if (cleanString(raw.website, 100)) return NextResponse.json({ success: true }, { status: 201 });
    const profile = validatePayload(raw);

    const { adminDb } = getAdminServices();
    const profileId = createHash('sha256').update(profile.dni).digest('hex');
    const profileRef = adminDb.collection('teamProfiles').doc(profileId);
    const rateRef = adminDb.collection('teamIntakeRateLimits').doc(clientFingerprint(request));
    const configRef = adminDb.doc(TEAM_INTAKE_CONFIG_PATH);

    await adminDb.runTransaction(async (transaction) => {
      const [existing, rateSnapshot] = await Promise.all([
        transaction.get(profileRef),
        transaction.get(rateRef),
      ]);
      if (existing.exists) throw new ApiError(409, 'Ya existe una ficha registrada con este DNI. Comunícate con el administrador si necesitas corregirla.');

      const now = Date.now();
      const windowStart = Number(rateSnapshot.data()?.windowStart || 0);
      const withinWindow = now - windowStart < 10 * 60 * 1000;
      const attempts = withinWindow ? Number(rateSnapshot.data()?.attempts || 0) : 0;
      if (attempts >= 5) throw new ApiError(429, 'Se alcanzó el límite de envíos. Intenta nuevamente más tarde.');

      transaction.set(rateRef, {
        windowStart: withinWindow ? windowStart : now,
        attempts: attempts + 1,
        expiresAt: new Date(now + 24 * 60 * 60 * 1000),
      });
      transaction.create(profileRef, {
        ...profile,
        estado: 'nuevo',
        invitationVersion: invitation.version,
        fechaRegistro: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.update(configRef, { submissions: FieldValue.increment(1) });
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
