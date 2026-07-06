import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { getAdminServices } = await import('@/lib/firebase-admin');
    const { adminAuth, adminDb } = getAdminServices();
    const { uid, userEmail, newPassword, adminEmail } = await req.json();

    if ((!uid && !userEmail) || !newPassword || !adminEmail) {
      return NextResponse.json({ error: 'Faltan parámetros (uid o userEmail, newPassword, adminEmail)' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 });
    }

    // Seguridad: Verificar que el solicitante sea Administrador
    const adminDoc = await adminDb.collection('usuarios').doc(adminEmail).get();
    
    if (!adminDoc.exists || adminDoc.data()?.rol !== 'administrador') {
      return NextResponse.json({ error: 'No autorizado. Se requiere rol de Administrador.' }, { status: 403 });
    }

    // Obtener UID si no viene en el body
    let targetUid = uid;
    if (!targetUid && userEmail) {
      const userRecord = await adminAuth.getUserByEmail(userEmail);
      targetUid = userRecord.uid;
    }

    // Cambiar la contraseña usando Admin SDK
    await adminAuth.updateUser(targetUid, {
      password: newPassword,
    });

    return NextResponse.json({ success: true, message: 'Contraseña actualizada correctamente' });
  } catch (error: any) {
    console.error('Error cambiando contraseña:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
}
