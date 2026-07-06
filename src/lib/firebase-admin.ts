import { initializeApp, getApps, cert, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export function getAdminServices() {
  if (getApps().length === 0) {
    if (!process.env.FIREBASE_PRIVATE_KEY) {
      throw new Error("Faltan variables de entorno FIREBASE_PRIVATE_KEY para Firebase Admin");
    }
    
    initializeApp({
      credential: cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
  }

  const app = getApp();
  return {
    adminAuth: getAuth(app),
    adminDb: getFirestore(app),
  };
}
