const CACHE_NAME = "pronos-club-v1";

// Install — pre-cache essential assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll([
        "/pronos_club.png",
        "/android-chrome-192x192.png",
        "/android-chrome-512x512.png",
      ])
    )
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — network first, fallback to cache (skip videos and range requests)
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  // Don't intercept video files or range requests — they break on mobile
  if (event.request.url.match(/\.(mp4|webm|ogg|m4a)$/) || event.request.headers.get("range")) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache static assets
        if (response.ok && event.request.url.match(/\.(png|jpg|jpeg|svg|ico|webp)$/)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((r) => r || fetch(event.request)))
  );
});

// Push notifications
self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};

  const title = data.title ?? "PRONOS.CLUB";
  const options = {
    body: data.body ?? "Nouveau pronostic disponible !",
    icon: "/android-chrome-192x192.png",
    badge: "/android-chrome-192x192.png",
    data: { url: data.url ?? "/fr/pronostics" },
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/fr/pronostics";
  event.waitUntil(clients.openWindow(url));
});