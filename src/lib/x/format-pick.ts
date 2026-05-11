/**
 * PRONOS.CLUB — Format X pour les picks (V3.5)
 *
 * Formate un pick au format X (Twitter) : 280 caractères max, lien shortlink,
 * disclaimer ANJ obligatoire.
 *
 * Filtrage Q8-A : seuls les picks tier=lock ou tier=strong sont publiés sur X.
 * Cette filtre est appliqué dans publish-batch.ts (caller).
 *
 * Format type :
 *   🤖 PRONO IA n°79 PRONOS CLUB
 *   🔒 LOCK 🎾 ATP Madrid
 *   Sinner vs Alcaraz (21:30)
 *   ✅ Sinner gagne le match @ 1.85
 *   💡 Forme YTD 35-2 sur clay vs 28-5
 *   🔗 https://pronos.club/r/x7k2m
 *   🔞 18+ Jouer responsable | 09 74 75 13 13
 *
 * Total : ~278 chars + URL (23 chars sur X t.co).
 * Note : si dépassement, l'argument 💡 est tronqué pour rester ≤ 280 chars.
 */

import { createPickShortLink } from "@/lib/shortlinks/create";
import { X_MAX_TWEET_LENGTH } from "./post";

// ============================================================================
// TYPES
// ============================================================================

export type PickForX = {
  id: string;
  slug: string;
  sport: string;
  league: string;
  event_name: string;
  event_date: string;
  selection: string;
  market: string;
  odds: number;
  reasoning: string;
  tier: string | null;
  drop_window: string | null;
  ai_pick_number: number | null;
  /**
   * Label complet du pick (ex: "IA-0005", "BUT-0001").
   * Si fourni, est utilisé en priorité sur ai_pick_number pour l'affichage.
   * Construit via buildAiPickLabel() de adapt-ai-pick.ts.
   */
  pick_label: string | null;
};

export type FormattedXPick = {
  text: string;
  shortUrl: string;
  pick_id: string;
};

// ============================================================================
// CONSTANTS
// ============================================================================

/** Émojis sport pour X */
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

/** Labels tier (sans label "COUP DE CŒUR" trop long pour X, mais filtré upstream) */
const TIER_LABEL_X: Record<string, string> = {
  lock: "🔒 LOCK",
  strong: "💪 STRONG",
  value: "💎 VALUE",
  coup_de_coeur: "❤️ CDC",
};

/** Disclaimer ANJ minimal pour X (compact) */
const X_DISCLAIMER = "🔞 18+ Jouer responsable | 09 74 75 13 13";

/** Longueur estimée d'une URL X (t.co shortener uniformise à 23 chars) */
const X_URL_LENGTH = 23;

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Tronque un texte à N caractères en ajoutant "..." si nécessaire.
 */
const truncate = (text: string, maxLen: number): string => {
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen - 3) + "...";
};

/**
 * Formate l'heure Paris HH:mm depuis ISO.
 */
const formatTimeParis = (iso: string): string => {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/**
 * Récupère le 1er argument du reasoning (séparateur " • ").
 */
const getFirstArgument = (reasoning: string): string => {
  if (!reasoning) return "";
  const parts = reasoning.split(" • ");
  return (parts[0] ?? "").trim();
};

/**
 * Construit un titre court pour le match (X privilégie la concision).
 */
const buildShortMatchTitle = (eventName: string): string => {
  // Si " vs " présent, on garde tel quel jusqu'à 35 chars
  // Si " - " présent, on convertit en " vs "
  const titleRaw = eventName.replace(" - ", " vs ");
  return truncate(titleRaw, 50);
};

// ============================================================================
// FORMATTING
// ============================================================================

/**
 * Formate un pick au format X (single tweet).
 *
 * Strategy budget caractères :
 *   Header (tier + sport + league)         : ~30 chars
 *   Match title + heure                    : ~55 chars
 *   Sélection + cote                       : ~40 chars
 *   Argument clé                           : ~80 chars (variable, on tronque)
 *   Lien (uniformisé t.co)                 : 23 chars
 *   Disclaimer                             : ~45 chars
 *   Sauts de ligne (5)                     : ~5 chars
 *   ─────────────────────────────────────────
 *   Total cible                            : ~278 chars
 */
export const formatPickForX = async (
  pick: PickForX
): Promise<FormattedXPick> => {
  const sportEmoji = SPORT_EMOJI_X[pick.sport] ?? "🎯";
  const tierLabel = pick.tier ? TIER_LABEL_X[pick.tier] : "";

  // ─── 0. Ligne d'identification IA + label pick + branding
  // Format : "🤖 PRONO IA-0005 PRONOS CLUB" ou "🤖 PRONO BUT-0001 PRONOS CLUB" (~32 chars)
  // Priorité : pick_label (IA-XXXX / BUT-XXXX) > ai_pick_number (fallback) > générique
  const aiBrandLine = pick.pick_label
    ? `🤖 PRONO ${pick.pick_label} PRONOS CLUB`
    : pick.ai_pick_number != null
      ? `🤖 PRONO IA n°${pick.ai_pick_number} PRONOS CLUB`
      : `🤖 PRONO IA PRONOS CLUB`;

  // ─── 1. Header (tier + sport + league)
  const leagueShort = truncate(pick.league, 25);
  const header = tierLabel
    ? `${tierLabel} ${sportEmoji} ${leagueShort}`
    : `${sportEmoji} ${leagueShort}`;

  // ─── 2. Match + heure
  const matchTitle = buildShortMatchTitle(pick.event_name);
  const time = formatTimeParis(pick.event_date);
  const matchLine = `${matchTitle} (${time})`;

  // ─── 3. Sélection + cote
  const selectionLine = `🎯 ${truncate(pick.selection, 35)} @ ${pick.odds.toFixed(2)}`;

  // ─── 4. Shortlink (créé en BDD, retourne URL t.co-friendly)
  const shortLinkResult = await createPickShortLink({
    pickSlug: pick.slug,
    locale: "fr",
    source: "x_pick",
    utmCampaign: pick.drop_window === "evening" ? "ia_pick_x_evening" : "ia_pick_x_morning",
  });
  const linkLine = `🔗 ${shortLinkResult.shortUrl}`;

  // ─── 5. Argument clé (rempli avec ce qui reste comme budget)
  // On calcule combien de chars restent disponibles
  // Note : aiBrandLine ajoute ~30 chars vs version précédente, donc l'argument
  // sera tronqué un peu plus court qu'avant (acceptable, l'argument est variable).
  const fixedParts = [aiBrandLine, header, matchLine, selectionLine, linkLine, X_DISCLAIMER];
  const fixedLength = fixedParts.join("\n").length;

  // X compte les URLs comme 23 chars indépendamment de leur longueur réelle
  // On corrige le calcul : remplace shortLink réel par 23 chars factice
  const realShortLinkLength = shortLinkResult.shortUrl.length;
  const adjustedFixedLength = fixedLength - realShortLinkLength + X_URL_LENGTH;

  // Reste pour l'argument (on garde 5 chars de buffer)
  const remainingForArg = X_MAX_TWEET_LENGTH - adjustedFixedLength - 8; // -8 pour "💡 " + saut de ligne

  const firstArg = getFirstArgument(pick.reasoning);
  const argLine = firstArg && remainingForArg > 30
    ? `💡 ${truncate(firstArg, remainingForArg)}`
    : "";

  // ─── 6. Assemblage final (avec aiBrandLine en première position)
  const lines = [aiBrandLine, header, matchLine, selectionLine];
  if (argLine) lines.push(argLine);
  lines.push(linkLine);
  lines.push(X_DISCLAIMER);

  const text = lines.join("\n");

  return {
    text,
    shortUrl: shortLinkResult.shortUrl,
    pick_id: pick.id,
  };
};

/**
 * Filtre : ce pick doit-il être publié sur X ?
 * Q8-A : uniquement tier=lock ou tier=strong.
 */
export const shouldPublishPickToX = (pick: { tier: string | null }): boolean => {
  return pick.tier === "lock" || pick.tier === "strong";
};