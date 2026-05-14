// src/lib/over-05-buts-equipes/season-helper.ts
//
// Helper pour determiner la saison API-Football en cours.
// (Extrait minimal de l'ancien compute-intrinsics.ts qui a ete supprime.)

/**
 * Determine la saison API-Football actuelle.
 * Format API-Football : annee de demarrage (saison 2025-2026 = 2025).
 * Bascule en juillet (mois 7) sur la nouvelle saison.
 *
 * Exemples :
 *   - Si on est en mai 2026   -> saison 2025 (= 2025-2026)
 *   - Si on est en juillet 2026 -> saison 2026 (= 2026-2027)
 *   - Si on est en decembre 2026 -> saison 2026 (= 2026-2027)
 */
export const getCurrentApiFootballSeason = (): number => {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const year = now.getFullYear();
  return month >= 7 ? year : year - 1;
};