import { getAdminServices } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

const FALLBACK_CONTACT = {
  whatsapp: '51961858568',
  correo: 'karen.alcaldesa2026@gmail.com',
};

export async function GET() {
  try {
    const { adminDb } = getAdminServices();
    const snapshot = await adminDb.collection('config').doc('contacto').get();
    const data = snapshot.data();
    return Response.json({
      whatsapp: typeof data?.whatsapp === 'string' ? data.whatsapp : FALLBACK_CONTACT.whatsapp,
      correo: typeof data?.correo === 'string' ? data.correo : FALLBACK_CONTACT.correo,
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' },
    });
  } catch (error) {
    console.error('Error cargando contacto público:', error);
    return Response.json(FALLBACK_CONTACT, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  }
}
