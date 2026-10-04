import { createHash, randomUUID } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { getAdminServices } from '@/lib/firebase-admin';
import { extractActaFromImage } from '@/lib/server/acta-vision';
import { ApiError, apiErrorResponse, requirePermission } from '@/lib/server/admin-auth';
import { type ExtraccionActa } from '@/lib/electoral/acta-schema';
import { PARTIDOS_CHACLACAYO } from '@/lib/firebase/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MIN_SIDE = 900;
const MAX_PIXELS = 40_000_000;

function cleanLocalId(value: FormDataEntryValue | null): string {
  const localId = typeof value === 'string' ? value.trim() : '';
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(localId)) throw new ApiError(400, 'Selecciona un colegio válido.');
  return localId;
}

function downloadUrl(bucket: string, path: string, token: string) {
  return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
}

export async function POST(request: Request) {
  let draftRef: FirebaseFirestore.DocumentReference | null = null;
  try {
    const session = await requirePermission(request, 'actas.manage');
    const form = await request.formData();
    const localId = cleanLocalId(form.get('localId'));
    const image = form.get('image');
    if (!(image instanceof File)) throw new ApiError(400, 'Adjunta la fotografía del acta.');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(image.type)) {
      throw new ApiError(415, 'La fotografía debe ser JPG, PNG o WebP.');
    }
    if (image.size < 1 || image.size > MAX_FILE_BYTES) {
      throw new ApiError(413, 'La fotografía debe pesar como máximo 10 MB.');
    }

    const { adminDb, adminStorage } = getAdminServices();
    const local = await adminDb.collection('locales').doc(localId).get();
    if (!local.exists) throw new ApiError(400, 'El colegio seleccionado ya no está disponible.');

    const source = Buffer.from(await image.arrayBuffer());
    let processedBuffer = source;
    let mimeType = image.type;
    let imgWidth: number | null = null;
    let imgHeight: number | null = null;

    try {
      const sharpModule = (await import('sharp')).default;
      try {
        const webp = await sharpModule(source, { limitInputPixels: MAX_PIXELS, failOn: 'warning' })
          .rotate()
          .webp({ quality: 92, effort: 4, smartSubsample: true })
          .toBuffer();
        const metadata = await sharpModule(webp).metadata();
        if (metadata.width && metadata.height && Math.min(metadata.width, metadata.height) >= MIN_SIDE) {
          processedBuffer = webp;
          mimeType = 'image/webp';
          imgWidth = metadata.width;
          imgHeight = metadata.height;
        }
      } catch (sharpProcessError) {
        console.warn('Sharp processing failed, using raw image:', sharpProcessError);
      }
    } catch (sharpImportError) {
      console.warn('Sharp native module unavailable in this environment, using raw image directly:', sharpImportError);
    }

    const sha256 = createHash('sha256').update(processedBuffer).digest('hex');
    const duplicate = await adminDb.collection('actaDrafts').where('sha256', '==', sha256).limit(5).get();
    const reusable = duplicate.docs.find((document) => {
      const data = document.data();
      return data.localId === localId && data.actor === session.email && data.status === 'review';
    });
    if (reusable) {
      const data = reusable.data();
      return NextResponse.json({
        success: true,
        draftId: reusable.id,
        extraction: data.extraction,
        imageUrl: data.imageUrl,
        reused: true,
      });
    }

    draftRef = adminDb.collection('actaDrafts').doc();
    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (!bucketName) throw new ApiError(503, 'El almacenamiento de actas no está configurado.');
    const ext = mimeType === 'image/webp' ? 'webp' : (mimeType.split('/')[1] || 'jpg');
    const imagePath = `actas/${draftRef.id}.${ext}`;
    const imageToken = randomUUID();
    await adminStorage.bucket(bucketName).file(imagePath).save(processedBuffer, {
      resumable: false,
      validation: 'crc32c',
      metadata: {
        contentType: mimeType,
        cacheControl: 'private, max-age=0, no-store',
        metadata: {
          firebaseStorageDownloadTokens: imageToken,
          ownerUid: session.token.uid,
          draftId: draftRef.id,
          sha256,
        },
      },
    });
    const imageUrl = downloadUrl(bucketName, imagePath, imageToken);
    await draftRef.set({
      status: 'processing',
      localId,
      localName: local.data()?.nombre || '',
      actor: session.email,
      actorUid: session.token.uid,
      imagePath,
      imageUrl,
      imageMime: mimeType,
      imageWidth: imgWidth,
      imageHeight: imgHeight,
      imageBytes: processedBuffer.length,
      sha256,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const isManual = form.get('manual') === 'true';
    if (isManual) {
      const manualExtraction: ExtraccionActa = {
        mesaNumero: '',
        departamento: 'Lima',
        provincia: 'Lima',
        distrito: 'Chaclacayo',
        electoresHabiles: null,
        resultados: PARTIDOS_CHACLACAYO.map((p, idx) => ({
          orden: idx + 1,
          organizacion: p.nombre,
          provincial: null,
          distrital: null,
          confianza: 1,
        })),
        especiales: {
          blancos: { provincial: null, distrital: null },
          nulos: { provincial: null, distrital: null },
          impugnados: { provincial: null, distrital: null },
        },
        totalesEmitidos: { provincial: null, distrital: null },
        ciudadanosVotaron: null,
        observaciones: 'Ingreso manual directo',
        confianzaGeneral: 1,
        advertencias: [],
      };
      await draftRef.update({
        status: 'review',
        extraction: manualExtraction,
        modelVersion: 'manual-entry',
        updatedAt: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ success: true, draftId: draftRef.id, extraction: manualExtraction, imageUrl });
    }

    try {
      const { extraction, modelVersion } = await extractActaFromImage(processedBuffer, mimeType);
      await draftRef.update({
        status: 'review',
        extraction,
        modelVersion,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ success: true, draftId: draftRef.id, extraction, imageUrl });
    } catch (error) {
      await adminStorage.bucket(bucketName).file(imagePath).delete({ ignoreNotFound: true }).catch(() => undefined);
      await draftRef.update({
        status: 'failed',
        failure: error instanceof Error ? error.message.slice(0, 300) : 'No se pudo analizar.',
        imageDeleted: true,
        imagePath: FieldValue.delete(),
        imageUrl: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      throw error;
    }
  } catch (error) {
    return apiErrorResponse(error);
  }
}
