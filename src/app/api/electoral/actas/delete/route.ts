import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { getAdminServices } from '@/lib/firebase-admin';
import { ApiError, apiErrorResponse, readJsonBody, requireAdmin } from '@/lib/server/admin-auth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const session = await requireAdmin(request);
    const body = await readJsonBody(request);
    const mesaId = typeof body.mesaId === 'string' ? body.mesaId.trim() : '';
    if (!mesaId) {
      throw new ApiError(400, 'Indica el número de mesa que deseas eliminar.');
    }

    const { adminDb } = getAdminServices();
    const actaRef = adminDb.collection('actas').doc(mesaId);
    const mesaRef = adminDb.collection('mesas').doc(mesaId);
    const auditRef = adminDb.collection('electoralAudit').doc();

    let localId = '';
    let draftId = '';

    await adminDb.runTransaction(async (transaction) => {
      const actaDoc = await transaction.get(actaRef);
      if (!actaDoc.exists) {
        throw new ApiError(404, `El acta de la mesa ${mesaId} no existe o ya fue eliminada.`);
      }

      const actaData = actaDoc.data() || {};
      localId = String(actaData.local_id || '');
      draftId = String(actaData.draft_id || '');

      const globalCounterRef = adminDb.collection('electoralCounters').doc('actas');
      const localCounterRef = localId ? adminDb.collection('electoralCounters').doc(`local_${localId}`) : null;

      const [globalCounter, localCounter] = await Promise.all([
        transaction.get(globalCounterRef),
        localCounterRef ? transaction.get(localCounterRef) : null,
      ]);

      const globalCount = Math.max(0, Number(globalCounter.data()?.confirmed || 0) - 1);
      transaction.set(globalCounterRef, { confirmed: globalCount, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

      if (localCounterRef && localCounter) {
        const localCount = Math.max(0, Number(localCounter.data()?.confirmed || 0) - 1);
        transaction.set(localCounterRef, { confirmed: localCount, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      }

      // Eliminar el documento del acta
      transaction.delete(actaRef);

      // Eliminar la mesa para que quede disponible para una nueva digitación
      transaction.delete(mesaRef);

      // Si existe borrador asociado, marcarlo como anulado
      if (draftId) {
        const draftRef = adminDb.collection('actaDrafts').doc(draftId);
        transaction.update(draftRef, {
          status: 'cancelled',
          cancelledAt: FieldValue.serverTimestamp(),
          cancelledBy: session.email,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      // Registrar auditoría inmutable de la eliminación
      transaction.set(auditRef, {
        action: 'acta.delete',
        actaId: mesaId,
        mesaNumero: mesaId,
        localId,
        actor: session.email,
        role: session.role,
        deletedActaData: actaData,
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    return NextResponse.json({
      success: true,
      message: `Acta de la mesa ${mesaId} eliminada correctamente.`,
      mesaId,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
