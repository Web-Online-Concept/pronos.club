// src/lib/rate-limit.ts
// Rate limiter en mémoire — réutilisable sur toutes les routes API

const stores = new Map<string, Map<string, { count: number; resetAt: number }>>();

/**
 * Rate limit par IP.
 * @param storeName - Nom unique du store (ex: "contact", "reviews")
 * @param ip - Adresse IP du client
 * @param max - Nombre max de requêtes par fenêtre
 * @param windowMs - Fenêtre en millisecondes (défaut: 1h)
 * @returns true si autorisé, false si rate limited
 */
export function checkRateLimit(
  storeName: string,
  ip: string,
  max: number,
  windowMs: number = 60 * 60 * 1000
): boolean {
  const now = Date.now();

  if (!stores.has(storeName)) {
    stores.set(storeName, new Map());
  }

  const store = stores.get(storeName)!;

  // Nettoyage périodique (éviter memory leak)
  if (store.size > 10000) {
    for (const [key, val] of store) {
      if (val.resetAt < now) store.delete(key);
    }
  }

  const entry = store.get(ip);

  if (!entry || entry.resetAt < now) {
    store.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= max) {
    return false;
  }

  entry.count++;
  return true;
}

/**
 * Extraire l'IP du client depuis les headers de la requête.
 */
export function getClientIP(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}