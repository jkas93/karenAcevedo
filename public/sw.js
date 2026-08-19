const APP_PATH = '/dashboard/calendario';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    event.waitUntil(self.skipWaiting());
  }
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
      eventId: data.eventId,
      clickToken: data.clickToken,
    },
  };
  if (Array.isArray(data.actions)) options.actions = data.actions.slice(0, 1);

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title || 'Equipo Karen Acevedo', options),
      typeof self.navigator?.setAppBadge === 'function'
        ? self.navigator.setAppBadge(1).catch(() => undefined)
        : Promise.resolve(),
    ]),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || APP_PATH, self.location.origin).href;
  const eventId = event.notification.data?.eventId;
  const clickToken = event.notification.data?.clickToken;
  const tracking = eventId && clickToken
    ? fetch('/api/push/event', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, clickToken }), keepalive: true,
      }).catch(() => undefined)
    : Promise.resolve();
  const clearBadge = typeof self.navigator?.clearAppBadge === 'function'
    ? self.navigator.clearAppBadge().catch(() => undefined)
    : Promise.resolve();

  event.waitUntil(
    Promise.all([tracking, clearBadge, self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client && new URL(client.url).origin === self.location.origin) {
          if ('navigate' in client) {
            return client.navigate(targetUrl).then(() => client.focus());
          }
          return client.focus();
        }
      }
      return self.clients.openWindow ? self.clients.openWindow(targetUrl) : undefined;
    })]),
  );
});

