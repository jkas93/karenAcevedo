import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { normalizeMesaNumber } from '@/lib/electoral/acta-schema';
import { PARTIDOS_CHACLACAYO } from '@/lib/firebase/types';
import { getAdminServices } from '@/lib/firebase-admin';
import { ApiError, apiErrorResponse, readJsonBody, requireSuperuser } from '@/lib/server/admin-auth';

export const runtime = 'nodejs';

function sanitizeCount(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.min(2000, Math.floor(parsed));
}

function sanitizeNullable(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.min(2000, Math.floor(parsed));
}

function sanitizeText(value: unknown, maxLength = 500): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

export async function POST(request: Request) {
  try {
    const session = await requireSuperuser(request);
    const body = await readJsonBody(request);

    const rawMesaId = body.mesaId ?? body.mesaNumero;
    const mesaNumero = normalizeMesaNumber(rawMesaId);
    if (!mesaNumero) {
      throw new ApiError(400, 'Número de mesa no válido o no proporcionado.');
    }

    const motivo = sanitizeText(body.motivo, 500) || 'Modificación directa autorizada por Modo Dios en auditoría';

    const rawResultados = Array.isArray(body.resultados) ? body.resultados : [];
    if (rawResultados.length === 0) {
      throw new ApiError(400, 'Debes enviar la lista de resultados de las organizaciones políticas.');
    }

    const cleanResultados = rawResultados.map((item, index) => {
      const record = (item && typeof item === 'object') ? (item as Record<string, unknown>) : {};
      const orden = Number.isInteger(Number(record.orden)) ? Math.max(1, Number(record.orden)) : index + 1;
      const organizacion = sanitizeText(record.organizacion, 160) || `Organización ${orden}`;
      const distrital = sanitizeCount(record.distrital);
      const provincial = sanitizeCount(record.provincial);
      const confianza = typeof record.confianza === 'number' ? Math.max(0, Math.min(1, record.confianza)) : 1;

      return {
        orden,
        organizacion,
        distrital,
        provincial,
        confianza,
      };
    });

    const rawEspeciales = (body.especiales && typeof body.especiales === 'object')
      ? (body.especiales as Record<string, unknown>)
      : {};
    const rawBlancos = (rawEspeciales.blancos && typeof rawEspeciales.blancos === 'object')
      ? (rawEspeciales.blancos as Record<string, unknown>)
      : {};
    const rawNulos = (rawEspeciales.nulos && typeof rawEspeciales.nulos === 'object')
      ? (rawEspeciales.nulos as Record<string, unknown>)
      : {};
    const rawImpugnados = (rawEspeciales.impugnados && typeof rawEspeciales.impugnados === 'object')
      ? (rawEspeciales.impugnados as Record<string, unknown>)
      : {};

    const cleanEspeciales = {
      blancos: {
        distrital: sanitizeCount(rawBlancos.distrital),
        provincial: sanitizeCount(rawBlancos.provincial),
      },
      nulos: {
        distrital: sanitizeCount(rawNulos.distrital),
        provincial: sanitizeCount(rawNulos.provincial),
      },
      impugnados: {
        distrital: sanitizeCount(rawImpugnados.distrital),
        provincial: sanitizeCount(rawImpugnados.provincial),
      },
    };

    // Sumas calculadas
    const sumResultadosDistrital = cleanResultados.reduce((acc, curr) => acc + curr.distrital, 0);
    const sumEspecialesDistrital = cleanEspeciales.blancos.distrital +
      cleanEspeciales.nulos.distrital +
      cleanEspeciales.impugnados.distrital;
    const totalDistritalCalculado = sumResultadosDistrital + sumEspecialesDistrital;

    const sumResultadosProvincial = cleanResultados.reduce((acc, curr) => acc + curr.provincial, 0);
    const sumEspecialesProvincial = cleanEspeciales.blancos.provincial +
      cleanEspeciales.nulos.provincial +
      cleanEspeciales.impugnados.provincial;
    const totalProvincialCalculado = sumResultadosProvincial + sumEspecialesProvincial;

    const rawTotales = (body.totalesEmitidos && typeof body.totalesEmitidos === 'object')
      ? (body.totalesEmitidos as Record<string, unknown>)
      : {};

    const cleanTotalesEmitidos = {
      distrital: rawTotales.distrital !== undefined && rawTotales.distrital !== null
        ? sanitizeCount(rawTotales.distrital)
        : totalDistritalCalculado,
      provincial: rawTotales.provincial !== undefined && rawTotales.provincial !== null
        ? sanitizeCount(rawTotales.provincial)
        : totalProvincialCalculado,
    };

    const electoresHabiles = sanitizeNullable(body.electoresHabiles);
    const ciudadanosVotaron = sanitizeNullable(body.ciudadanosVotaron) ?? cleanTotalesEmitidos.distrital;
    const observaciones = sanitizeText(body.observaciones, 1000);

    // Mapeo retrocompatible para los campos tradicionales de Fuerza Ciudadana y primeros partidos
    const distritalList = cleanResultados.map((r) => r.distrital);
    const propioParty = PARTIDOS_CHACLACAYO.find((p) => p.esPropio);
    const propioIndexInResultados = cleanResultados.findIndex((r) =>
      propioParty && (
        r.organizacion.toLowerCase().includes(propioParty.nombre.toLowerCase()) ||
        r.organizacion.toLowerCase().includes(propioParty.alias.toLowerCase())
      )
    );
    const votosPropio = propioIndexInResultados >= 0
      ? cleanResultados[propioIndexInResultados].distrital
      : (distritalList[8] ?? distritalList[0] ?? 0);

    const { adminDb } = getAdminServices();
    const actaRef = adminDb.collection('actas').doc(mesaNumero);
    const auditRef = adminDb.collection('electoralAudit').doc();

    let previousActaData: Record<string, unknown> | null = null;

    await adminDb.runTransaction(async (transaction) => {
      const actaDoc = await transaction.get(actaRef);
      if (!actaDoc.exists) {
        throw new ApiError(404, `El acta de la mesa ${mesaNumero} no existe.`);
      }

      previousActaData = actaDoc.data() || {};

      const updatePayload = {
        resultados: cleanResultados,
        especiales: cleanEspeciales,
        totales_emitidos: cleanTotalesEmitidos,
        total_distrital: cleanTotalesEmitidos.distrital,
        total_provincial: cleanTotalesEmitidos.provincial,
        electores_habiles: electoresHabiles,
        ciudadanos_votaron: ciudadanosVotaron,
        observaciones,
        votos_partido_a: votosPropio,
        votos_partido_b: distritalList[0] || 0,
        votos_partido_c: distritalList[1] || 0,
        votos_partido_d: distritalList[2] || 0,
        votos_blancos: cleanEspeciales.blancos.distrital,
        votos_nulos: cleanEspeciales.nulos.distrital,
        votos_impugnados: cleanEspeciales.impugnados.distrital,
        modificado_por: session.email,
        modificado_at: FieldValue.serverTimestamp(),
        motivo_modificacion: motivo,
        modo_dios_override: true,
      };

      transaction.set(actaRef, updatePayload, { merge: true });

      // Registro de auditoría inmutable
      transaction.set(auditRef, {
        action: 'acta.god_modify',
        actaId: mesaNumero,
        mesaNumero,
        localId: previousActaData?.local_id || null,
        actor: session.email,
        role: session.role,
        motivo,
        before: {
          resultados: previousActaData?.resultados ?? null,
          especiales: previousActaData?.especiales ?? null,
          totales_emitidos: previousActaData?.totales_emitidos ?? null,
          total_distrital: previousActaData?.total_distrital ?? null,
          total_provincial: previousActaData?.total_provincial ?? null,
          votos_partido_a: previousActaData?.votos_partido_a ?? null,
          votos_blancos: previousActaData?.votos_blancos ?? null,
          votos_nulos: previousActaData?.votos_nulos ?? null,
          votos_impugnados: previousActaData?.votos_impugnados ?? null,
          observaciones: previousActaData?.observaciones ?? '',
        },
        after: {
          resultados: cleanResultados,
          especiales: cleanEspeciales,
          totales_emitidos: cleanTotalesEmitidos,
          total_distrital: cleanTotalesEmitidos.distrital,
          total_provincial: cleanTotalesEmitidos.provincial,
          votos_partido_a: votosPropio,
          votos_blancos: cleanEspeciales.blancos.distrital,
          votos_nulos: cleanEspeciales.nulos.distrital,
          votos_impugnados: cleanEspeciales.impugnados.distrital,
          observaciones,
        },
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    return NextResponse.json({
      success: true,
      message: `Acta de la mesa ${mesaNumero} modificada exitosamente por Modo Dios.`,
      mesaNumero,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
