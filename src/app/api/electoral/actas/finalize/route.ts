import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { ACTAS_ESPERADAS, normalizeActaExtraction, normalizeMesaNumber, validateFinalActa } from '@/lib/electoral/acta-schema';
import { getAdminServices } from '@/lib/firebase-admin';
import { ApiError, apiErrorResponse, readJsonBody, requirePermission } from '@/lib/server/admin-auth';

export const runtime = 'nodejs';

function cleanId(value: unknown, label: string) {
  const id = typeof value === 'string' ? value.trim() : '';
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new ApiError(400, `${label} no es válido.`);
  return id;
}

export async function POST(request: Request) {
  try {
    const session = await requirePermission(request, 'actas.manage');
    const body = await readJsonBody(request);
    const draftId = cleanId(body.draftId, 'El borrador');
    const localId = cleanId(body.localId, 'El colegio');
    const extraction = normalizeActaExtraction(body.extraction);
    const mesaNumero = normalizeMesaNumber(extraction.mesaNumero);
    const columnMode = body.columnMode === 'completo' ? 'completo' : 'distrital';
    const validation = validateFinalActa(extraction, columnMode);
    if (validation.errors.length > 0) throw new ApiError(400, validation.errors.join(' '));

    const { adminDb } = getAdminServices();
    const draftRef = adminDb.collection('actaDrafts').doc(draftId);
    const localRef = adminDb.collection('locales').doc(localId);
    const actaRef = adminDb.collection('actas').doc(mesaNumero);
    const mesaRef = adminDb.collection('mesas').doc(mesaNumero);
    const globalCounterRef = adminDb.collection('electoralCounters').doc('actas');
    const localCounterRef = adminDb.collection('electoralCounters').doc(`local_${localId}`);
    const auditRef = adminDb.collection('electoralAudit').doc();

    await adminDb.runTransaction(async (transaction) => {
      const [draft, local, currentActa, globalCounter, localCounter] = await Promise.all([
        transaction.get(draftRef),
        transaction.get(localRef),
        transaction.get(actaRef),
        transaction.get(globalCounterRef),
        transaction.get(localCounterRef),
      ]);
      if (!draft.exists || draft.data()?.status !== 'review') {
        throw new ApiError(409, 'El borrador ya no está disponible para confirmar.');
      }
      if (draft.data()?.localId !== localId) throw new ApiError(409, 'El colegio no coincide con el borrador analizado.');
      if (!local.exists) throw new ApiError(400, 'El colegio seleccionado ya no existe.');
      const isRectification = currentActa.exists;
      if (isRectification) {
        if (!body.rectificar) {
          throw new ApiError(409, `La mesa ${mesaNumero} ya tiene un acta confirmada. Si necesitas corregirla, confirma con opción de rectificación.`);
        }
        if (session.role !== 'superusuario' && session.role !== 'administrador') {
          throw new ApiError(403, 'Solo un Administrador o Modo Dios tiene autorización para rectificar actas ya confirmadas.');
        }
      }

      const globalCount = Number(globalCounter.data()?.confirmed || 0);
      const localCount = Number(localCounter.data()?.confirmed || 0);
      const localLimit = Number(local.data()?.total_mesas || 0);
      if (!isRectification) {
        if (globalCount >= ACTAS_ESPERADAS) throw new ApiError(409, `Ya se confirmaron las ${ACTAS_ESPERADAS} actas esperadas.`);
        if (localLimit > 0 && localCount >= localLimit) {
          throw new ApiError(409, 'Este colegio ya completó todas sus actas esperadas.');
        }
      }

      const districtResults = extraction.resultados.map((result) => result.distrital ?? 0);
      const imageUrl = String(draft.data()?.imageUrl || '');
      const imagePath = String(draft.data()?.imagePath || '');
      const actaData = {
        mesa_id: mesaNumero,
        mesa_numero: mesaNumero,
        local_id: localId,
        resultados: extraction.resultados,
        especiales: extraction.especiales,
        totales_emitidos: extraction.totalesEmitidos,
        electores_habiles: extraction.electoresHabiles,
        ciudadanos_votaron: extraction.ciudadanosVotaron,
        departamento: extraction.departamento,
        provincia: extraction.provincia,
        distrito: extraction.distrito,
        observaciones: extraction.observaciones,
        votos_partido_a: districtResults[0] || 0,
        votos_partido_b: districtResults[1] || 0,
        votos_partido_c: districtResults[2] || 0,
        votos_partido_d: districtResults[3] || 0,
        votos_blancos: extraction.especiales.blancos.distrital || 0,
        votos_nulos: extraction.especiales.nulos.distrital || 0,
        votos_impugnados: extraction.especiales.impugnados.distrital || 0,
        total_provincial: validation.totalProvincial,
        total_distrital: validation.totalDistrital,
        foto_url: imageUrl,
        foto_path: imagePath,
        draft_id: draftId,
        schema_version: 2,
        extraction_confidence: extraction.confianzaGeneral,
        extraction_model: draft.data()?.modelVersion || '',
        confirmado_por: session.email,
        timestamp: FieldValue.serverTimestamp(),
      };

      if (isRectification) {
        transaction.set(actaRef, {
          ...actaData,
          rectificada_por: session.email,
          rectificada_at: FieldValue.serverTimestamp(),
        }, { merge: true });
        transaction.set(mesaRef, {
          numero: mesaNumero,
          local_id: localId,
          estado: 'enviada',
          source: 'acta',
          acta_id: mesaNumero,
          updated_at: FieldValue.serverTimestamp(),
        }, { merge: true });
        transaction.set(auditRef, {
          action: 'acta.rectify',
          actaId: mesaNumero,
          mesaNumero,
          localId,
          draftId,
          actor: session.email,
          previousExtraction: currentActa.data()?.resultados || null,
          finalExtraction: extraction,
          createdAt: FieldValue.serverTimestamp(),
        });
      } else {
        transaction.create(actaRef, actaData);
        transaction.create(mesaRef, {
          numero: mesaNumero,
          local_id: localId,
          estado: 'enviada',
          source: 'acta',
          acta_id: mesaNumero,
          created_at: FieldValue.serverTimestamp(),
        });
        transaction.set(globalCounterRef, {
          confirmed: globalCount + 1,
          expected: ACTAS_ESPERADAS,
          updatedAt: FieldValue.serverTimestamp(),
        });
        transaction.set(localCounterRef, {
          localId,
          confirmed: localCount + 1,
          expected: localLimit,
          updatedAt: FieldValue.serverTimestamp(),
        });
        transaction.set(auditRef, {
          action: 'acta.confirm',
          actaId: mesaNumero,
          mesaNumero,
          localId,
          draftId,
          actor: session.email,
          originalExtraction: draft.data()?.extraction || null,
          finalExtraction: extraction,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
      transaction.update(draftRef, {
        status: 'confirmed',
        mesaNumero,
        confirmedBy: session.email,
        confirmedAt: FieldValue.serverTimestamp(),
        finalExtraction: extraction,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    return NextResponse.json({ success: true, actaId: mesaNumero, mesaNumero });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
