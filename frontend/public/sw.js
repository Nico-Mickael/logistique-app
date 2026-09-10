/* Service worker — Logistique ADES
 * Responsable uniquement des notifications push (Web Push).
 * Aucun cache d'application n'est géré ici : les mises à jour
 * de l'application passent par le build Vite normal.
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Regroupe les notifications identiques en une seule sur l'appareil
// (anti-doublon côté OS). Sans entité, chaque événement reste distinct.
function buildTag(data) {
  if (!data) return undefined;
  const parts = [data.notification_type, data.entity_type, data.entity_id];
  if (parts.some((p) => p == null)) return undefined;
  return parts.join(':');
}

self.addEventListener('push', (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { body: event.data.text() };
    }
  }

  const options = {
    body: payload.body || 'Une nouvelle information vous attend.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: payload.data || {},
  };

  const tag = buildTag(payload.data);
  if (tag) {
    options.tag = tag;
    options.renotify = true;
  }

  event.waitUntil(self.registration.showNotification(payload.title || 'Logistique ADES', options));
});

self.addEventListener('notificationclick', (event) => {
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (new URL(client.url).pathname === new URL(url).pathname) {
          client.focus();
          return;
        }
      }
      return self.clients.openWindow(url);
    })
  );
});