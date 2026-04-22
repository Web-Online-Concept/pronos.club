const CACHE_NAME = "pronos-club-v3";

// ─── Install ────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll([
        "/pronos_club.png",
        "/android-chrome-192x192.png",
        "/android-chrome-512x512.png",
      ]).catch(() => {
        // Silent : si une image manque, on continue
      })
    )
  );
  self.skipWaiting();
});

// ─── Activate ───────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ─── Fetch ──────────────────────────────────────────────────
// STRATÉGIE : le SW NE DOIT PAS intercepter les pages HTML ni les API
// Il ne cache QUE les images statiques. Tout le reste passe direct au réseau.
// Ça évite les crashes "Failed to fetch" sur les routes dynamiques.
self.addEventListener("fetch", (event) => {
  // Uniquement les GET
  if (event.request.method !== "GET") return;

  const url = event.request.url;

  // Ne JAMAIS intercepter : API, pages HTML, vidéos, range requests, websockets
  if (
    url.includes("/api/") ||
    url.includes("/_next/") ||
    url.match(/\.(mp4|webm|ogg|m4a)$/) ||
    event.request.headers.get("range") ||
    event.request.mode === "navigate"
  ) {
    return;
  }

  // Intercepter SEULEMENT les images statiques pour les mettre en cache
  if (url.match(/\.(png|jpg|jpeg|svg|ico|webp|gif)$/)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request)
          .then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            return response;
          })
          .catch(() => {
            // Si l'image échoue au réseau, on renvoie une réponse vide plutôt que de crasher
            return new Response("", { status: 404 });
          });
      })
    );
  }
  // Tout le reste : pas d'interception, comportement navigateur par défaut
});

// ─── Push ───────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    data = { body: event.data?.text() ?? "" };
  }

  const title = data.title || "PRONOS.CLUB";
  const options = {
    body: data.body || "Nouveau pronostic disponible !",
    icon: "/android-chrome-192x192.png",
    badge: "/android-chrome-192x192.png",
    data: {
      url: data.url || "/fr/pronostics",
      timestamp: Date.now(),
    },
    vibrate: [200, 100, 200],
    tag: "pronos-club-notification",
    renotify: true,
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ─── Notification Click ─────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/fr/pronostics";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of allClients) {
        if (client.url.includes(self.location.origin)) {
          await client.focus();
          if ("navigate" in client) {
            return client.navigate(url);
          }
          return;
        }
      }

      return self.clients.openWindow(url);
    })()
  );
});

// ─── Notification Close ─────────────────────────────────────
self.addEventListener("notificationclose", () => {
  // Pas de tracking
});

// ─── Message ────────────────────────────────────────────────
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});