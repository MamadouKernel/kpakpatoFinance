const CACHE_NAME = "kpakpato-finance-v2";
const PRECACHE = ["/", "/manifest.json", "/icon.svg", "/icon-192.png"];

// En développement (localhost) on ne met rien en cache : le code change à chaque sauvegarde.
const IS_LOCAL = ["localhost", "127.0.0.1"].includes(self.location.hostname);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (IS_LOCAL || request.method !== "GET") return;

  const url = new URL(request.url);
  // Firebase, Google et les routes /api/* ne passent jamais par le cache.
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  // Fichiers du build (noms uniques) : le cache est toujours valable, on le sert d'abord.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
          })
      )
    );
    return;
  }

  // Pages, icônes, manifeste : le réseau d'abord (version à jour), le cache hors ligne.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() =>
        caches
          .match(request, { ignoreSearch: true })
          .then((cached) => cached || (request.mode === "navigate" ? caches.match("/") : undefined))
          .then((cached) => cached || Response.error())
      )
  );
});
