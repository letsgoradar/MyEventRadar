const CACHE_NAME = 'letsgo-radar-v3';
const STATIC_ASSETS = [
  '/manifest.json',
  '/images/letsgo-radar-logo.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Offline fallback response
function offlineFallback(isJson) {
  if (isJson) {
    return new Response(
      JSON.stringify({ error: 'Je bent offline' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
  return new Response('Offline — probeer het opnieuw.', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}

self.addEventListener('fetch', (event) => {
  // Alleen GET verzoeken afhandelen
  if (event.request.method !== 'GET') return;

  // Alleen http/https URL's afhandelen — negeer data:, blob:, chrome-extension:, etc.
  let url;
  try {
    url = new URL(event.request.url);
  } catch {
    return;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // API-verzoeken: altijd naar het netwerk, offline JSON fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => offlineFallback(true))
    );
    return;
  }

  // Navigatieverzoeken (HTML-pagina's): netwerk-first zodat nieuwe deploys altijd worden geladen
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Sla de pagina op in cache als het een succesvolle response is
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match('/').then((cached) => cached || offlineFallback(false))
        )
    );
    return;
  }

  // Statische assets (JS/CSS/afbeeldingen): stale-while-revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Herlaad op de achtergrond (stale-while-revalidate)
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, response.clone());
            });
          }
          return response;
        })
        .catch(() => null);

      // Geef cache terug als die bestaat, anders wacht op netwerk
      if (cachedResponse) {
        return cachedResponse;
      }
      return networkFetch.then((response) => response || offlineFallback(false));
    })
  );
});
