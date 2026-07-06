import { NextResponse } from 'next/server';
import { getAdminServices } from '@/lib/firebase-admin';

export async function POST(req: Request) {
  try {
    const { adminAuth, adminDb } = getAdminServices();
    const { uid, adminEmail } = await req.json();

    if (!uid || !adminEmail) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    // Seguridad: Verificar que el solicitante sea Administrador
    const adminDoc = await adminDb.collection('usuarios').doc(adminEmail).get();
    
    if (!adminDoc.exists || adminDoc.data()?.rol !== 'administrador') {
      return NextResponse.json({ error: 'No autorizado. Se requiere rol de Administrador.' }, { status: 403 });
    }

    // Buscar al usuario a eliminar en Firestore
    const userDocs = await adminDb.collection('usuarios').where('uid', '==', uid).get();
    
    // Eliminar el usuario de Firebase Auth
    await adminAuth.deleteUser(uid);

    // Eliminar el usuario de Firestore
    if (!userDocs.empty) {
      const batch = adminDb.batch();
      userDocs.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    }

    return NextResponse.json({ success: true, message: 'Usuario eliminado correctamente' });
  } catch (error: any) {
    console.error('Error eliminando usuario:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
}
