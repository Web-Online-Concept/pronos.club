/**
 * PRONOS.CLUB — Publish Batch Helper (V3.5)
 *
 * Helper factorisé pour les crons publish-morning et publish-evening.
 *
 * V3.5 (mise à jour 09/05/2026 - Étape 4) :
 *   - Ajout publication X parallèle pour les picks tier=lock|strong (Q8-A)
 *   - Limite stricte X : 17 posts/24h (filtre tier protège ce quota)
 *
 * Logique :
 *   1. Récupère les picks V3.5 générés au drop window cible
 *   2. Pour chaque pick :
 *      a. Telegram : TOUS les picks → publishPickToPublicChannel()
 *      b. X : UNIQUEMENT tier=lock|strong → postTweet via formatPickForX()
 *   3. Marque les picks comme publiés (Telegram + X séparément) pour idempotence
 *   4. Throttle : 1.5s entre 2 posts Telegram + 2s entre 2 posts X
 */

import { supabaseAdmin } from "@/lib/supabase/admin";
import { publishPickToPublicChannel } from "@/lib/telegram/public-channel";
import { postTweet } from "@/lib/x/post";
import {
  formatPickForX,
  shouldPublishPickToX,
  type PickForX,
} from "@/lib/x/format-pick";
import type { DropWindow } from "@/lib/ai-picks-v3/tipster-types";

// ============================================================================
// CONFIGURATION
// ============================================================================

const THROTTLE_MS_BETWEEN_TELEGRAM_POSTS = 1500;
const THROTTLE_MS_BETWEEN_X_POSTS = 2000;

// ============================================================================
// TYPES
// ============================================================================

export type PublishBatchResult = {
  success: boolean;
  drop_window: DropWindow;
  picks_found: number;
  // Telegram
  telegram_published: number;
  telegram_already_published: number;
  telegram_errored: number;
  // X
  x_eligible: number; // picks avec tier=lock|strong
  x_published: number;
  x_already_published: number;
  x_errored: number;
  errors: Array<{ pick_id: string; channel: "telegram" | "x"; error: string }>;
  duration_ms: number;
};

type PendingPickRow = {
  id: string;
  slug: string | null;
  sport: string;
  league: string;
  event_name: string;
  event_date: string;
  selection: string;
  market: string;
  odds: number;
  reasoning: string;
  drop_window: string | null;
  generation_batch: string | null;
  tier: string | null;
  odds_comparison: Record<string, unknown> | null;
};

// ============================================================================
// HELPERS
// ============================================================================

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const getTodayParisDate = (): string => {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
};

/**
 * Marque un pick comme publié sur un canal donné (Telegram ou X).
 * Stocké dans odds_comparison pour idempotence cross-run.
 */
const markPickAsPublished = async (
  pickId: string,
  currentOC: Record<string, unknown> | null,
  channel: "telegram" | "x",
  messageId?: string | number
): Promise<void> => {
  const updates: Record<string, unknown> = {};
  if (channel === "telegram") {
    updates.telegram_published_at = new Date().toISOString();
    updates.telegram_message_id = messageId ?? null;
  } else {
    updates.x_published_at = new Date().toISOString();
    updates.x_tweet_id = messageId ?? null;
  }

  const updatedOC = {
    ...(currentOC ?? {}),
    ...updates,
  };

  await supabaseAdmin
    .from("ai_picks")
    .update({ odds_comparison: updatedOC })
    .eq("id", pickId);
};

/**
 * Convertit un PendingPickRow en PickForX (typing strict).
 */
const toPickForX = (pick: PendingPickRow): PickForX | null => {
  if (!pick.slug) return null;
  return {
    id: pick.id,
    slug: pick.slug,
    sport: pick.sport,
    league: pick.league,
    event_name: pick.event_name,
    event_date: pick.event_date,
    selection: pick.selection,
    market: pick.market,
    odds: pick.odds,
    reasoning: pick.reasoning,
    tier: pick.tier,
    drop_window: pick.drop_window,
  };
};

// ============================================================================
// PUBLICATION TELEGRAM (boucle séquentielle avec throttle)
// ============================================================================

const publishAllToTelegram = async (
  picks: PendingPickRow[],
  result: PublishBatchResult
): Promise<void> => {
  for (let i = 0; i < picks.length; i++) {
    const pick = picks[i];
    const oc = pick.odds_comparison ?? {};

    // Skip si déjà publié sur Telegram
    if (oc.telegram_published_at) {
      console.log(
        `  [TG] ↪ Pick ${pick.id} déjà publié Telegram (${oc.telegram_published_at}), skip`
      );
      result.telegram_already_published++;
      continue;
    }

    try {
      const publishResult = await publishPickToPublicChannel(pick.id);

      if (publishResult.success) {
        await markPickAsPublished(pick.id, oc, "telegram", publishResult.message_id);
        result.telegram_published++;
        console.log(
          `  [TG] ✓ Pick ${pick.id} publié (msg_id=${publishResult.message_id})`
        );
      } else {
        result.telegram_errored++;
        result.errors.push({
          pick_id: pick.id,
          channel: "telegram",
          error: publishResult.error ?? "Unknown error",
        });
        console.warn(`  [TG] ✗ Pick ${pick.id} échec: ${publishResult.error}`);
      }
    } catch (err) {
      result.telegram_errored++;
      const errMsg = err instanceof Error ? err.message : String(err);
      result.errors.push({ pick_id: pick.id, channel: "telegram", error: errMsg });
      console.warn(`  [TG] ✗ Pick ${pick.id} exception: ${errMsg}`);
    }

    if (i < picks.length - 1) {
      await sleep(THROTTLE_MS_BETWEEN_TELEGRAM_POSTS);
    }
  }
};

// ============================================================================
// PUBLICATION X (filtré + boucle séquentielle avec throttle)
// ============================================================================

const publishEligibleToX = async (
  picks: PendingPickRow[],
  result: PublishBatchResult
): Promise<void> => {
  // Filtre Q8-A : uniquement tier=lock|strong
  const eligiblePicks = picks.filter((p) => shouldPublishPickToX(p));
  result.x_eligible = eligiblePicks.length;

  if (eligiblePicks.length === 0) {
    console.log("  [X] Aucun pick eligible (tier=lock|strong absent)");
    return;
  }

  console.log(
    `  [X] ${eligiblePicks.length} pick(s) eligible(s) (tier=lock|strong)`
  );

  for (let i = 0; i < eligiblePicks.length; i++) {
    const pick = eligiblePicks[i];
    const oc = pick.odds_comparison ?? {};

    // Skip si déjà publié sur X
    if (oc.x_published_at) {
      console.log(
        `  [X] ↪ Pick ${pick.id} déjà publié X (${oc.x_published_at}), skip`
      );
      result.x_already_published++;
      continue;
    }

    const pickForX = toPickForX(pick);
    if (!pickForX) {
      result.x_errored++;
      result.errors.push({
        pick_id: pick.id,
        channel: "x",
        error: "Pick sans slug, impossible de poster sur X",
      });
      continue;
    }

    try {
      // Format + post
      const formatted = await formatPickForX(pickForX);
      const tweetResult = await postTweet(formatted.text);

      if (tweetResult.success && tweetResult.tweet_id) {
        await markPickAsPublished(pick.id, oc, "x", tweetResult.tweet_id);
        result.x_published++;
        console.log(
          `  [X] ✓ Pick ${pick.id} publié (tweet_id=${tweetResult.tweet_id})`
        );
      } else {
        result.x_errored++;
        result.errors.push({
          pick_id: pick.id,
          channel: "x",
          error: tweetResult.error ?? "Unknown error",
        });
        console.warn(
          `  [X] ✗ Pick ${pick.id} échec: ${tweetResult.error} (status=${tweetResult.status_code})`
        );
      }
    } catch (err) {
      result.x_errored++;
      const errMsg = err instanceof Error ? err.message : String(err);
      result.errors.push({ pick_id: pick.id, channel: "x", error: errMsg });
      console.warn(`  [X] ✗ Pick ${pick.id} exception: ${errMsg}`);
    }

    if (i < eligiblePicks.length - 1) {
      await sleep(THROTTLE_MS_BETWEEN_X_POSTS);
    }
  }
};

// ============================================================================
// FONCTION PRINCIPALE
// ============================================================================

/**
 * Publie sur Telegram public + X (tier lock/strong) tous les picks V3.5
 * du drop window cible générés aujourd'hui qui ne sont pas encore publiés.
 *
 * Idempotent : retry safe via flags telegram_published_at + x_published_at.
 *
 * @param dropWindow "morning" ou "evening"
 * @param targetDate optional, par défaut aujourd'hui Paris
 */
export const publishBatchForDropWindow = async (
  dropWindow: DropWindow,
  targetDate?: string
): Promise<PublishBatchResult> => {
  const startedAt = Date.now();
  const date = targetDate ?? getTodayParisDate();

  const result: PublishBatchResult = {
    success: true,
    drop_window: dropWindow,
    picks_found: 0,
    telegram_published: 0,
    telegram_already_published: 0,
    telegram_errored: 0,
    x_eligible: 0,
    x_published: 0,
    x_already_published: 0,
    x_errored: 0,
    errors: [],
    duration_ms: 0,
  };

  // ─── 1. Récupérer les picks V3.5 du drop window pour aujourd'hui
  const { data: picks, error: fetchError } = await supabaseAdmin
    .from("ai_picks")
    .select(
      "id, slug, sport, league, event_name, event_date, selection, market, odds, reasoning, drop_window, generation_batch, tier, odds_comparison"
    )
    .eq("generation_version", "v3")
    .eq("drop_window", dropWindow)
    .eq("generation_batch", date)
    .is("deleted_at", null)
    .order("ai_confidence", { ascending: false });

  if (fetchError) {
    result.success = false;
    result.errors.push({
      pick_id: "FETCH",
      channel: "telegram",
      error: `Supabase fetch failed: ${fetchError.message}`,
    });
    result.duration_ms = Date.now() - startedAt;
    return result;
  }

  if (!picks || picks.length === 0) {
    console.log(
      `[publish-batch] Aucun pick V3.5 généré aujourd'hui pour drop=${dropWindow}, date=${date}`
    );
    result.duration_ms = Date.now() - startedAt;
    return result;
  }

  result.picks_found = picks.length;
  const typedPicks = picks as PendingPickRow[];
  console.log(
    `[publish-batch] ${picks.length} pick(s) V3.5 à publier pour drop=${dropWindow}, date=${date}`
  );

  // ─── 2. Publication Telegram (TOUS les picks)
  console.log("[publish-batch] STEP A - Telegram (all picks)");
  await publishAllToTelegram(typedPicks, result);

  // ─── 3. Publication X (uniquement tier=lock|strong)
  console.log("[publish-batch] STEP B - X (tier=lock|strong only)");
  await publishEligibleToX(typedPicks, result);

  result.duration_ms = Date.now() - startedAt;

  console.log(
    `[publish-batch] Terminé drop=${dropWindow} : TG ${result.telegram_published} pub / ${result.telegram_already_published} skip / ${result.telegram_errored} err — X ${result.x_published} pub / ${result.x_eligible} elig (${(result.duration_ms / 1000).toFixed(1)}s)`
  );

  return result;
};