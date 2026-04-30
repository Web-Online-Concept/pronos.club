// src/lib/ai-picks-v2/compute-profit.ts
//
// Helper partage pour calculer le profit d'un pick IA selon son status
// de resolution et sa cote.
//
// Convention : stake fixe = 1U pour les Pronos IA.
// Utilise par /api/admin/ai-picks/resolve (resolution manuelle admin) et
// par resolveV2Picks() dans /api/cron/ai-picks-resolve (cron automatique).

export const STAKE_PER_PICK = 1;

export type ResolutionStatus = "won" | "half_won" | "void" | "half_lost" | "lost";


/**
 * Calcule le profit (en unites) selon le status de resolution et la cote.
 *
 * Convention paris sportifs :
 *   - won      : +(odds - 1) * stake       ex: cote 2.05 -> +1.05U
 *   - half_won : +((odds - 1) / 2) * stake  ex: cote 2.05 -> +0.525U
 *   - void     : 0 (mise remboursee)
 *   - half_lost: -stake / 2                  ex: -0.5U
 *   - lost     : -stake                      ex: -1U
 *
 * @param status Status de resolution
 * @param odds   Cote du pick (peut etre null/undefined en garde-fou)
 * @returns      Profit en unites, arrondi a 3 decimales
 */
export const computeProfit = (
  status: ResolutionStatus,
  odds: number | null | undefined
): number => {
  let raw = 0;

  // Securite : si la cote est manquante ou invalide, on ne peut pas calculer
  // un profit positif. On retourne 0 (won/half_won) ou la perte fixe.
  const validOdds = odds && odds > 1 ? odds : null;

  switch (status) {
    case "won":
      raw = validOdds ? STAKE_PER_PICK * (validOdds - 1) : 0;
      break;
    case "half_won":
      raw = validOdds ? (STAKE_PER_PICK * (validOdds - 1)) / 2 : 0;
      break;
    case "half_lost":
      raw = -STAKE_PER_PICK / 2;
      break;
    case "lost":
      raw = -STAKE_PER_PICK;
      break;
    case "void":
      raw = 0;
      break;
    default:
      raw = 0;
  }

  // Arrondi 3 decimales pour eviter les nombres a 15 decimales en base
  return Math.round(raw * 1000) / 1000;
};