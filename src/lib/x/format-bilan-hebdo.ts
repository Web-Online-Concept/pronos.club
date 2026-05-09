/**
 * PRONOS.CLUB — Format X pour le bilan hebdo (V3.5 - Étape 5)
 *
 * Construit un thread X (5 posts) à partir d'un BilanHebdo.
 *
 * Structure :
 *   Post 1/5 : Header + KPIs principaux (ROI + profit + V/D/N + winrate)
 *   Post 2/5 : Stats par tier (lock/strong/value/coup_de_coeur)
 *   Post 3/5 : Top 3 sports les plus rentables
 *   Post 4/5 : CLV moyen + analyse perf
 *   Post 5/5 : Lien vers la page bilan complète + disclaimer
 */

import type { BilanHebdo } from "@/lib/bilan/hebdo-generator";
import { X_MAX_TWEET_LENGTH } from "./post";

// ============================================================================
// CONSTANTS
// ============================================================================

const TIER_EMOJI: Record<string, string> = {
  lock: "🔒",
  strong: "💪",
  value: "💎",
  coup_de_coeur: "❤️",
};

const TIER_SHORT_LABEL: Record<string, string> = {
  lock: "Lock",
  strong: "Strong",
  value: "Value",
  coup_de_coeur: "CDC",
};

const SPORT_EMOJI_X: Record<string, string> = {
  football: "⚽",
  tennis: "🎾",
  basketball: "🏀",
  hockey: "🏒",
  baseball: "⚾",
  mma: "🥊",
  "football-americain": "🏈",
  rugby: "🏉",
  handball: "🤾",
  "formula-1": "🏎️",
  multi: "🎯",
};

const X_DISCLAIMER = "🔞 18+ Jouer responsable | 09 74 75 13 13";

// ============================================================================
// HELPERS
// ============================================================================

const truncate = (text: string, maxLen: number): string => {
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen - 3) + "...";
};

const capitalize = (s: string): string => {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, " ");
};

// ============================================================================
// THREAD BUILDERS
// ============================================================================

const buildHeaderPost = (bilan: BilanHebdo): string => {
  const roiSign = bilan.roi_pct >= 0 ? "+" : "";
  const profitSign = bilan.total_profit_units >= 0 ? "+" : "";
  const roiEmoji = bilan.roi_pct > 0 ? "🟢" : bilan.roi_pct < 0 ? "🔴" : "⚪";

  const lines = [
    `📊 BILAN HEBDO Semaine ${bilan.week_number} (1/5)`,
    `${truncate(bilan.week_label, 40)}`,
    "",
    `${roiEmoji} ROI : ${roiSign}${bilan.roi_pct.toFixed(2)}%`,
    `💰 ${profitSign}${bilan.total_profit_units.toFixed(2)}U sur ${bilan.total_stake_units.toFixed(0)}U`,
    `🎯 ${bilan.total_picks} picks : ${bilan.picks_won}V/${bilan.picks_lost}D${bilan.picks_void > 0 ? `/${bilan.picks_void}N` : ""}`,
    `Winrate : ${bilan.winrate_pct.toFixed(1)}%`,
  ];

  return lines.join("\n");
};

const buildTierPost = (bilan: BilanHebdo): string => {
  const tiersOrder: Array<keyof BilanHebdo["picks_by_tier"]> = [
    "lock",
    "strong",
    "value",
    "coup_de_coeur",
  ];
  const tiersWithPicks = tiersOrder.filter(
    (t) => (bilan.picks_by_tier[t]?.count ?? 0) > 0
  );

  const lines = [`Par catégorie (2/5) :`, ""];

  if (tiersWithPicks.length === 0) {
    lines.push("Aucune catégorie active cette semaine.");
    return lines.join("\n");
  }

  for (const t of tiersWithPicks) {
    const stats = bilan.picks_by_tier[t];
    const emoji = TIER_EMOJI[t];
    const label = TIER_SHORT_LABEL[t];
    const sign = stats.profit >= 0 ? "+" : "";
    const roiSign = stats.roi_pct >= 0 ? "+" : "";
    lines.push(
      `${emoji} ${label}: ${stats.won}/${stats.count} (${sign}${stats.profit.toFixed(2)}U, ROI ${roiSign}${stats.roi_pct.toFixed(1)}%)`
    );
  }

  return lines.join("\n");
};

const buildSportPost = (bilan: BilanHebdo): string => {
  const sportsArr = Object.entries(bilan.picks_by_sport)
    .filter(([, s]) => s.count > 0)
    .sort((a, b) => b[1].profit - a[1].profit)
    .slice(0, 4);

  const lines = [`Top sports rentables (3/5) :`, ""];

  if (sportsArr.length === 0) {
    lines.push("Pas de données sport cette semaine.");
    return lines.join("\n");
  }

  for (const [sport, stats] of sportsArr) {
    const emoji = SPORT_EMOJI_X[sport] ?? "🎯";
    const label = capitalize(sport);
    const sign = stats.profit >= 0 ? "+" : "";
    lines.push(`${emoji} ${label}: ${stats.won}/${stats.count} (${sign}${stats.profit.toFixed(2)}U)`);
  }

  return lines.join("\n");
};

const buildCLVPost = (bilan: BilanHebdo): string => {
  const lines = [`Edge marché (4/5) :`, ""];

  if (bilan.clv_avg_pct !== null && bilan.clv_picks_count > 0) {
    const clvSign = bilan.clv_avg_pct >= 0 ? "+" : "";
    const clvEmoji = bilan.clv_avg_pct > 0 ? "⚡" : "📉";
    lines.push(`${clvEmoji} CLV moyen : ${clvSign}${bilan.clv_avg_pct.toFixed(2)}%`);
    lines.push(`Sur ${bilan.clv_picks_count} pick${bilan.clv_picks_count > 1 ? "s" : ""} avec closing capturé`);
    lines.push("");
    lines.push(
      bilan.clv_avg_pct > 0
        ? "Cotes prises plus hautes que le marché efficient final = edge IA validé 📈"
        : "Cotes prises plus basses que le marché efficient final."
    );
  } else {
    lines.push("⚪ Pas de données CLV cette semaine.");
    lines.push("");
    lines.push("Le CLV mesure si nos cotes battent le marché de référence (Pinnacle no-vig).");
  }

  return lines.join("\n");
};

const buildLinkPost = (bilan: BilanHebdo, bilanLinkUrl: string): string => {
  const lines = [
    `Bilan complet + graphiques (5/5) :`,
    "",
    `🔗 ${bilanLinkUrl}`,
    "",
    X_DISCLAIMER,
  ];
  return lines.join("\n");
};

// ============================================================================
// MAIN
// ============================================================================

/**
 * Construit le thread X complet pour un bilan hebdo.
 * Retourne un array de 5 textes prêts à passer à postThread().
 */
export const buildBilanHebdoThreadForX = (bilan: BilanHebdo): string[] => {
  const SITE_BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://pronos.club";
  const bilanLinkUrl = `${SITE_BASE_URL}/fr/pronos-ia/bilan-hebdo/${bilan.week_slug}?utm_source=x&utm_medium=social&utm_campaign=ia_bilan_hebdo_x`;

  const posts: string[] = [
    buildHeaderPost(bilan),
    buildTierPost(bilan),
    buildSportPost(bilan),
    buildCLVPost(bilan),
    buildLinkPost(bilan, bilanLinkUrl),
  ];

  // Validation longueur (anti-paranoia)
  return posts.map((post) => {
    if (post.length > X_MAX_TWEET_LENGTH) {
      console.warn(
        `[x-format-bilan-hebdo] Post dépasse ${X_MAX_TWEET_LENGTH} chars (${post.length}), troncature`
      );
      return post.substring(0, X_MAX_TWEET_LENGTH - 3) + "...";
    }
    return post;
  });
};