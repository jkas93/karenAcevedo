import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminServices } from '@/lib/firebase-admin';
import { ApiError, apiErrorResponse, requireAdmin, readJsonBody } from '@/lib/server/admin-auth';

export const runtime = 'nodejs';

function downloadUrl(bucket: string, path: string, token: string) {
  return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
}

export async function POST(request: Request) {
  try {
    const session = await requireAdmin(request);
    const body = (await readJsonBody(request).catch(() => ({}))) as Record<string, unknown>;
    const mesaId = typeof body?.mesaId === 'string' ? body.mesaId.trim() : null;

    const { adminDb, adminStorage } = getAdminServices();
    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (!bucketName) {
      throw new ApiError(503, 'El bucket de almacenamiento Firebase Storage no está configurado.');
    }

    // Si se especifica una mesa concreta
    if (mesaId && mesaId !== 'all') {
      const doc = await adminDb.collection('actas').doc(mesaId).get();
      if (!doc.exists) {
        throw new ApiError(404, `No se encontró el acta para la mesa ${mesaId}.`);
      }
      const data = doc.data();
      if (!data?.foto_backup_base64 && !data?.foto_pendiente) {
        return NextResponse.json({
          success: true,
          message: 'Esta acta no tiene fotografías pendientes de regularización.',
          regularized: 0,
        });
      }

      const backupBase64: string = data?.foto_backup_base64 || '';
      if (!backupBase64) {
        throw new ApiError(400, 'El acta no cuenta con imagen de respaldo en base64 para regularizar.');
      }

      const match = backupBase64.match(/^data:(image\/[a-zA-Z0-9.+_-]+);base64,(.+)$/);
      if (!match) {
        throw new ApiError(400, 'El formato de imagen de respaldo no es válido.');
      }

      const mimeType = match[1];
      const buffer = Buffer.from(match[2], 'base64');
      const ext = mimeType === 'image/webp' ? 'webp' : (mimeType.split('/')[1] || 'webp');
      const imagePath = `actas/${mesaId}_regularizada_${Date.now()}.${ext}`;
      const imageToken = randomUUID();

      await adminStorage.bucket(bucketName).file(imagePath).save(buffer, {
        resumable: false,
        validation: 'crc32c',
        metadata: {
          contentType: mimeType,
          cacheControl: 'private, max-age=0, no-store',
          metadata: {
            firebaseStorageDownloadTokens: imageToken,
            regularizedBy: session.email,
            mesaId,
          },
        },
      });

      const imageUrl = downloadUrl(bucketName, imagePath, imageToken);

      await doc.ref.update({
        foto_url: imageUrl,
        foto_path: imagePath,
        foto_pendiente: false,
        foto_estado: 'almacenada',
        foto_backup_base64: FieldValue.delete(),
        foto_regularizada_at: FieldValue.serverTimestamp(),
        foto_regularizada_por: session.email,
      });

      await adminDb.collection('actasAudit').add({
        action: 'acta.photo_regularized',
        mesaId,
        actor: session.email,
        imagePath,
        imageUrl,
        createdAt: FieldValue.serverTimestamp(),
      });

      return NextResponse.json({
        success: true,
        message: `Fotografía del acta ${mesaId} regularizada con éxito en Cloud Storage.`,
        regularized: 1,
        imageUrl,
      });
    }

    // Si se regularizan todas las pendientes
    const snap = await adminDb.collection('actas').where('foto_pendiente', '==', true).get();
    if (snap.empty) {
      return NextResponse.json({
        success: true,
        message: 'No hay actas con fotografías pendientes de regularización.',
        regularized: 0,
      });
    }

    let successCount = 0;
    const errors: string[] = [];

    for (const doc of snap.docs) {
      const data = doc.data();
      const backupBase64: string = data.foto_backup_base64 || '';
      if (!backupBase64) continue;

      try {
        const match = backupBase64.match(/^data:(image\/[a-zA-Z0-9.+_-]+);base64,(.+)$/);
        if (!match) continue;

        const mimeType = match[1];
        const buffer = Buffer.from(match[2], 'base64');
        const ext = mimeType === 'image/webp' ? 'webp' : (mimeType.split('/')[1] || 'webp');
        const imagePath = `actas/${doc.id}_regularizada_${Date.now()}.${ext}`;
        const imageToken = randomUUID();

        await adminStorage.bucket(bucketName).file(imagePath).save(buffer, {
          resumable: false,
          validation: 'crc32c',
          metadata: {
            contentType: mimeType,
            cacheControl: 'private, max-age=0, no-store',
            metadata: {
              firebaseStorageDownloadTokens: imageToken,
              regularizedBy: session.email,
              mesaId: doc.id,
            },
          },
        });

        const imageUrl = downloadUrl(bucketName, imagePath, imageToken);

        await doc.ref.update({
          foto_url: imageUrl,
          foto_path: imagePath,
          foto_pendiente: false,
          foto_estado: 'almacenada',
          foto_backup_base64: FieldValue.delete(),
          foto_regularizada_at: FieldValue.serverTimestamp(),
          foto_regularizada_por: session.email,
        });

        successCount++;
      } catch (err) {
        errors.push(`Mesa ${doc.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Se regularizaron ${successCount} de ${snap.size} actas.`,
      regularized: successCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
