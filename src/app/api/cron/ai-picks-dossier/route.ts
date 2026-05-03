/**
 * PRONOS.CLUB — Cron route /api/cron/ai-picks-dossier (v3)
 *
 * ÉTAPE 2/2 du pipeline : génération des dossiers d'analyse pour les picks
 * insérés par ai-picks-generate avec dossier_status="queued".
 *
 * Tourne à 9h15 Paris (7h15 UTC), 30 minutes après ai-picks-generate.
 *
 * Pour chaque pick queued :
 *   1. aggregateMatchData(fixture_id) si foot avec fixture_id → stats API-Football
 *   2. generateDossier(pick, matchData) → 7 sections Claude
 *   3. persistDossier → ai_picks_analysis + dossier_status="ready"
 *
 * Peut aussi être lancé manuellement : ?date=YYYY-MM-DD
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateDossier } from "@/lib/ai-picks-v2/dossier-generator";
import { aggregateMatchData } from "@/lib/ai-picks-v2/match-aggregator";
import {
  persistDossier,
  updatePickDossierStatus,
} from "@/lib/ai-picks-v2/persist-picks";
import { buildClassicConsensusKey } from "@/types/ai-picks-v2";
import type { ConsensusCandidate } from "@/types/ai-picks-v2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET ?? "";

const isAuthorized = (request: NextRequest): boolean => {
  if (!CRON_SECRET) return true;
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;
  return authHeader.replace(/^Bearer\s+/i, "").trim() === CRON_SECRET;
};

const getTodayParisDate = (): string => {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
};

// ============================================================================
// ADAPTER : ai_picks row → ConsensusCandidate pour generateDossier
// ============================================================================

type AiPickRow = {
  id: string;
  sport: string;
  league: string | null;
  event_name: string;
  event_date: string;
  selection: string;
  market: string;
  odds: number;
  odds_bookmaker: string | null;
  reasoning: string | null;
  ai_confidence: number | null;
  consensus_tier: string | null;
  apifootball_fixture_id: number | null;
};

const adaptPickForDossier = (pick: AiPickRow): ConsensusCandidate => {
  const market = pick.market ?? "1N2";
  const fixtureRef = pick.apifootball_fixture_id != null
    ? String(pick.apifootball_fixture_id)
    : pick.event_name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

  const key = buildClassicConsensusKey(fixtureRef, market, pick.selection);

  const consensusTier = pick.consensus_tier === "tipster_v3_warning" ? "partial" : "isolated_high";

  return {
    key,
    type: "classic",
    fixtureRef,
    market,
    selection: pick.selection,
    league: pick.league ?? "",
    eventName: pick.event_name,
    eventDateIso: pick.event_date,
    odds: pick.odds,
    bookmaker: pick.odds_bookmaker ?? "",
    source: "claude",
    confidenceClaude: pick.ai_confidence,
    confidenceGpt: null,
    confidenceApiFootball: null,
    reasoningClaude: pick.reasoning,
    reasoningGpt: null,
    consensusScore: pick.ai_confidence ?? 70,
    consensusTier,
  };
};

// ============================================================================
// HANDLER
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  const startedAt = Date.now();
  const url = new URL(request.url);
  const overrideDate = url.searchParams.get("date");
  const targetDate = overrideDate ?? getTodayParisDate();

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log(`\n[ai-picks-dossier] Start - date=${targetDate}`);

  // Récupérer tous les picks du jour avec dossier_status="queued"
  const dateStart = `${targetDate}T00:00:00.000Z`;
  const dateEnd   = `${targetDate}T23:59:59.999Z`;

  const { data: picks, error } = await supabaseAdmin
    .from("ai_picks")
    .select(`
      id, sport, league, event_name, event_date, selection, market,
      odds, odds_bookmaker, reasoning, ai_confidence, consensus_tier,
      apifootball_fixture_id
    `)
    .eq("dossier_status", "queued")
    .eq("generation_version", "v3")
    .gte("event_date", dateStart)
    .lte("event_date", dateEnd)
    .is("deleted_at", null);

  if (error) {
    console.error("[ai-picks-dossier] Erreur fetch picks queued:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const queuedPicks = (picks ?? []) as AiPickRow[];
  console.log(`[ai-picks-dossier] ${queuedPicks.length} pick(s) à traiter`);

  if (queuedPicks.length === 0) {
    return NextResponse.json({
      success: true,
      message: "Aucun pick en attente de dossier",
      duration_ms: Date.now() - startedAt,
    });
  }

  const results = { success: 0, failed: 0 };

  for (const pick of queuedPicks) {
    console.log(`\n[ai-picks-dossier] Traitement pick ${pick.id} — ${pick.event_name}`);

    try {
      // Marquer comme "generating" pour éviter les doublons si le cron re-tourne
      await updatePickDossierStatus(pick.id, "generating").catch(() => {});

      // Données API-Football si foot avec fixture_id
      let matchData = null;
      if (pick.apifootball_fixture_id) {
        try {
          matchData = await aggregateMatchData(pick.apifootball_fixture_id, { pickId: pick.id });
          console.log(`  [dossier] aggregateMatchData OK (fixture ${pick.apifootball_fixture_id})`);
        } catch (err) {
          console.warn(`  [dossier] aggregateMatchData failed:`, err instanceof Error ? err.message : err);
        }
      }

      // Adapter vers ConsensusCandidate
      const candidate = adaptPickForDossier(pick);

      // Génération dossier Claude
      const dossierResult = await generateDossier({
        pick: candidate,
        matchData,
        pickId: pick.id,
      });

      if (dossierResult.error && !dossierResult.fullText) {
        console.warn(`  [dossier] Génération échouée: ${dossierResult.error}`);
        await updatePickDossierStatus(pick.id, "failed").catch(() => {});
        results.failed++;
        continue;
      }

      // Persist dossier
      const persistResult = await persistDossier(
        pick.id,
        dossierResult.fullText ?? "",
        dossierResult.sections,
        null,
        dossierResult.meta.model,
        dossierResult.meta.tokensInput,
        dossierResult.meta.tokensOutput,
        dossierResult.meta.tokensCached,
        dossierResult.meta.costUsd,
        "fr"
      );

      if (!persistResult.success) {
        console.warn(`  [dossier] Persist échoué: ${persistResult.error}`);
        await updatePickDossierStatus(pick.id, "failed").catch(() => {});
        results.failed++;
      } else {
        console.log(`  [dossier] ✓ Dossier ready (cost=${dossierResult.meta.costUsd}$)`);
        results.success++;
      }

    } catch (err) {
      console.warn(`  [dossier] Exception:`, err instanceof Error ? err.message : err);
      await updatePickDossierStatus(pick.id, "failed").catch(() => {});
      results.failed++;
    }
  }

  const duration = Date.now() - startedAt;
  console.log(`\n[ai-picks-dossier] Done in ${(duration / 1000).toFixed(1)}s — ${results.success} OK, ${results.failed} failed`);

  return NextResponse.json({
    success: true,
    date: targetDate,
    processed: queuedPicks.length,
    results,
    duration_ms: duration,
  });
}