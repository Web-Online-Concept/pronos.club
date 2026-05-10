/**
 * ═══════════════════════════════════════════════════════════════════
 * api-cache.ts (V3.5 Lot 15 — cache des appels API externes)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Helper de cache via Supabase pour réduire les appels API externes
 * (API-Football, ESPN, etc.) lors des drops Pronos IA.
 *
 * Usage :
 *   const data = await getCachedOrFetch(
 *     "standings:ligue-1:2024",
 *     CACHE_TTL.STANDINGS,
 *     () => fetchStandingsFromApi(...)
 *   );
 *
 * Stratégie :
 *   - Cache HIT (non expiré) : retour instantané, pas d'appel API
 *   - Cache MISS ou expiré : fetcher() puis upsert en BDD
 *   - Erreur fetch : pas de cache écrit, l'erreur remonte
 *   - Erreur cache (read/write) : on n'échoue jamais, on tente le fetch direct
 *
 * Path : src/lib/ai-picks-v3/api-cache.ts
 * ═══════════════════════════════════════════════════════════════════
 */

import { createClient as createAdminClient } from "@supabase/supabase-js";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ─── TTL constants (en secondes) ──────────────────────────────────
export const CACHE_TTL = {
  STANDINGS: 6 * 3600,      // classements ligue : 6h
  TEAM_STATS: 12 * 3600,    // stats équipes : 12h
  H2H: 24 * 3600,           // face à face : 24h
  INJURIES: 1 * 3600,       // blessures : 1h
  LEAGUE_RESOLVER: 24 * 3600, // résolution ligues : 24h
  TENNIS_INDEX: 6 * 3600,   // index tennis : 6h
  TEAM_FORM: 6 * 3600,      // forme équipe : 6h
  TOP_SCORERS: 24 * 3600,   // top buteurs : 24h
} as const;

// ─── Types ────────────────────────────────────────────────────────
type CacheRow = {
  cache_key: string;
  data: unknown;
  expires_at: string;
};

// ─── Stats globales (pour logs perf) ──────────────────────────────
let stats = { hits: 0, misses: 0, writes: 0, errors: 0 };

export function getCacheStats() {
  return { ...stats };
}

export function resetCacheStats() {
  stats = { hits: 0, misses: 0, writes: 0, errors: 0 };
}

// ─── Get + Fetch + Cache ──────────────────────────────────────────
/**
 * Récupère une valeur depuis le cache, ou fetch si miss/expiré.
 *
 * @param key Clé unique (format "namespace:id" recommandé)
 * @param ttlSeconds Durée de vie du cache en secondes
 * @param fetcher Fonction qui retourne la donnée fraîche
 */
export async function getCachedOrFetch<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  // 1. Tenter de lire le cache
  try {
    const { data: row, error } = await supabaseAdmin
      .from("api_cache")
      .select("cache_key, data, expires_at")
      .eq("cache_key", key)
      .maybeSingle();

    if (!error && row) {
      const expires = new Date((row as CacheRow).expires_at).getTime();
      if (expires > Date.now()) {
        // Cache HIT
        stats.hits++;
        return (row as CacheRow).data as T;
      }
      // Expiré → on continue vers fetch
    }
  } catch {
    stats.errors++;
    // En cas d'erreur cache, on continue vers fetch (resilience)
  }

  // 2. Cache MISS ou expiré → fetcher
  stats.misses++;
  const fresh = await fetcher();

  // 3. Écrire en cache (best-effort, pas critique)
  try {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    await supabaseAdmin.from("api_cache").upsert(
      {
        cache_key: key,
        data: fresh as unknown,
        expires_at: expiresAt,
      },
      { onConflict: "cache_key" },
    );
    stats.writes++;
  } catch {
    stats.errors++;
    // On a la donnée fraîche, on n'échoue pas si l'écriture cache foire
  }

  return fresh;
}

// ─── Invalidation manuelle (pour debug) ───────────────────────────
export async function invalidateCacheKey(key: string): Promise<void> {
  try {
    await supabaseAdmin.from("api_cache").delete().eq("cache_key", key);
  } catch {
    // Silent fail
  }
}

export async function invalidateCachePrefix(prefix: string): Promise<number> {
  try {
    const { count } = await supabaseAdmin
      .from("api_cache")
      .delete({ count: "exact" })
      .like("cache_key", `${prefix}%`);
    return count ?? 0;
  } catch {
    return 0;
  }
}