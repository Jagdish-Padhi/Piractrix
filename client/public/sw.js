self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data?.json() || {};
  } catch (err) {
    data = { title: 'Piractrix Alert', body: event.data?.text() || 'New violation detected.' };
  }
  
  const title = data.title || 'Piractrix Alert';
  const options = {
    body: data.body || 'A new copyright violation requires your attention.',
    icon: '/logo.png',
    badge: '/logo.png',
    data: { url: data.url || '/dashboard/violations' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      const targetUrl = event.notification.data?.url || '/dashboard/violations';
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
