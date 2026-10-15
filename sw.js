const CACHE_NAME = 'weekwise-static-v77';
const APP_SHELL = ['./', './index.html', './privacy.html', './css/weekwise-privacy.css', './css/weekwise-legacy.css', './js/weekwise-app-primitives.js', './js/weekwise-app-persistence.js', './js/weekwise-app-settings.js', './js/weekwise-app-calendar.js', './js/weekwise-app-templates.js', './js/weekwise-app-editor.js', './js/weekwise-app-notifications.js', './js/weekwise-app-cloud.js', './js/weekwise-app-workspace.js', './js/weekwise-app-zone.js', './js/weekwise-app-focus.js', './js/weekwise-app-habits.js', './js/weekwise-app-recurrence.js', './js/weekwise-app-countdowns.js', './js/weekwise-app-capture.js', './js/weekwise-app-transfers.js', './js/weekwise-app-startup.js', './js/weekwise-app.js', './js/weekwise-focus.js', './js/weekwise-focus-picker.js', './js/weekwise-habits.js', './js/weekwise-pwa.js', './js/weekwise-update-safety.js', './js/weekwise-cloud-transport.js', './js/weekwise-cloud-merge.js', './js/weekwise-data.js', './js/weekwise-timezones.js', './js/weekwise-recurring-bulk.js', './js/weekwise-series-schedule.js', './js/weekwise-series-schedule-ui.js', './js/weekwise-account-privacy.js', './js/weekwise-account-ui.js', './js/weekwise-task-history.js', './js/weekwise-task-history-ui.js', './js/weekwise-onboarding.js', './js/weekwise-insights.js', './js/weekwise-calendar-layout.js', './js/weekwise-calendar-range.js', './js/weekwise-zone-conversion.js', './js/weekwise-zone-conversion-ui.js', './js/weekwise-task-options.js', './js/weekwise-recurring-placement.js', './js/weekwise-task-schedule.js', './js/weekwise-calendar-range-ui.js', './js/weekwise-drafts.js', './js/weekwise-list-window.js', './js/weekwise-planning.js', './js/weekwise-plan-ui.js', './js/weekwise-personal.js', './js/weekwise-personal-ui.js', './css/weekwise-plan.css', './css/weekwise.css', './css/weekwise-modern.css', './js/weekwise-interface.js', './js/weekwise-task-actions.js', './js/weekwise-productivity.js', './css/weekwise-productivity.css', './js/weekwise-today.js', './js/weekwise-experience.js', './js/weekwise-accessibility.js', './weekwise-push.js', './weekwise-calendar.js', './manifest.webmanifest', './icons/icon.svg','./icons/icon-192.png','./icons/icon-512.png','./icons/apple-touch-icon.png','./fonts/plus-jakarta-sans-variable-c680cf2e71.woff2','./fonts/OFL.txt','./web-vitals-LICENSE.txt','./js/weekwise-evidence.js','./js/weekwise-recovery.js','./js/weekwise-vitals.js','./js/weekwise-performance.js','./js/weekwise-quality.js','./js/weekwise-viewport.js','./css/weekwise-quality.css','./css/weekwise-entry.css','./css/weekwise-polish.css','./js/weekwise-motion.js','./js/weekwise-entry.js','./js/weekwise-diagnostics.js','./js/weekwise-help.js','./css/weekwise-help.css'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
});
self.addEventListener('message', event => {
  if(event.data?.type==='WEEKWISE_ACTIVATE_UPDATE')self.skipWaiting();
  if(event.data?.type==='WEEKWISE_HEALTH_CHECK'&&event.ports?.[0])event.waitUntil((async()=>{
    const names=await caches.keys(),cache=names.includes(CACHE_NAME)?await caches.open(CACHE_NAME):null;
    const hits=cache?await Promise.all(APP_SHELL.map(url=>cache.match(url).then(Boolean))):APP_SHELL.map(()=>false);
    event.ports[0].postMessage({kind:'weekwise-shell-health',cacheVersion:CACHE_NAME,expected:APP_SHELL.length,cached:hits.filter(Boolean).length,missing:hits.filter(hit=>!hit).length});
  })());
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
    event.respondWith(fetch(request).catch(() => caches.open(CACHE_NAME).then(async cache => await cache.match(request,{ignoreSearch:true}) || cache.match('./index.html'))));
    return;
  }
  const shell = new Set(APP_SHELL.map(path => new URL(path, self.registration.scope).href));
  if (!shell.has(request.url)) return; // Never cache API responses or account data.
  event.respondWith(caches.open(CACHE_NAME).then(cache => cache.match(request)).then(cached => cached || fetch(request).then(response => {
    if (response && response.ok) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
    }
    return response;
  })));
});
