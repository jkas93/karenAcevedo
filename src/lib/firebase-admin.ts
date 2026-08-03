import 'server-only';

import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function requireServerEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}`);
  }
  return value;
}

export function getAdminServices() {
  const adminApp = getApps().length
    ? getApp()
    : initializeApp({
        credential: cert({
          projectId: requireServerEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID'),
          clientEmail: requireServerEnv('FIREBASE_CLIENT_EMAIL'),
          privateKey: requireServerEnv('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n'),
        }),
      });

  return {
    adminAuth: getAuth(adminApp),
    adminDb: getFirestore(adminApp),
  };
}
