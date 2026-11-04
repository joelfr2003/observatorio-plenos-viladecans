const CACHE = "observatorio-viladecans-v7";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./js/config.js"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key =>
              key.startsWith("observatorio-viladecans-") && key !== CACHE
            )
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin || request.method !== "GET") {
    return;
  }

  // Prioriza la red para que las actualizaciones de GitHub Pages se descarguen.
  // Si no hay conexión, utiliza la copia almacenada en caché.
  event.respondWith(
    fetch(request)
      .then(response => {
        if (!response || !response.ok) return response;

        return caches.open(CACHE).then(cache =>
          cache.put(request, response.clone()).then(() => response)
        );
      })
      .catch(() =>
        caches.match(request).then(cached =>
          cached || caches.match("./index.html")
        )
      )
  );
});
