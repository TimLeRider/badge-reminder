/* Service worker : réception des notifications Web Push (FCM) lorsque le site est fermé.
   Les messages sont envoyés en « data-only » par le planificateur ; ce fichier n'a donc
   besoin d'aucune clé ni du SDK Firebase. Il est servi sous /badge-reminder/sw.js. */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { data: { body: event.data ? event.data.text() : '' } };
  }
  const d = payload.data || {};
  const n = payload.notification || {};
  const title = d.title || n.title || 'Badge Reminder';
  const options = {
    body: d.body || n.body || '',
    icon: self.registration.scope + 'icon-192.png',
    badge: self.registration.scope + 'icon-192.png',
    tag: d.tag || undefined,
    data: { badgeId: d.badgeId || '' },
    lang: 'fr',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const badgeId = (event.notification.data && event.notification.data.badgeId) || '';
  const url = self.registration.scope + '#/' + (badgeId ? 'dashboard/' + encodeURIComponent(badgeId) : 'dashboard');
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (list) => {
      for (const c of list) {
        if (c.url.startsWith(self.registration.scope) && 'focus' in c) {
          await c.focus();
          if ('navigate' in c) { try { await c.navigate(url); } catch (e) { /* ignoré */ } }
          return;
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
