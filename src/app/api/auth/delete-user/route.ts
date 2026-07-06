import { NextResponse } from 'next/server';
import { getAdminServices } from '@/lib/firebase-admin';

export async function POST(req: Request) {
  try {
    const { adminAuth, adminDb } = getAdminServices();
    const { uid, userEmail, adminEmail } = await req.json();

    if ((!uid && !userEmail) || !adminEmail) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    // Seguridad: Verificar que el solicitante sea Administrador
    const adminDoc = await adminDb.collection('usuarios').doc(adminEmail).get();
    
    if (!adminDoc.exists || adminDoc.data()?.rol !== 'administrador') {
      return NextResponse.json({ error: 'No autorizado. Se requiere rol de Administrador.' }, { status: 403 });
    }

    // Obtener UID si no viene en el body
    let targetUid = uid;
    if (!targetUid && userEmail) {
      try {
        const userRecord = await adminAuth.getUserByEmail(userEmail);
        targetUid = userRecord.uid;
      } catch (e: any) {
        if (e.code === 'auth/user-not-found') {
          // Si el usuario no existe en Auth, igual procedemos a borrarlo de Firestore
          targetUid = uid; // Queda undefined, lo saltamos abajo
        } else {
          throw e;
        }
      }
    }

    // Buscar al usuario a eliminar en Firestore (por uid o email)
    let userDocs;
    if (targetUid) {
       userDocs = await adminDb.collection('usuarios').where('uid', '==', targetUid).get();
    } else {
       // Fallback por correo si no hay uid y no está en auth
       userDocs = await adminDb.collection('usuarios').where('correo', '==', userEmail).get();
       // O si el document ID es el email
       if (userDocs.empty) {
         const docRef = await adminDb.collection('usuarios').doc(userEmail).get();
         if (docRef.exists) {
           userDocs = { empty: false, docs: [docRef] };
         }
       }
    }
    
    // Eliminar el usuario de Firebase Auth
    if (targetUid) {
      await adminAuth.deleteUser(targetUid);
    }

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
