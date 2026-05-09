/**
 * PRONOS.CLUB — Format X pour le bilan jour (V3.5)
 *
 * Construit un thread X (4-5 posts) à partir d'un BilanJour.
 *
 * Structure du thread :
 *   Post 1/N : Header + Stats globales (V/D/N + ROI + profit)
 *   Post 2/N : Stats par tier (lock/strong/value/coup_de_coeur)
 *   Post 3/N : CLV moyen + analyse perf
 *   Post 4/N : Lien + disclaimer
 *
 * Si aucune donnée par tier (rare) on fusionne 2 et 3 → thread 3 posts.
 */

import type { BilanJour } from "@/lib/clv/resolve";
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

const X_DISCLAIMER = "🔞 18+ Jouer responsable | 09 74 75 13 13";

// ============================================================================
// HELPERS
// ============================================================================

const formatDateLongFr = (yyyymmdd: string): string => {
  const d = new Date(`${yyyymmdd}T12:00:00Z`);
  return d
    .toLocaleDateString("fr-FR", {
      timeZone: "Europe/Paris",
      weekday: "long",
      day: "numeric",
      month: "long",
    });
};

const truncate = (text: string, maxLen: number): string => {
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen - 3) + "...";
};

// ============================================================================
// THREAD BUILDERS
// ============================================================================

/**
 * Post 1 : Header + Stats globales
 */
const buildHeaderPost = (bilan: BilanJour, totalPosts: number): string => {
  const dateLabel = formatDateLongFr(bilan.date);
  const roiSign = bilan.roi_pct >= 0 ? "+" : "";
  const profitSign = bilan.total_profit_units >= 0 ? "+" : "";
  const roiEmoji = bilan.roi_pct > 0 ? "🟢" : bilan.roi_pct < 0 ? "🔴" : "⚪";

  const lines = [
    `📊 BILAN ${truncate(dateLabel, 30).toUpperCase()} (1/${totalPosts})`,
    "",
    `${roiEmoji} ROI : ${roiSign}${bilan.roi_pct.toFixed(2)}%`,
    `💰 ${profitSign}${bilan.total_profit_units.toFixed(2)}U`,
    `📈 ${bilan.total_picks} picks : ${bilan.picks_won}V / ${bilan.picks_lost}D${bilan.picks_void > 0 ? ` / ${bilan.picks_void}N` : ""}`,
  ];

  return lines.join("\n");
};

/**
 * Post 2 : Stats par tier (uniquement les tiers avec ≥1 pick)
 */
const buildTierPost = (bilan: BilanJour, totalPosts: number): string | null => {
  const tiersOrder: Array<keyof BilanJour["picks_by_tier"]> = [
    "lock",
    "strong",
    "value",
    "coup_de_coeur",
  ];
  const tiersWithPicks = tiersOrder.filter(
    (t) => bilan.picks_by_tier[t].count > 0
  );

  if (tiersWithPicks.length === 0) return null;

  const lines = [`Par catégorie (2/${totalPosts}) :`, ""];

  for (const t of tiersWithPicks) {
    const stats = bilan.picks_by_tier[t];
    const emoji = TIER_EMOJI[t];
    const label = TIER_SHORT_LABEL[t];
    const sign = stats.profit >= 0 ? "+" : "";
    lines.push(
      `${emoji} ${label} : ${stats.won}/${stats.count} (${sign}${stats.profit.toFixed(2)}U)`
    );
  }

  return lines.join("\n");
};

/**
 * Post 3 : CLV moyen + perf snapshot
 * Le CLV est l'argument SEO le plus différenciant — on le met en évidence.
 */
const buildCLVPost = (bilan: BilanJour, postIndex: number, totalPosts: number): string => {
  const lines = [`Edge marché (${postIndex}/${totalPosts}) :`, ""];

  if (bilan.clv_avg_pct !== null && bilan.clv_picks_count > 0) {
    const clvSign = bilan.clv_avg_pct >= 0 ? "+" : "";
    const clvEmoji = bilan.clv_avg_pct > 0 ? "⚡" : "📉";
    lines.push(
      `${clvEmoji} CLV moyen : ${clvSign}${bilan.clv_avg_pct.toFixed(2)}%`
    );
    lines.push(
      `(sur ${bilan.clv_picks_count} pick${bilan.clv_picks_count > 1 ? "s" : ""} avec closing capturé)`
    );
    lines.push("");
    lines.push(
      bilan.clv_avg_pct > 0
        ? "Cotes prises plus hautes que le marché efficient final = edge IA validé 📈"
        : "Cotes prises plus basses que le marché efficient final."
    );
  } else {
    lines.push("⚪ Pas de données CLV ce jour.");
    lines.push("");
    lines.push(
      "Le CLV mesure si nos cotes battent le marché de référence (Pinnacle no-vig)."
    );
  }

  return lines.join("\n");
};

/**
 * Post 4 (final) : Lien + disclaimer
 */
const buildLinkAndDisclaimerPost = (
  bilan: BilanJour,
  bilanLinkUrl: string,
  postIndex: number,
  totalPosts: number
): string => {
  const lines = [
    `Détails complets (${postIndex}/${totalPosts}) :`,
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
 * Construit le thread X complet pour un bilan jour.
 * Retourne un array de textes prêt à passer à postThread().
 */
export const buildBilanJourThreadForX = (bilan: BilanJour): string[] => {
  const SITE_BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://pronos.club";
  const bilanLinkUrl = `${SITE_BASE_URL}/fr/pronos-ia?utm_source=x&utm_medium=social&utm_campaign=ia_bilan_jour_x`;

  const tierPost = buildTierPost(bilan, 4);
  const totalPosts = tierPost ? 4 : 3;

  const posts: string[] = [];
  posts.push(buildHeaderPost(bilan, totalPosts));

  if (tierPost) {
    posts.push(tierPost);
  }

  const clvPostIndex = tierPost ? 3 : 2;
  posts.push(buildCLVPost(bilan, clvPostIndex, totalPosts));

  const linkPostIndex = tierPost ? 4 : 3;
  posts.push(
    buildLinkAndDisclaimerPost(bilan, bilanLinkUrl, linkPostIndex, totalPosts)
  );

  // Validation longueur (anti-paranoia : si un post dépasse 280 on tronque)
  return posts.map((post) => {
    if (post.length > X_MAX_TWEET_LENGTH) {
      console.warn(
        `[x-format-bilan] Post dépasse ${X_MAX_TWEET_LENGTH} chars (${post.length}), troncature`
      );
      return post.substring(0, X_MAX_TWEET_LENGTH - 3) + "...";
    }
    return post;
  });
};