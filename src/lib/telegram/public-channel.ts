/**
 * PRONOS.CLUB — Telegram Public Channel Publisher (V3.5)
 *
 * Helper de publication sur le canal Telegram public @pronos_club_ia.
 * Utilisé par les crons publish-morning, publish-evening, publish-results.
 *
 * 3 fonctions exportées :
 *
 *   1. publishPickToPublicChannel(pickId)
 *      - Récupère le pick depuis ai_picks
 *      - Crée un shortlink /r/[code] avec UTM
 *      - Format HTML court (~10 lignes) : tier, sport, sélection, cote,
 *        1 argument clé, lien, disclaimers ANJ
 *      - Envoie via Telegram Bot API
 *
 *   2. publishResultsBilanToPublicChannel(bilan)
 *      - Format HTML détaillé du bilan jour
 *      - Stats globales + par tier + CLV moyen
 *      - Liste des picks avec ✅/❌/➖ + score final
 *      - Lien vers la page bilan (à créer Étape 6) ou liste pronos-ia
 *
 *   3. publishHebdoBilanToPublicChannel(bilanHebdo)
 *      - Réservé pour la future implémentation du bilan hebdo dim soir
 *      - Stub qui retourne not_implemented pour l'instant
 *
 * Toutes ces fonctions :
 *   - Utilisent parse_mode HTML
 *   - Incluent les disclaimers ANJ obligatoires (18+, joueurs-info-service)
 *   - Loggent leurs résultats pour debug
 *   - Ne throw jamais : retournent { success: bool, error?: string }
 */

import { supabaseAdmin } from "@/lib/supabase/admin";
import { createPickShortLink } from "@/lib/shortlinks/create";
import type { BilanJour } from "@/lib/clv/resolve";

// ============================================================================
// CONFIGURATION
// ============================================================================

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_IA_BOT_TOKEN ?? "";
const TELEGRAM_CHANNEL_ID = process.env.TELEGRAM_IA_CHANNEL_ID ?? "";

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
  odds_comparison: Record<string, unknown> | null;
};

type TelegramSendMessageResponse = {
  ok: boolean;
  result?: { message_id: number };
  description?: string;
  error_code?: number;
};

// ============================================================================
// CONSTANTS — Mappings affichage
// ============================================================================

/** Émojis sport pour les posts */
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

/** Labels et émojis tier pour l'affichage */
const TIER_DISPLAY: Record<string, { emoji: string; label: string }> = {
  lock: { emoji: "🔒", label: "LOCK" },
  strong: { emoji: "💪", label: "STRONG" },
  value: { emoji: "💎", label: "VALUE" },
  coup_de_coeur: { emoji: "❤️", label: "COUP DE CŒUR" },
};

/** Bloc de disclaimers ANJ obligatoires (à inclure sur chaque post) */
const DISCLAIMER_BLOCK = `🔞 <i>Jouer comporte des risques : endettement, dépendance.\nAppelez le 09 74 75 13 13 (appel non surtaxé). joueurs-info-service.fr</i>`;

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Échappe les caractères HTML spéciaux pour parse_mode HTML.
 * Telegram HTML supporte uniquement <b>, <i>, <u>, <s>, <code>, <pre>, <a>.
 * Les autres < > & doivent être échappés.
 */
const escapeHtml = (text: string): string => {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
};

/**
 * Formate la date Paris depuis ISO timestamp.
 * Ex: "2026-05-10T19:30:00Z" → "10/05 21:30"
 */
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

/**
 * Formate la date Paris (jour seul) depuis YYYY-MM-DD.
 * Ex: "2026-05-09" → "vendredi 9 mai"
 */
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

/**
 * Pour un pick combiné, on construit un titre lisible.
 * Pour un simple, on retourne juste event_name.
 */
const getDisplayMatchTitle = (pick: PickRow): string => {
  if (pick.market === "COMBINE") {
    const oc = pick.odds_comparison ?? {};
    const meta = oc.combine_meta as
      | { selections?: Array<{ match: string }> }
      | undefined;
    if (meta?.selections && meta.selections.length > 0) {
      return meta.selections.map((s) => s.match).join(" + ");
    }
    return pick.event_name;
  }
  return pick.event_name;
};

/**
 * Récupère le 1er argument du reasoning (séparateur " • ").
 * Ex: "Argument 1 • Argument 2 • Argument 3" → "Argument 1"
 */
const getFirstArgument = (reasoning: string): string => {
  if (!reasoning) return "";
  const parts = reasoning.split(" • ");
  return (parts[0] ?? "").trim();
};

/**
 * Appel HTTP au Telegram Bot API sendMessage.
 * Retry x2 en cas d'erreur 5xx ou 429 (rate limit).
 */
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

  // Le channel_id peut être numérique (-100xxx) ou un username (@xxx)
  // On essaie de parser en number d'abord
  const chatIdRaw = TELEGRAM_CHANNEL_ID.trim();
  const chatIdAsNum = Number(chatIdRaw);
  const chatId: string | number = !isNaN(chatIdAsNum) && chatIdRaw.startsWith("-")
    ? chatIdAsNum
    : chatIdRaw;

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

      // 429 (rate limit) ou 5xx → retry après pause
      if (
        response.status === 429 ||
        (response.status >= 500 && response.status < 600)
      ) {
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
// FORMAT 1 : POST D'UN PICK
// ============================================================================

/**
 * Formate un pick au format HTML court pour Telegram public.
 * ~10 lignes, lisible sur mobile, lien shortlink, disclaimers ANJ.
 */
const formatPickMessage = (
  pick: PickRow,
  shortUrl: string
): string => {
  const tierInfo = pick.tier ? TIER_DISPLAY[pick.tier] : null;
  const sportEmoji = SPORT_EMOJI[pick.sport] ?? "🎯";
  const matchTitle = escapeHtml(getDisplayMatchTitle(pick));
  const selection = escapeHtml(pick.selection);
  const league = escapeHtml(pick.league);
  const firstArg = escapeHtml(getFirstArgument(pick.reasoning));
  const kickoff = formatDateTimeParis(pick.event_date);

  // Header avec tier + sport + league
  const header = tierInfo
    ? `${tierInfo.emoji} <b>${tierInfo.label}</b> ${sportEmoji} ${league}`
    : `${sportEmoji} ${league}`;

  // Cote sur la base de la meilleure dispo (déjà calculée au persist)
  const bookLabel = pick.odds_bookmaker
    ? ` <i>(${escapeHtml(pick.odds_bookmaker)})</i>`
    : "";

  const lines = [
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

/**
 * Récupère un pick depuis ai_picks et le publie sur le canal Telegram public.
 *
 * @param pickId UUID du pick (depuis ai_picks.id)
 */
export const publishPickToPublicChannel = async (
  pickId: string
): Promise<PublishResult> => {
  // ─── 1. Récupération du pick
  const { data: pick, error: fetchError } = await supabaseAdmin
    .from("ai_picks")
    .select(
      "id, slug, sport, league, event_name, event_date, selection, market, odds, odds_bookmaker, reasoning, ai_confidence, tier, drop_window, classic_number, odds_comparison"
    )
    .eq("id", pickId)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchError) {
    return {
      success: false,
      error: `Fetch pick failed: ${fetchError.message}`,
    };
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

  // ─── 2. Création du shortlink
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

  // ─── 3. Format + envoi Telegram
  const message = formatPickMessage(typedPick, shortUrl);
  const result = await telegramSendMessage(message, "HTML", false);

  if (result.success) {
    console.log(
      `[telegram] Pick ${pickId} (${typedPick.slug}) publié, message_id=${result.message_id}`
    );
  } else {
    console.warn(
      `[telegram] Pick ${pickId} échec publication: ${result.error}`
    );
  }

  return result;
};

// ============================================================================
// FORMAT 2 : POST DU BILAN JOUR
// ============================================================================

/**
 * Formate le bilan jour au format HTML détaillé pour Telegram public.
 * Structure :
 *   - Header avec date + ROI global
 *   - Stats globales (V/D/N + profit + ROI)
 *   - Stats par tier
 *   - Liste détaillée des picks avec ✅/❌/➖ + cote + résultat
 *   - CLV moyen
 *   - Lien vers la page liste pronos-ia
 *   - Disclaimer ANJ
 */
const formatBilanJourMessage = (
  bilan: BilanJour,
  bilanLinkUrl: string
): string => {
  const dateLabel = formatDateLongFr(bilan.date);
  const roiSign = bilan.roi_pct >= 0 ? "+" : "";
  const profitSign = bilan.total_profit_units >= 0 ? "+" : "";
  const roiEmoji = bilan.roi_pct > 0 ? "🟢" : bilan.roi_pct < 0 ? "🔴" : "⚪";

  const lines: string[] = [];
  lines.push(`📊 <b>BILAN ${dateLabel.toUpperCase()}</b>`);
  lines.push("");
  lines.push(`${roiEmoji} <b>ROI : ${roiSign}${bilan.roi_pct.toFixed(2)}%</b>`);
  lines.push(
    `💰 Profit : ${profitSign}${bilan.total_profit_units.toFixed(2)}U`
  );
  lines.push(
    `📈 ${bilan.total_picks} picks : ${bilan.picks_won}V / ${bilan.picks_lost}D${bilan.picks_void > 0 ? ` / ${bilan.picks_void} annulé(s)` : ""}`
  );

  // Stats CLV (si dispo)
  if (bilan.clv_avg_pct !== null && bilan.clv_picks_count > 0) {
    const clvSign = bilan.clv_avg_pct >= 0 ? "+" : "";
    lines.push(
      `⚡ CLV moyen : ${clvSign}${bilan.clv_avg_pct.toFixed(2)}% (sur ${bilan.clv_picks_count} pick${bilan.clv_picks_count > 1 ? "s" : ""})`
    );
  }

  // Stats par tier
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

  // Liste détaillée des picks (max 12 affichés)
  const MAX_PICKS_DETAIL = 12;
  const picksToShow = bilan.picks.slice(0, MAX_PICKS_DETAIL);
  if (picksToShow.length > 0) {
    lines.push("");
    lines.push("<b>Détail :</b>");
    for (const pickEntry of picksToShow) {
      const statusEmoji =
        pickEntry.status === "won"
          ? "✅"
          : pickEntry.status === "lost"
            ? "❌"
            : "➖";
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
      lines.push(
        `${statusEmoji} ${sportEmoji} ${eventShort} — ${selectionShort} @ ${pickEntry.odds.toFixed(2)}${scoreLabel}`
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

/**
 * Publie le bilan jour sur le canal Telegram public.
 * Le lien pointe vers la page liste pronos-ia (page bilan dédiée à venir Étape 6).
 */
export const publishResultsBilanToPublicChannel = async (
  bilan: BilanJour
): Promise<PublishResult> => {
  // Pour l'instant, on ne crée pas un shortlink dédié au bilan jour
  // (la page bilan-jour n'existe pas encore). On pointe vers la page liste.
  const SITE_BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://pronos.club";
  const bilanLinkUrl = `${SITE_BASE_URL}/fr/pronos-ia?utm_source=telegram&utm_medium=channel&utm_campaign=ia_bilan_jour`;

  const message = formatBilanJourMessage(bilan, bilanLinkUrl);
  const result = await telegramSendMessage(message, "HTML", false);

  if (result.success) {
    console.log(
      `[telegram] Bilan ${bilan.date} publié, message_id=${result.message_id}`
    );
  } else {
    console.warn(
      `[telegram] Bilan ${bilan.date} échec publication: ${result.error}`
    );
  }

  return result;
};

// ============================================================================
// FORMAT 3 : POST DU BILAN HEBDO (stub pour future implémentation)
// ============================================================================

/**
 * Stub : à implémenter en Étape 6 (page bilan hebdo /bilan-hebdo/[semaine]).
 */
export const publishHebdoBilanToPublicChannel = async (): Promise<PublishResult> => {
  return {
    success: false,
    error: "publishHebdoBilanToPublicChannel: not implemented yet (Étape 6)",
  };
};