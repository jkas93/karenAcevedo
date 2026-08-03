'use client';

import { authenticatedPost } from '@/lib/firebase/authenticated-request';

export async function unregisterCurrentDevicePush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  const registration = await navigator.serviceWorker.getRegistration('/');
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;

  try {
    await authenticatedPost('/api/push/unsubscribe', {
      endpoint: subscription.endpoint,
    });
  } catch (error) {
    console.warn('No se pudo retirar el registro remoto antes de cerrar sesion:', error);
  } finally {
    await subscription.unsubscribe().catch((error) => {
      console.warn('No se pudo retirar la suscripcion local:', error);
    });
  }
}
