/**
 * PRONOS.CLUB — Telegram Public Channel Publisher V3.5 (mise à jour Étape 5)
 *
 * Mise à jour du fichier existant src/lib/telegram/public-channel.ts pour
 * implémenter la fonction publishHebdoBilanToPublicChannel() qui était
 * un stub à l'Étape 3.
 *
 * Cette mise à jour AJOUTE la fonction publishHebdoBilanToPublicChannel
 * et conserve les 2 autres fonctions exportées (publishPickToPublicChannel,
 * publishResultsBilanToPublicChannel) STRICTEMENT IDENTIQUES.
 *
 * Path destination : src/lib/telegram/public-channel.ts (REMPLACE)
 */

import { supabaseAdmin } from "@/lib/supabase/admin";
import { createPickShortLink } from "@/lib/shortlinks/create";
import type { BilanJour } from "@/lib/clv/resolve";
import type { BilanHebdo } from "@/lib/bilan/hebdo-generator";
import type { BilanMensuel } from "@/lib/bilan/mensuel-generator";

// ============================================================================
// CONFIGURATION
// ============================================================================

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_IA_BOT_TOKEN ?? "";
const TELEGRAM_CHANNEL_ID = process.env.TELEGRAM_IA_CHANNEL_ID ?? "";
const SITE_BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://pronos.club";

const TELEGRAM_API_BASE = "https://api.telegram.org";

// ============================================================================
// TYPES
// ============================================================================

export type PublishResult = {
  success: boolean;
  message_id?: number;
  error?: string;
};

type PickRow = {
  id: string;
  slug: string;
  sport: string;
  league: string;
  event_name: string;
  event_date: string;
  selection: string;
  market: string;
  odds: number;
  odds_bookmaker: string;
  reasoning: string;
  ai_confidence: number;
  tier: string | null;
  drop_window: string | null;
  classic_number: number | null;
  ai_pick_number: number | null;
  odds_comparison: Record<string, unknown> | null;
};

type TelegramSendMessageResponse = {
  ok: boolean;
  result?: { message_id: number };
  description?: string;
  error_code?: number;
};

// ============================================================================
// CONSTANTS - Affichage
// ============================================================================

/**
 * Génère le label affiché du pick (ex: "IA-0005").
 * Utilise classic_number en priorité (cohérent avec le site / AiPickCard).
 * Fallback sur ai_pick_number si classic_number absent (cas v1/v2 legacy).
 *
 * Cohérent avec buildAiPickLabel() de lib/ai-picks-v2/adapt-ai-pick.ts.
 */
const formatPickLabel = (
  classicNumber: number | null,
  aiPickNumber: number | null
): string | null => {
  const num = classicNumber ?? aiPickNumber;
  if (num == null) return null;
  return `IA-${String(num).padStart(4, "0")}`;
};

const SPORT_EMOJI: Record<string, string> = {
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

const TIER_DISPLAY: Record<string, { emoji: string; label: string }> = {
  lock: { emoji: "🔒", label: "LOCK" },
  strong: { emoji: "💪", label: "STRONG" },
  value: { emoji: "💎", label: "VALUE" },
  coup_de_coeur: { emoji: "❤️", label: "COUP DE CŒUR" },
};

const DISCLAIMER_BLOCK = `🔞 <i>Jouer comporte des risques : endettement, dépendance.\nAppelez le 09 74 75 13 13 (appel non surtaxé). joueurs-info-service.fr</i>`;

// ============================================================================
// HELPERS
// ============================================================================

const escapeHtml = (text: string): string => {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
};

const formatDateTimeParis = (iso: string): string => {
  return new Date(iso)
    .toLocaleString("fr-FR", {
      timeZone: "Europe/Paris",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
    .replace(",", "");
};

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

const getDisplayMatchTitle = (pick: PickRow): string => {
  if (pick.market === "COMBINE") {
    const oc = pick.odds_comparison ?? {};
    const meta = oc.combine_meta as { selections?: Array<{ match: string }> } | undefined;
    if (meta?.selections && meta.selections.length > 0) {
      return meta.selections.map((s) => s.match).join(" + ");
    }
    return pick.event_name;
  }
  return pick.event_name;
};

const getFirstArgument = (reasoning: string): string => {
  if (!reasoning) return "";
  const parts = reasoning.split(" • ");
  return (parts[0] ?? "").trim();
};

const telegramSendMessage = async (
  text: string,
  parseMode: "HTML" | "Markdown" = "HTML",
  disablePreview = false
): Promise<PublishResult> => {
  if (!TELEGRAM_BOT_TOKEN) {
    return { success: false, error: "TELEGRAM_IA_BOT_TOKEN not set" };
  }
  if (!TELEGRAM_CHANNEL_ID) {
    return { success: false, error: "TELEGRAM_IA_CHANNEL_ID not set" };
  }

  const url = `${TELEGRAM_API_BASE}/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  const chatIdRaw = TELEGRAM_CHANNEL_ID.trim();
  const chatIdAsNum = Number(chatIdRaw);
  const chatId: string | number =
    !isNaN(chatIdAsNum) && chatIdRaw.startsWith("-") ? chatIdAsNum : chatIdRaw;

  const body = {
    chat_id: chatId,
    text,
    parse_mode: parseMode,
    disable_web_page_preview: disablePreview,
  };

  const MAX_RETRIES = 2;
  let lastError = "";

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = (await response.json()) as TelegramSendMessageResponse;

      if (data.ok && data.result) {
        return { success: true, message_id: data.result.message_id };
      }

      lastError = data.description ?? `HTTP ${response.status}`;

      if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
          continue;
        }
      }
      return { success: false, error: lastError };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
    }
  }

  return { success: false, error: lastError };
};

// ============================================================================
// FORMAT 1 : POST D'UN PICK (inchangé depuis Étape 3)
// ============================================================================

const formatPickMessage = (pick: PickRow, shortUrl: string): string => {
  const tierInfo = pick.tier ? TIER_DISPLAY[pick.tier] : null;
  const sportEmoji = SPORT_EMOJI[pick.sport] ?? "🎯";
  const matchTitle = escapeHtml(getDisplayMatchTitle(pick));
  const selection = escapeHtml(pick.selection);
  const league = escapeHtml(pick.league);
  const firstArg = escapeHtml(getFirstArgument(pick.reasoning));
  const kickoff = formatDateTimeParis(pick.event_date);

  const header = tierInfo
    ? `${tierInfo.emoji} <b>${tierInfo.label}</b> ${sportEmoji} ${league}`
    : `${sportEmoji} ${league}`;

  const bookLabel = pick.odds_bookmaker
    ? ` <i>(${escapeHtml(pick.odds_bookmaker)})</i>`
    : "";

  // Ligne d'identification IA + numéro pick + branding
  // Format : "🤖 PRONO IA-0005 PRONOS CLUB" (basé sur classic_number → cohérent avec le site)
  const pickLabel = formatPickLabel(pick.classic_number, pick.ai_pick_number);
  const aiBrandLine = pickLabel
    ? `🤖 <b>PRONO ${pickLabel} PRONOS CLUB</b>`
    : `🤖 <b>PRONO IA PRONOS CLUB</b>`;

  const lines = [
    aiBrandLine,
    header,
    "",
    `<b>${matchTitle}</b>`,
    `📅 ${kickoff}`,
    "",
    `🎯 <b>${selection}</b> @ <b>${pick.odds.toFixed(2)}</b>${bookLabel}`,
  ];

  if (firstArg) {
    lines.push("");
    lines.push(`💡 ${firstArg}`);
  }

  lines.push("");
  lines.push(`📊 Analyse complète : ${shortUrl}`);
  lines.push("");
  lines.push(DISCLAIMER_BLOCK);

  return lines.join("\n");
};

export const publishPickToPublicChannel = async (
  pickId: string
): Promise<PublishResult> => {
  const { data: pick, error: fetchError } = await supabaseAdmin
    .from("ai_picks")
    .select(
      "id, slug, sport, league, event_name, event_date, selection, market, odds, odds_bookmaker, reasoning, ai_confidence, tier, drop_window, classic_number, ai_pick_number, odds_comparison"
    )
    .eq("id", pickId)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchError) {
    return { success: false, error: `Fetch pick failed: ${fetchError.message}` };
  }

  if (!pick) {
    return { success: false, error: `Pick ${pickId} introuvable` };
  }

  const typedPick = pick as PickRow;

  if (!typedPick.slug) {
    return {
      success: false,
      error: `Pick ${pickId} sans slug, impossible de créer le shortlink`,
    };
  }

  let shortUrl: string;
  try {
    const utmCampaign =
      typedPick.drop_window === "evening" ? "ia_pick_evening" : "ia_pick_morning";
    const result = await createPickShortLink({
      pickSlug: typedPick.slug,
      locale: "fr",
      source: "telegram_pick",
      utmCampaign,
    });
    shortUrl = result.shortUrl;
  } catch (err) {
    return {
      success: false,
      error: `createShortLink failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const message = formatPickMessage(typedPick, shortUrl);
  const result = await telegramSendMessage(message, "HTML", false);

  if (result.success) {
    console.log(
      `[telegram] Pick ${pickId} (${typedPick.slug}) publié, message_id=${result.message_id}`
    );
  } else {
    console.warn(`[telegram] Pick ${pickId} échec publication: ${result.error}`);
  }

  return result;
};

// ============================================================================
// FORMAT 2 : POST DU BILAN JOUR (inchangé depuis Étape 3)
// ============================================================================

const formatBilanJourMessage = (bilan: BilanJour, bilanLinkUrl: string): string => {
  const dateLabel = formatDateLongFr(bilan.date);
  const roiSign = bilan.roi_pct >= 0 ? "+" : "";
  const profitSign = bilan.total_profit_units >= 0 ? "+" : "";
  const roiEmoji = bilan.roi_pct > 0 ? "🟢" : bilan.roi_pct < 0 ? "🔴" : "⚪";

  const lines: string[] = [];
  lines.push(`📊 <b>BILAN ${dateLabel.toUpperCase()}</b>`);
  lines.push("");
  lines.push(`${roiEmoji} <b>ROI : ${roiSign}${bilan.roi_pct.toFixed(2)}%</b>`);
  lines.push(`💰 Profit : ${profitSign}${bilan.total_profit_units.toFixed(2)}U`);
  lines.push(
    `📈 ${bilan.total_picks} picks : ${bilan.picks_won}V / ${bilan.picks_lost}D${bilan.picks_void > 0 ? ` / ${bilan.picks_void} annulé(s)` : ""}`
  );

  if (bilan.clv_avg_pct !== null && bilan.clv_picks_count > 0) {
    const clvSign = bilan.clv_avg_pct >= 0 ? "+" : "";
    lines.push(
      `⚡ CLV moyen : ${clvSign}${bilan.clv_avg_pct.toFixed(2)}% (sur ${bilan.clv_picks_count} pick${bilan.clv_picks_count > 1 ? "s" : ""})`
    );
  }

  const tiersWithPicks = (
    ["lock", "strong", "value", "coup_de_coeur"] as const
  ).filter((t) => bilan.picks_by_tier[t].count > 0);

  if (tiersWithPicks.length > 0) {
    lines.push("");
    lines.push("<b>Par catégorie :</b>");
    for (const t of tiersWithPicks) {
      const stats = bilan.picks_by_tier[t];
      const tierInfo = TIER_DISPLAY[t];
      const sign = stats.profit >= 0 ? "+" : "";
      lines.push(
        `${tierInfo.emoji} ${tierInfo.label} : ${stats.won}/${stats.count} (${sign}${stats.profit.toFixed(2)}U)`
      );
    }
  }

  const MAX_PICKS_DETAIL = 12;
  const picksToShow = bilan.picks.slice(0, MAX_PICKS_DETAIL);
  if (picksToShow.length > 0) {
    lines.push("");
    lines.push("<b>Détail :</b>");
    for (const pickEntry of picksToShow) {
      const statusEmoji =
        pickEntry.status === "won" ? "✅" : pickEntry.status === "lost" ? "❌" : "➖";
      const sportEmoji = SPORT_EMOJI[pickEntry.sport] ?? "🎯";
      const eventShort = escapeHtml(
        pickEntry.event_name.length > 35
          ? pickEntry.event_name.substring(0, 32) + "..."
          : pickEntry.event_name
      );
      const selectionShort = escapeHtml(
        pickEntry.selection.length > 30
          ? pickEntry.selection.substring(0, 27) + "..."
          : pickEntry.selection
      );
      const scoreLabel = pickEntry.final_score
        ? ` <i>(${escapeHtml(pickEntry.final_score)})</i>`
        : "";
      // Préfixe IA-XXXX (cohérent avec site + Telegram pick individuel)
      const pickLabel = formatPickLabel(pickEntry.classic_number, null);
      const labelPrefix = pickLabel ? `<b>${pickLabel}</b> · ` : "";
      lines.push(
        `${statusEmoji} ${sportEmoji} ${labelPrefix}${eventShort} — ${selectionShort} @ ${pickEntry.odds.toFixed(2)}${scoreLabel}`
      );
    }
    if (bilan.picks.length > MAX_PICKS_DETAIL) {
      lines.push(
        `<i>...et ${bilan.picks.length - MAX_PICKS_DETAIL} autre${bilan.picks.length - MAX_PICKS_DETAIL > 1 ? "s" : ""}</i>`
      );
    }
  }

  lines.push("");
  lines.push(`📊 Tous les détails : ${bilanLinkUrl}`);
  lines.push("");
  lines.push(DISCLAIMER_BLOCK);

  return lines.join("\n");
};

export const publishResultsBilanToPublicChannel = async (
  bilan: BilanJour
): Promise<PublishResult> => {
  const bilanLinkUrl = `${SITE_BASE_URL}/fr/pronos-ia?utm_source=telegram&utm_medium=channel&utm_campaign=ia_bilan_jour`;
  const message = formatBilanJourMessage(bilan, bilanLinkUrl);
  const result = await telegramSendMessage(message, "HTML", false);

  if (result.success) {
    console.log(
      `[telegram] Bilan ${bilan.date} publié, message_id=${result.message_id}`
    );
  } else {
    console.warn(`[telegram] Bilan ${bilan.date} échec publication: ${result.error}`);
  }

  return result;
};

// ============================================================================
// FORMAT 3 : POST DU BILAN HEBDO (NOUVEAU - Étape 5)
// ============================================================================

/**
 * Formate le bilan hebdo au format HTML pour Telegram public.
 * Plus condensé que le bilan jour : on évite la liste détaillée des picks
 * (mise sur la page web) et on met l'accent sur les KPIs synthétiques.
 */
const formatBilanHebdoMessage = (
  bilan: BilanHebdo,
  bilanLinkUrl: string
): string => {
  const roiSign = bilan.roi_pct >= 0 ? "+" : "";
  const profitSign = bilan.total_profit_units >= 0 ? "+" : "";
  const roiEmoji = bilan.roi_pct > 0 ? "🟢" : bilan.roi_pct < 0 ? "🔴" : "⚪";

  const lines: string[] = [];

  // Header
  lines.push(`📊 <b>BILAN HEBDO — Semaine ${bilan.week_number}</b>`);
  lines.push(`<i>${bilan.week_label}</i>`);
  lines.push("");

  // Stats principales
  lines.push(`${roiEmoji} <b>ROI : ${roiSign}${bilan.roi_pct.toFixed(2)}%</b>`);
  lines.push(`💰 Profit : ${profitSign}${bilan.total_profit_units.toFixed(2)}U sur ${bilan.total_stake_units.toFixed(0)}U misés`);
  lines.push(
    `🎯 <b>${bilan.total_picks} picks</b> : ${bilan.picks_won}V / ${bilan.picks_lost}D${bilan.picks_void > 0 ? ` / ${bilan.picks_void}N` : ""} (winrate ${bilan.winrate_pct.toFixed(1)}%)`
  );

  // CLV moyen
  if (bilan.clv_avg_pct !== null && bilan.clv_picks_count > 0) {
    const clvSign = bilan.clv_avg_pct >= 0 ? "+" : "";
    const clvEmoji = bilan.clv_avg_pct > 0 ? "⚡" : "📉";
    lines.push(`${clvEmoji} CLV moyen : ${clvSign}${bilan.clv_avg_pct.toFixed(2)}% (${bilan.clv_picks_count} picks)`);
  }

  // Stats par tier
  const tiersWithPicks = (["lock", "strong", "value", "coup_de_coeur"] as const).filter(
    (t) => bilan.picks_by_tier[t]?.count > 0
  );
  if (tiersWithPicks.length > 0) {
    lines.push("");
    lines.push("<b>📈 Par catégorie :</b>");
    for (const t of tiersWithPicks) {
      const stats = bilan.picks_by_tier[t];
      const tierInfo = TIER_DISPLAY[t];
      const sign = stats.profit >= 0 ? "+" : "";
      const roiSign2 = stats.roi_pct >= 0 ? "+" : "";
      lines.push(
        `${tierInfo.emoji} ${tierInfo.label} : ${stats.won}/${stats.count} (${sign}${stats.profit.toFixed(2)}U, ROI ${roiSign2}${stats.roi_pct.toFixed(1)}%)`
      );
    }
  }

  // Stats top 5 sports (les plus rentables)
  const sportsArr = Object.entries(bilan.picks_by_sport)
    .filter(([, s]) => s.count > 0)
    .sort((a, b) => b[1].profit - a[1].profit)
    .slice(0, 5);

  if (sportsArr.length > 0) {
    lines.push("");
    lines.push("<b>🏆 Par sport :</b>");
    for (const [sport, stats] of sportsArr) {
      const sportEmoji = SPORT_EMOJI[sport] ?? "🎯";
      const sign = stats.profit >= 0 ? "+" : "";
      const sportLabel = sport.charAt(0).toUpperCase() + sport.slice(1).replace("-", " ");
      lines.push(
        `${sportEmoji} ${sportLabel} : ${stats.won}/${stats.count} (${sign}${stats.profit.toFixed(2)}U)`
      );
    }
  }

  // CTA
  lines.push("");
  lines.push(`📊 <b>Bilan complet + graphiques :</b>`);
  lines.push(`👉 ${bilanLinkUrl}`);
  lines.push("");
  lines.push(DISCLAIMER_BLOCK);

  return lines.join("\n");
};

/**
 * Publie le bilan hebdo sur le canal Telegram public.
 *
 * @param bilan le BilanHebdo agrégé via aggregateBilanHebdo()
 * @returns PublishResult
 */
export const publishHebdoBilanToPublicChannel = async (
  bilan: BilanHebdo
): Promise<PublishResult> => {
  const bilanLinkUrl = `${SITE_BASE_URL}/fr/pronos-ia/bilan-hebdo/${bilan.week_slug}?utm_source=telegram&utm_medium=channel&utm_campaign=ia_bilan_hebdo`;

  const message = formatBilanHebdoMessage(bilan, bilanLinkUrl);
  const result = await telegramSendMessage(message, "HTML", false);

  if (result.success) {
    console.log(
      `[telegram] Bilan hebdo ${bilan.week_slug} publié, message_id=${result.message_id}`
    );
  } else {
    console.warn(
      `[telegram] Bilan hebdo ${bilan.week_slug} échec publication: ${result.error}`
    );
  }

  return result;
};

// ============================================================================
// FORMAT 5 : POST DU BILAN MENSUEL (Lot 11 V3.5)
// ============================================================================

/**
 * Formate le bilan mensuel au format HTML pour Telegram public.
 * Structure proche du bilan hebdo : KPIs synthétiques + breakdown tier + sport,
 * avec lien vers la page web pour le détail complet.
 */
const formatBilanMensuelMessage = (
  bilan: BilanMensuel,
  bilanLinkUrl: string
): string => {
  const roiSign = bilan.roi_pct >= 0 ? "+" : "";
  const profitSign = bilan.total_profit_units >= 0 ? "+" : "";
  const roiEmoji = bilan.roi_pct > 0 ? "🟢" : bilan.roi_pct < 0 ? "🔴" : "⚪";

  const lines: string[] = [];

  // Header
  lines.push(`📊 <b>BILAN MENSUEL — ${bilan.month_label}</b>`);
  lines.push("");

  // Stats principales
  lines.push(`${roiEmoji} <b>ROI : ${roiSign}${bilan.roi_pct.toFixed(2)}%</b>`);
  lines.push(`💰 Profit : ${profitSign}${bilan.total_profit_units.toFixed(2)}U sur ${bilan.total_stake_units.toFixed(0)}U misés`);
  lines.push(
    `🎯 <b>${bilan.total_picks} picks</b> : ${bilan.picks_won}V / ${bilan.picks_lost}D${bilan.picks_void > 0 ? ` / ${bilan.picks_void}N` : ""} (winrate ${bilan.winrate_pct.toFixed(1)}%)`
  );

  // CLV moyen
  if (bilan.clv_avg_pct !== null && bilan.clv_picks_count > 0) {
    const clvSign = bilan.clv_avg_pct >= 0 ? "+" : "";
    const clvEmoji = bilan.clv_avg_pct > 0 ? "⚡" : "📉";
    lines.push(`${clvEmoji} CLV moyen : ${clvSign}${bilan.clv_avg_pct.toFixed(2)}% (${bilan.clv_picks_count} picks)`);
  }

  // Stats par tier
  const tiersWithPicks = (["lock", "strong", "value", "coup_de_coeur"] as const).filter(
    (t) => bilan.picks_by_tier[t]?.count > 0
  );
  if (tiersWithPicks.length > 0) {
    lines.push("");
    lines.push("<b>📈 Par catégorie :</b>");
    for (const t of tiersWithPicks) {
      const stats = bilan.picks_by_tier[t];
      const tierInfo = TIER_DISPLAY[t];
      const sign = stats.profit >= 0 ? "+" : "";
      const roiSign2 = stats.roi_pct >= 0 ? "+" : "";
      lines.push(
        `${tierInfo.emoji} ${tierInfo.label} : ${stats.won}/${stats.count} (${sign}${stats.profit.toFixed(2)}U, ROI ${roiSign2}${stats.roi_pct.toFixed(1)}%)`
      );
    }
  }

  // Stats top 5 sports (les plus rentables)
  const sportsArr = Object.entries(bilan.picks_by_sport)
    .filter(([, s]) => s.count > 0)
    .sort((a, b) => b[1].profit - a[1].profit)
    .slice(0, 5);

  if (sportsArr.length > 0) {
    lines.push("");
    lines.push("<b>🏆 Par sport :</b>");
    for (const [sport, stats] of sportsArr) {
      const sportEmoji = SPORT_EMOJI[sport] ?? "🎯";
      const sign = stats.profit >= 0 ? "+" : "";
      const sportLabel = sport.charAt(0).toUpperCase() + sport.slice(1).replace("-", " ");
      lines.push(
        `${sportEmoji} ${sportLabel} : ${stats.won}/${stats.count} (${sign}${stats.profit.toFixed(2)}U)`
      );
    }
  }

  // CTA
  lines.push("");
  lines.push(`📊 <b>Bilan complet + graphiques :</b>`);
  lines.push(`👉 ${bilanLinkUrl}`);
  lines.push("");
  lines.push(DISCLAIMER_BLOCK);

  return lines.join("\n");
};

/**
 * Publie le bilan mensuel sur le canal Telegram public.
 *
 * @param bilan le BilanMensuel agrégé via aggregateBilanMensuel()
 * @returns PublishResult
 */
export const publishMensuelBilanToPublicChannel = async (
  bilan: BilanMensuel
): Promise<PublishResult> => {
  const bilanLinkUrl = `${SITE_BASE_URL}/fr/pronos-ia/bilan-mensuel/${bilan.month_slug}?utm_source=telegram&utm_medium=channel&utm_campaign=ia_bilan_mensuel`;

  const message = formatBilanMensuelMessage(bilan, bilanLinkUrl);
  const result = await telegramSendMessage(message, "HTML", false);

  if (result.success) {
    console.log(
      `[telegram] Bilan mensuel ${bilan.month_slug} publié, message_id=${result.message_id}`
    );
  } else {
    console.warn(
      `[telegram] Bilan mensuel ${bilan.month_slug} échec publication: ${result.error}`
    );
  }

  return result;
};