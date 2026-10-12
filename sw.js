const CACHE_NAME = 'weekwise-static-v76';
const APP_SHELL = ['./', './index.html', './js/weekwise-data.js', './js/weekwise-planning.js', './js/weekwise-plan-ui.js', './css/weekwise-plan.css', './weekwise-push.js', './weekwise-calendar.js', './manifest.webmanifest', './icons/icon.svg'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('weekwise-static-') && key !== CACHE_NAME).map(key => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('push', event => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_) {
    try { payload = { body: event.data ? event.data.text() : '' }; } catch (_) {}
  }
  const title = String(payload.title || 'Weekwise · Task reminder').slice(0, 100);
  const url = (() => {
    try {
      const candidate = new URL(payload.url || self.registration.scope, self.location.origin);
      const scope = new URL(self.registration.scope);
      return candidate.origin === scope.origin && candidate.pathname.startsWith(scope.pathname)
        ? candidate.href
        : scope.href;
    } catch (_) {
      return self.registration.scope;
    }
  })();
  const options = {
    body: String(payload.body || 'Your task reminder is due now.').slice(0, 220),
    tag: String(payload.tag || 'weekwise-background-reminder').slice(0, 240),
    renotify: false,
    icon: './icons/icon.svg',
    data: { url, taskId: String(payload.taskId || ''), reminderAt: String(payload.reminderAt || '') }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const scope = new URL(self.registration.scope);
  let target;
  try {
    const candidate = new URL(event.notification.data && event.notification.data.url || scope.href, scope.origin);
    target = candidate.origin === scope.origin && candidate.pathname.startsWith(scope.pathname)
      ? candidate
      : scope;
  } catch (_) {
    target = scope;
  }
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (client.url.startsWith(scope.origin + scope.pathname)) {
        try {
          const focused = await client.focus();
          if (focused && typeof focused.navigate === 'function') await focused.navigate(target.href);
          return;
        } catch (_) {}
      }
    }
    await self.clients.openWindow(target.href);
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy));
      }
      return response;
    }).catch(() => caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
    if (response && response.ok) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
    }
    return response;
  })));
});