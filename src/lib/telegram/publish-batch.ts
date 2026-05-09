/**
 * PRONOS.CLUB — Publish Batch Helper (V3.5)
 *
 * Helper factorisé pour les crons publish-morning et publish-evening.
 *
 * Logique :
 *   1. Récupère les picks V3.5 générés au drop window cible (matin ou soir)
 *      pour la date du jour, qui ne sont pas encore publiés sur Telegram
 *   2. Pour chaque pick : appelle publishPickToPublicChannel(pickId)
 *   3. Marque les picks comme publiés via odds_comparison.telegram_published_at
 *      pour éviter les doublons en cas de retry du cron
 *   4. Throttle : 1.5s entre 2 posts pour respecter les limites Telegram (1 msg/s/canal)
 *
 * Telegram Bot API rate limits :
 *   - 30 messages/sec global
 *   - 1 message/sec par canal
 *   - On met 1.5s entre 2 messages pour être safe
 *
 * Filtre Q8-A respecté (filtre par tier pour X seulement, pas Telegram) :
 *   Telegram = TOUS les picks publiés (pas de filtre tier)
 */

import { supabaseAdmin } from "@/lib/supabase/admin";
import { publishPickToPublicChannel } from "@/lib/telegram/public-channel";
import type { DropWindow } from "@/lib/ai-picks-v3/tipster-types";

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Délai entre 2 posts Telegram (Telegram limite : 1 msg/sec par canal) */
const THROTTLE_MS_BETWEEN_POSTS = 1500;

// ============================================================================
// TYPES
// ============================================================================

export type PublishBatchResult = {
  success: boolean;
  drop_window: DropWindow;
  picks_found: number;
  picks_published: number;
  picks_already_published: number;
  picks_errored: number;
  errors: Array<{ pick_id: string; error: string }>;
  duration_ms: number;
};

type PendingPickRow = {
  id: string;
  slug: string | null;
  drop_window: string | null;
  generation_batch: string | null;
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
 * Marque un pick comme publié sur Telegram.
 * Stocké dans odds_comparison.telegram_published_at pour idempotence cross-run.
 */
const markPickAsPublishedOnTelegram = async (
  pickId: string,
  currentOC: Record<string, unknown> | null,
  messageId?: number
): Promise<void> => {
  const updatedOC = {
    ...(currentOC ?? {}),
    telegram_published_at: new Date().toISOString(),
    telegram_message_id: messageId ?? null,
  };

  await supabaseAdmin
    .from("ai_picks")
    .update({ odds_comparison: updatedOC })
    .eq("id", pickId);
};

// ============================================================================
// FONCTION PRINCIPALE
// ============================================================================

/**
 * Publie sur Telegram public tous les picks V3.5 du drop window cible
 * générés aujourd'hui qui ne sont pas encore publiés.
 *
 * Idempotent : si le cron est ré-exécuté dans la journée (replay manuel),
 * les picks déjà publiés sont skip via le check telegram_published_at.
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
    picks_published: 0,
    picks_already_published: 0,
    picks_errored: 0,
    errors: [],
    duration_ms: 0,
  };

  // ─── 1. Récupérer les picks V3.5 du drop window pour aujourd'hui
  const { data: picks, error: fetchError } = await supabaseAdmin
    .from("ai_picks")
    .select("id, slug, drop_window, generation_batch, odds_comparison")
    .eq("generation_version", "v3")
    .eq("drop_window", dropWindow)
    .eq("generation_batch", date)
    .is("deleted_at", null)
    .order("ai_confidence", { ascending: false }); // les plus confiants en premier

  if (fetchError) {
    result.success = false;
    result.errors.push({
      pick_id: "FETCH",
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
  console.log(
    `[publish-batch] ${picks.length} pick(s) V3.5 à publier pour drop=${dropWindow}, date=${date}`
  );

  // ─── 2. Publier chaque pick (avec throttle entre posts)
  const typedPicks = picks as PendingPickRow[];

  for (let i = 0; i < typedPicks.length; i++) {
    const pick = typedPicks[i];

    // Skip si déjà publié sur Telegram (idempotence)
    const oc = pick.odds_comparison ?? {};
    if (oc.telegram_published_at) {
      console.log(
        `  ↪ Pick ${pick.id} déjà publié sur Telegram (${oc.telegram_published_at}), skip`
      );
      result.picks_already_published++;
      continue;
    }

    // Publication
    try {
      const publishResult = await publishPickToPublicChannel(pick.id);

      if (publishResult.success) {
        await markPickAsPublishedOnTelegram(
          pick.id,
          oc,
          publishResult.message_id
        );
        result.picks_published++;
        console.log(
          `  ✓ Pick ${pick.id} publié (msg_id=${publishResult.message_id})`
        );
      } else {
        result.picks_errored++;
        result.errors.push({
          pick_id: pick.id,
          error: publishResult.error ?? "Unknown error",
        });
        console.warn(`  ✗ Pick ${pick.id} échec: ${publishResult.error}`);
      }
    } catch (err) {
      result.picks_errored++;
      const errMsg = err instanceof Error ? err.message : String(err);
      result.errors.push({ pick_id: pick.id, error: errMsg });
      console.warn(`  ✗ Pick ${pick.id} exception: ${errMsg}`);
    }

    // Throttle (sauf après le dernier)
    if (i < typedPicks.length - 1) {
      await sleep(THROTTLE_MS_BETWEEN_POSTS);
    }
  }

  result.duration_ms = Date.now() - startedAt;

  console.log(
    `[publish-batch] Terminé drop=${dropWindow} : ${result.picks_published} publiés, ${result.picks_already_published} skip déjà publié, ${result.picks_errored} erreurs (${(result.duration_ms / 1000).toFixed(1)}s)`
  );

  return result;
};