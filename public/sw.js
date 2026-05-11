/**
 * ═══════════════════════════════════════════════════════════════════
 * Service Worker PRONOS.CLUB (v3 — fix bugs notif 11/05/2026)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Fix bugs notif (11/05/2026) :
 *   - Bug critique : le fetch handler v2 interceptait TOUTES les requêtes GET
 *     (sauf vidéos/range), y compris les navigations Next.js (/fr/espace,
 *     /fr/pronostics, etc.). Quand le réseau bafouillait, le catch → cache
 *     → refetch déclenchait une boucle qui rejetait la promise et cassait
 *     la navigation. Résultat visible : ouverture en nouvelle fenêtre
 *     au lieu de focus, erreurs "FetchEvent ... resulted in a network
 *     error" en console.
 *
 *     Fix : on n'intercepte QUE les images statiques (cache-first). Tout
 *     le reste (navigations, /api/*, _next/*, fonts, CSS, JS) passe au
 *     browser natif sans interception.
 *
 *   - Bug #4 : tag dynamique pour les notifs push. Avant, tag global
 *     "pronos-club-notification" → toute nouvelle notif écrasait la
 *     précédente. Maintenant le payload peut fournir son propre tag
 *     (ex: "pick-IA-0005"). Fallback timestamp si non fourni.
 *
 *   - Bug #6 : fallback openWindow si client.navigate() échoue dans
 *     notificationclick. Avant : si navigate était dispo mais plantait
 *     (rare mais possible cross-origin), l'utilisateur cliquait et
 *     rien ne se passait sauf le focus.
 *
 *   - Cache renommé v3 → invalide l'ancien cache v2 au prochain déploiement.
 *
 * Path : public/sw.js
 * ═══════════════════════════════════════════════════════════════════
 */

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

// ─── Fetch (FIX bug critique) ───────────────────────────────
// On n'intercepte QUE les images statiques. Tout le reste passe au browser
// natif. Un SW de notifications n'a pas besoin de gérer les navigations.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = event.request.url;
  const isImage = /\.(png|jpg|jpeg|svg|ico|webp|gif)(\?.*)?$/i.test(url);

  // Si ce n'est pas une image, on ne touche pas : le browser fait son job.
  if (!isImage) return;

  // Cache-first pour les images (avec fallback réseau silencieux)
  event.respondWith(
    (async () => {
      try {
        const cached = await caches.match(event.request);
        if (cached) return cached;

        const response = await fetch(event.request);
        if (response.ok) {
          const clone = response.clone();
          const cache = await caches.open(CACHE_NAME);
          // put() peut throw si la requête est opaque ou autre — silent
          cache.put(event.request, clone).catch(() => {});
        }
        return response;
      } catch {
        // Réseau down + pas en cache : on retourne une réponse vide plutôt
        // que de laisser la promise rejetée polluer la console.
        return new Response("", {
          status: 504,
          statusText: "Image fetch failed",
        });
      }
    })()
  );
});

// ─── Push (CRITIQUE iOS : toujours appeler showNotification) ─
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    // Fallback si payload non-JSON (texte brut)
    data = { body: event.data?.text() ?? "" };
  }

  const title = data.title || "PRONOS.CLUB";

  // Fix bug #4 — tag dynamique pour ne pas écraser les notifs précédentes
  // Le payload peut fournir un tag (ex: "pick-IA-0005") ; sinon timestamp
  // unique pour garantir l'unicité.
  const tag = data.tag || `pronos-club-${Date.now()}`;

  const options = {
    body: data.body || "Nouveau pronostic disponible !",
    icon: "/android-chrome-192x192.png",
    badge: "/android-chrome-192x192.png",
    data: {
      url: data.url || "/fr/pronostics",
      timestamp: Date.now(),
    },
    vibrate: [200, 100, 200],
    tag,
    renotify: true,
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ─── Notification Click ─────────────────────────────────────
// Fix bug #6 — fallback openWindow si navigate() échoue
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/fr/pronostics";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // Si une fenêtre pronos.club est déjà ouverte, on la focus et on navigue
      for (const client of allClients) {
        if (client.url.includes(self.location.origin)) {
          try {
            await client.focus();
            if ("navigate" in client) {
              try {
                return await client.navigate(url);
              } catch {
                // navigate peut throw (cross-origin restrictions par ex.)
                // → on tombe sur openWindow ci-dessous
              }
            }
            // Pas de navigate dispo OU navigate a échoué : on ouvre
            return self.clients.openWindow(url);
          } catch {
            // focus a échoué : on tente openWindow
            return self.clients.openWindow(url);
          }
        }
      }

      // Aucun client pronos.club ouvert → ouvrir nouvelle fenêtre
      return self.clients.openWindow(url);
    })()
  );
});

// ─── Notification Close ─────────────────────────────────────
self.addEventListener("notificationclose", () => {
  // Pas de tracking pour le moment
});

// ─── Message (debug) ────────────────────────────────────────
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});