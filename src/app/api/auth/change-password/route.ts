import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function POST(req: Request) {
  try {
    const { uid, newPassword, adminEmail } = await req.json();

    if (!uid || !newPassword || !adminEmail) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 });
    }

    // Seguridad: Verificar que el solicitante sea Administrador
    const adminDoc = await adminDb.collection('usuarios').doc(adminEmail).get();
    
    if (!adminDoc.exists || adminDoc.data()?.rol !== 'administrador') {
      return NextResponse.json({ error: 'No autorizado. Se requiere rol de Administrador.' }, { status: 403 });
    }

    // Cambiar la contraseña usando Admin SDK
    await adminAuth.updateUser(uid, {
      password: newPassword,
    });

    return NextResponse.json({ success: true, message: 'Contraseña actualizada correctamente' });
  } catch (error: any) {
    console.error('Error cambiando contraseña:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
}
