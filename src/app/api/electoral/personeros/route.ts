import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { getAdminServices } from '@/lib/firebase-admin';
import { validatePersoneroInput } from '@/lib/validation/personero';
import {
  ApiError,
  apiErrorResponse,
  readJsonBody,
  requirePermission,
} from '@/lib/server/admin-auth';

export const runtime = 'nodejs';

function cleanId(value: unknown) {
  const id = typeof value === 'string' ? value.trim() : '';
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new ApiError(400, 'El personero seleccionado no es válido.');
  return id;
}

export async function POST(request: Request) {
  try {
    const session = await requirePermission(request, 'electoral.manage');
    const body = await readJsonBody(request);
    const action = typeof body.action === 'string' ? body.action : '';
    if (!['create', 'update', 'delete'].includes(action)) {
      throw new ApiError(400, 'La operación solicitada no es válida.');
    }

    const { adminDb } = getAdminServices();
    const collection = adminDb.collection('personeros');

    if (action === 'delete') {
      const id = cleanId(body.id);
      const reference = collection.doc(id);
      const snapshot = await reference.get();
      if (!snapshot.exists) throw new ApiError(404, 'El personero ya no existe.');
      await reference.delete();
      await adminDb.collection('electoralAudit').add({
        action: 'personero.delete',
        personeroId: id,
        actor: session.email,
        createdAt: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ success: true, id });
    }

    let input;
    try {
      input = validatePersoneroInput(body.personero);
    } catch (error) {
      throw new ApiError(400, error instanceof Error ? error.message : 'Los datos no son válidos.');
    }

    const duplicateDni = await collection.where('dni', '==', input.dni).limit(2).get();

    if (input.local_id) {
      const localSnapshot = await adminDb.collection('locales').doc(input.local_id).get();
      if (!localSnapshot.exists) throw new ApiError(400, 'El local seleccionado ya no está disponible.');

      if (input.mesa_numero) {
        const mesaSnapshot = await adminDb.collection('mesas')
          .where('local_id', '==', input.local_id)
          .where('numero', '==', input.mesa_numero)
          .limit(1)
          .get();
        if (mesaSnapshot.empty) throw new ApiError(400, 'La mesa no pertenece al local seleccionado.');
      }
    } else if (input.mesa_numero) {
      throw new ApiError(400, 'Para asignar una mesa debes seleccionar primero un local de votación.');
    }

    if (action === 'create') {
      if (!duplicateDni.empty) throw new ApiError(409, 'Ya existe un personero registrado con ese DNI.');
      const reference = collection.doc();
      await reference.set({
        ...input,
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      });
      await adminDb.collection('electoralAudit').add({
        action: 'personero.create',
        personeroId: reference.id,
        actor: session.email,
        createdAt: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ success: true, id: reference.id });
    }

    const id = cleanId(body.id);
    const reference = collection.doc(id);
    const current = await reference.get();
    if (!current.exists) throw new ApiError(404, 'El personero ya no existe.');
    if (duplicateDni.docs.some((document) => document.id !== id)) {
      throw new ApiError(409, 'Ya existe otro personero registrado con ese DNI.');
    }

    await reference.update({ ...input, updated_at: FieldValue.serverTimestamp() });
    await adminDb.collection('electoralAudit').add({
      action: 'personero.update',
      personeroId: id,
      actor: session.email,
      createdAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ success: true, id });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
