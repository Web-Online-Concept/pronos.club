const CACHE_NAME = "pronos-club-v2";

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
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  // Ne pas intercepter les vidéos ni les range requests
  if (event.request.url.match(/\.(mp4|webm|ogg|m4a)$/) || event.request.headers.get("range")) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && event.request.url.match(/\.(png|jpg|jpeg|svg|ico|webp)$/)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((r) => r || fetch(event.request)))
  );
});

// ─── Push ───────────────────────────────────────────────────
// CRITIQUE pour iOS : cet event DOIT toujours appeler showNotification
// sinon iOS pénalise la PWA (throttle futur)
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    // Fallback si payload non-JSON (texte brut)
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
    // tag évite les doublons : si une notif avec ce tag existe déjà elle est remplacée
    tag: "pronos-club-notification",
    // renotify : true = refait vibrer même si tag existe déjà
    renotify: true,
    // requireInteraction false = iOS la fait disparaître automatiquement (comme les autres)
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

      // Si une fenêtre est déjà ouverte, la focus et naviguer
      for (const client of allClients) {
        if (client.url.includes(self.location.origin)) {
          await client.focus();
          if ("navigate" in client) {
            return client.navigate(url);
          }
          return;
        }
      }

      // Sinon ouvrir une nouvelle fenêtre
      return self.clients.openWindow(url);
    })()
  );
});

// ─── Notification Close ─────────────────────────────────────
// Utile pour les stats (optionnel)
self.addEventListener("notificationclose", () => {
  // Pas de tracking pour le moment
});

// ─── Message (pour debug : l'app peut envoyer un message au SW) ──
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});