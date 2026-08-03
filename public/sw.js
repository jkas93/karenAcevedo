const APP_PATH = '/dashboard/calendario';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data = {};
  try {
    data = event.data.json();
  } catch {
    data = { body: event.data.text() };
  }

  const options = {
    body: data.body || 'Hay novedades en el calendario operativo.',
    icon: data.icon || '/brazo.png',
    badge: data.badge || '/logo-fuerza.png',
    tag: data.tag || 'calendario-operativo',
    renotify: true,
    vibrate: [180, 80, 180],
    data: {
      url: data.url || APP_PATH,
      receivedAt: Date.now(),
    },
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Equipo Karen Acevedo', options),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || APP_PATH, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client && new URL(client.url).origin === self.location.origin) {
          if ('navigate' in client) {
            return client.navigate(targetUrl).then(() => client.focus());
          }
          return client.focus();
        }
      }
      return self.clients.openWindow ? self.clients.openWindow(targetUrl) : undefined;
    }),
  );
});

