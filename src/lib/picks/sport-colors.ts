/**
 * ═══════════════════════════════════════════════════════════════════
 * sport-colors.ts
 * ═══════════════════════════════════════════════════════════════════
 *
 * Helpers neutres pour déterminer les couleurs d'une card selon le
 * sport (gradient de fond + couleur d'accent).
 *
 * Utilisé par :
 * - <PickCard /> (Tipster)
 * - <AiPickCard /> (IA)
 *
 * Peut être conservé tant qu'au moins un des 2 modules existe.
 * Si les 2 modules sont supprimés, ce fichier peut être supprimé.
 * ═══════════════════════════════════════════════════════════════════
 */

export interface PickColors {
  from: string;
  to: string;
  accent: string;
}


export const SPORT_COLORS: Record<string, PickColors> = {
  football: { from: "#0a0a0a", to: "#0a3d23", accent: "#10b981" },
  tennis: { from: "#081828", to: "#124a78", accent: "#38bdf8" },
  basketball: { from: "#0a0a0a", to: "#3d2008", accent: "#f97316" },
  hockey: { from: "#0a0a0a", to: "#08163d", accent: "#3b82f6" },
  rugby: { from: "#0a0a0a", to: "#0a0c3d", accent: "#6366f1" },
  baseball: { from: "#0a0a0a", to: "#3d0a0a", accent: "#ef4444" },
  mma: { from: "#0a0a0a", to: "#3d0a18", accent: "#e11d48" },
  esport: { from: "#0a0a0a", to: "#240a3d", accent: "#a78bfa" },
  // Compatibilité slugs alternatifs
  "football-americain": { from: "#0a0a0a", to: "#3d0a0a", accent: "#ef4444" },
  americanfootball: { from: "#0a0a0a", to: "#3d0a0a", accent: "#ef4444" },
  soccer: { from: "#0a0a0a", to: "#0a3d23", accent: "#10b981" },
};


export const DEFAULT_COLORS: PickColors = {
  from: "#0a0a0a",
  to: "#1a1a1a",
  accent: "#9ca3af",
};


export const COMBI_MIXED_COLORS: PickColors = {
  from: "#0a0a0a",
  to: "#2a0a3d",
  accent: "#c084fc",
};


/**
 * Retourne les couleurs pour une card simple ou combinée.
 * - Card simple → couleurs du sport
 * - Combiné même sport → couleurs du sport
 * - Combiné multi-sports → couleurs neutres violettes (COMBI_MIXED_COLORS)
 */
export function getColorsForSports(
  sportSlugs: string[]
): PickColors {
  if (sportSlugs.length === 0) return DEFAULT_COLORS;
  if (sportSlugs.length === 1) {
    return SPORT_COLORS[sportSlugs[0]] ?? DEFAULT_COLORS;
  }
  // Multiple sports
  const unique = new Set(sportSlugs);
  if (unique.size === 1) {
    return SPORT_COLORS[sportSlugs[0]] ?? DEFAULT_COLORS;
  }
  return COMBI_MIXED_COLORS;
}