import * as admin from 'firebase-admin';

export function getAdminServices() {
  if (admin.apps.length === 0) {
    if (!process.env.FIREBASE_PRIVATE_KEY) {
      throw new Error("Faltan variables de entorno FIREBASE_PRIVATE_KEY para Firebase Admin");
    }
    
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
  }

  return {
    adminAuth: admin.auth(),
    adminDb: admin.firestore(),
  };
}
