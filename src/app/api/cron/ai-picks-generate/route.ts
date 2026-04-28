import { NextRequest, NextResponse } from "next/server";
import { buildEnrichedFixturesData } from "@/lib/ai-picks-v2/fixtures-enrichment";
import { findValueBets } from "@/lib/ai-picks-v2/value-bet-engine";
import {
  persistValueBet,
  persistConsensusCandidate,
  persistDossier,
  updatePickDossierStatus,
} from "@/lib/ai-picks-v2/persist-picks";
import { generateDossier } from "@/lib/ai-picks-v2/dossier-generator";
import { aggregateMatchData } from "@/lib/ai-picks-v2/match-aggregator";
import { runConsensus } from "@/lib/ai-picks-v2/consensus";
import {
  GENERATOR_SYSTEM_PROMPT,
  buildGeneratorUserPrompt,
} from "@/lib/ai-picks-v2/prompts";
import { resolveOdds } from "@/lib/ai-picks-v2/odds-resolver";
import type { ValueBet } from "@/lib/ai-picks-v2/value-bet-engine";
import type { ConsensusCandidate } from "@/types/ai-picks-v2";
import type { AggregatedMatchData } from "@/types/apifootball";
import type { SimplifiedFixture } from "@/lib/ai-picks-v2/odds-api-client";

export const maxDuration = 300;

// Quotas Couche A (LLM-driven editorial picks)
const MAX_LLM_FOOTBALL = 3;
const MAX_LLM_OTHER_PER_SPORT = 2;
const MAX_LLM_TOTAL = 5;

// Quota Couche B (value bet picks, complement)
const MAX_VALUEBET_PICKS = 2;

// Plafond global jamais depasse
const MAX_TOTAL_PICKS = 7;

/**
 * Marge minimale entre maintenant et le coup d'envoi du match.
 * En dessous, on rejette : les abonnes n'ont plus le temps de parier
 * et les bookmakers freezent souvent les cotes en derniere minute.
 *
 * IMPORTANT : doit rester coherent avec MIN_MINUTES_BEFORE_KICKOFF
 * dans value-bet-engine.ts. Si on change la valeur ici, la changer
 * aussi la-bas.
 */
const MIN_MINUTES_BEFORE_KICKOFF = 30;


const isAuthorized = (req: NextRequest): boolean => {
  const authHeader = req.headers.get("authorization");
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) return true;
  const secretHeader = req.headers.get("x-admin-secret");
  if (secretHeader === process.env.CRON_SECRET) return true;
  const adminEmail = req.headers.get("x-admin-email");
  if (
    adminEmail &&
    ["flotoulouse7@gmail.com", "jbrulard@yahoo.fr"].includes(
      adminEmail.toLowerCase()
    )
  ) {
    return true;
  }
  return false;
};


const generateDossierForPick = async (
  pickId: string,
  candidate: ConsensusCandidate
): Promise<void> => {
  await updatePickDossierStatus(pickId, "generating");

  let matchData: AggregatedMatchData | null = null;
  if (/^\d+$/.test(candidate.fixtureRef)) {
    try {
      matchData = await aggregateMatchData(Number(candidate.fixtureRef), {
        pickId,
      });
    } catch (err) {
      console.warn(
        `[ai-picks-generate] aggregateMatchData failed for ${candidate.fixtureRef}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  const dossierResult = await generateDossier({
    pick: candidate,
    matchData,
    pickId,
  });

  if (dossierResult.error || !dossierResult.fullText) {
    await updatePickDossierStatus(pickId, "failed");
    return;
  }

  const apiFootballSnapshot = matchData
    ? {
        completeness: matchData.dataCompleteness,
        fixture_id: matchData.fixtureId,
        league: matchData.fixture.league,
        teams: matchData.fixture.teams,
        home_form: matchData.homeStats?.form ?? null,
        away_form: matchData.awayStats?.form ?? null,
        h2h_count: matchData.h2h?.length ?? 0,
        injuries_count: matchData.injuries?.length ?? 0,
        lineups_count: matchData.lineups?.length ?? 0,
        has_predictions: !!matchData.predictions,
      }
    : null;

  await persistDossier(
    pickId,
    dossierResult.fullText,
    dossierResult.sections,
    apiFootballSnapshot,
    dossierResult.meta.model,
    dossierResult.meta.tokensInput,
    dossierResult.meta.tokensOutput,
    dossierResult.meta.tokensCached,
    dossierResult.meta.costUsd
  );
};


/**
 * Adapter ValueBet -> ConsensusCandidate pour reutiliser
 * generateDossier() qui attend ce format.
 */
const valueBetToConsensusCandidate = (vb: ValueBet): ConsensusCandidate => {
  return {
    key: vb.uniqueKey,
    type: "classic",
    fixtureRef: vb.fixtureId,
    market: vb.marketCode,
    selection: vb.selection,
    league: vb.league,
    eventName: vb.eventName,
    eventDateIso: vb.commenceTime,
    homeTeam: vb.homeTeam,
    awayTeam: vb.awayTeam,
    odds: vb.bestSoftOdds,
    bookmaker: vb.bestSoftBookName,
    source: "both",
    confidenceClaude: Math.round(vb.fairProbability * 100),
    confidenceGpt: Math.round(vb.fairProbability * 100),
    confidenceApiFootball: null,
    reasoningClaude: `Value bet detectee : edge +${vb.edgePct.toFixed(2)}% par rapport aux fair odds Pinnacle (${vb.fairOdds.toFixed(3)}). Cote ${vb.bestSoftBookName} a ${vb.bestSoftOdds.toFixed(3)}.`,
    reasoningGpt: null,
    consensusScore: Math.min(100, Math.max(0, Math.round(vb.edgePct * 10))),
    consensusTier:
      vb.edgePct >= 7
        ? "total_agreement"
        : vb.edgePct >= 5
        ? "partial"
        : "isolated_high",
  };
};


/**
 * Resolution de la categorie sport (foot regroupe, autres = sportKey/league brut)
 * Pour appliquer les quotas Couche A.
 */
const getSportCategory = (candidate: ConsensusCandidate): string => {
  const leagueLower = candidate.league.toLowerCase();
  // Foot : detection par mots cles dans la ligue (les LLM mettent league = "Champions League", "La Liga", "Premier League"...)
  if (
    leagueLower.includes("champions") ||
    leagueLower.includes("europa") ||
    leagueLower.includes("conference") ||
    leagueLower.includes("liga") ||
    leagueLower.includes("ligue") ||
    leagueLower.includes("premier") ||
    leagueLower.includes("bundesliga") ||
    leagueLower.includes("serie a") ||
    leagueLower.includes("eredivisie") ||
    leagueLower.includes("primeira") ||
    leagueLower.includes("super lig") ||
    leagueLower.includes("mls") ||
    leagueLower.includes("copa") ||
    leagueLower.includes("coupe") ||
    leagueLower.includes("monde") ||
    leagueLower.includes("world cup") ||
    leagueLower.includes("euro")
  ) {
    return "football";
  }
  // Autres sports : on retourne la ligue (NBA != Euroleague != ACB)
  return candidate.league;
};


/**
 * Resoudre les cotes pour les candidats Couche A et appliquer les quotas par sport.
 * Retourne uniquement les picks resolus avec cotes valides.
 *
 * IMPORTANT : applique aussi le filtre temporel MIN_MINUTES_BEFORE_KICKOFF
 * pour rejeter les matchs trop proches du coup d'envoi (coherent avec
 * value-bet-engine.ts).
 */
type ResolvedLLMPick = {
  candidate: ConsensusCandidate;
  resolvedOdds: number;
  resolvedBookmakerKey: string;
  resolvedBookmakerName: string;
  books: { key: string; name: string; odds: number | null }[];
  pinnacleRawOdds: number | null;
};

type LayerAStats = {
  llm_candidates_total: number;
  resolved_success: number;
  rejected_too_late: number;
  rejected_no_home_away: number;
  rejected_fixture_not_found: number;
  rejected_market_not_supported: number;
  rejected_selection_not_found: number;
  rejected_no_soft_book_odds: number;
  rejected_odds_out_of_range: number;
  rejected_quota_exceeded: number;
  selected_after_quotas: number;
  sport_distribution: Record<string, number>;
};

const resolveAndQuotaLayerA = (
  candidates: ConsensusCandidate[],
  fixtures: SimplifiedFixture[]
): { resolved: ResolvedLLMPick[]; stats: LayerAStats } => {
  const stats: LayerAStats = {
    llm_candidates_total: candidates.length,
    resolved_success: 0,
    rejected_too_late: 0,
    rejected_no_home_away: 0,
    rejected_fixture_not_found: 0,
    rejected_market_not_supported: 0,
    rejected_selection_not_found: 0,
    rejected_no_soft_book_odds: 0,
    rejected_odds_out_of_range: 0,
    rejected_quota_exceeded: 0,
    selected_after_quotas: 0,
    sport_distribution: {},
  };

  // Tri par consensus score desc — qualite avant tout
  const sorted = [...candidates].sort(
    (a, b) => b.consensusScore - a.consensusScore
  );

  const resolved: ResolvedLLMPick[] = [];
  const sportCounts = new Map<string, number>();
  const now = Date.now();

  for (const cand of sorted) {
    if (resolved.length >= MAX_LLM_TOTAL) break;

    // ─── Filtre temporel ─────────────────────────
    // Le match doit commencer dans plus de MIN_MINUTES_BEFORE_KICKOFF.
    // Sinon les abonnes n'ont pas le temps de parier et les books
    // freezent souvent les cotes en derniere minute.
    const kickoffTime = new Date(cand.eventDateIso).getTime();
    const minutesUntilKickoff = (kickoffTime - now) / (1000 * 60);
    if (minutesUntilKickoff < MIN_MINUTES_BEFORE_KICKOFF) {
      stats.rejected_too_late += 1;
      continue;
    }

    // Sans home_team / away_team le resolver ne peut pas matcher h2h
    if (!cand.homeTeam || !cand.awayTeam) {
      stats.rejected_no_home_away += 1;
      continue;
    }

    // Resoudre la cote depuis OddsAPI
    const result = resolveOdds({
      fixtures,
      fixtureId: cand.fixtureRef,
      market: cand.market ?? "1N2",
      selection: cand.selection,
      homeTeam: cand.homeTeam,
      awayTeam: cand.awayTeam,
    });

    if (!result.resolved) {
      switch (result.reason) {
        case "fixture_not_found":
          stats.rejected_fixture_not_found += 1;
          break;
        case "market_not_supported":
          stats.rejected_market_not_supported += 1;
          break;
        case "selection_not_found":
          stats.rejected_selection_not_found += 1;
          break;
        case "no_soft_book_odds":
          stats.rejected_no_soft_book_odds += 1;
          break;
        case "odds_out_of_range":
          stats.rejected_odds_out_of_range += 1;
          break;
      }
      continue;
    }

    // Application des quotas par sport
    const category = getSportCategory(cand);
    const currentCount = sportCounts.get(category) ?? 0;
    const maxForCategory =
      category === "football" ? MAX_LLM_FOOTBALL : MAX_LLM_OTHER_PER_SPORT;

    if (currentCount >= maxForCategory) {
      stats.rejected_quota_exceeded += 1;
      continue;
    }

    resolved.push({
      candidate: cand,
      resolvedOdds: result.odds,
      resolvedBookmakerKey: result.bookmakerKey,
      resolvedBookmakerName: result.bookmakerName,
      books: result.books,
      pinnacleRawOdds: result.pinnacleRawOdds,
    });
    sportCounts.set(category, currentCount + 1);
    stats.resolved_success += 1;
  }

  stats.selected_after_quotas = resolved.length;
  stats.sport_distribution = Object.fromEntries(sportCounts.entries());

  return { resolved, stats };
};


/**
 * Apres Couche A, on filtre les value bets de la Couche B pour eviter les
 * doublons fixture, et on plafonne a MAX_VALUEBET_PICKS et MAX_TOTAL_PICKS.
 */
const applyLayerBQuotas = (
  valueBets: ValueBet[],
  layerAFixturesUsed: Set<string>,
  totalAlreadySelected: number
): ValueBet[] => {
  const remaining = MAX_TOTAL_PICKS - totalAlreadySelected;
  const limit = Math.min(MAX_VALUEBET_PICKS, remaining);
  if (limit <= 0) return [];

  const selected: ValueBet[] = [];
  for (const vb of valueBets) {
    if (selected.length >= limit) break;
    if (layerAFixturesUsed.has(vb.fixtureId)) continue;
    selected.push(vb);
  }
  return selected;
};


export async function GET(req: NextRequest) {
  return runGeneration(req);
}

export async function POST(req: NextRequest) {
  return runGeneration(req);
}


const runGeneration = async (req: NextRequest): Promise<NextResponse> => {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const startedAt = Date.now();
  const today = new Date().toISOString().slice(0, 10);

  try {
    // ─── ETAPE 1 : Fetch fixtures (1 fois, partage entre Couche A et B) ───
    const enriched = await buildEnrichedFixturesData(today);
    const { apiFootballFixtures, oddsApiAllFixtures, promptUserText } = enriched;

    if (oddsApiAllFixtures.length === 0) {
      return NextResponse.json({
        ok: true,
        date: today,
        skipped: true,
        reason: "No OddsAPI fixtures available for today",
      });
    }

    // ─── ETAPE 2 : COUCHE A — Consensus LLM (Claude + GPT) ───
    const consensus = await runConsensus({
      systemPrompt: GENERATOR_SYSTEM_PROMPT,
      userPrompt: promptUserText,
    });

    // ─── ETAPE 3 : COUCHE A — Resolution des cotes + filtre temporel + quotas par sport ───
    const layerA = resolveAndQuotaLayerA(
      consensus.selectedClassic,
      oddsApiAllFixtures
    );

    // ─── ETAPE 4 : COUCHE B — Value bet engine (complement, max 2) ───
    const engineResult = findValueBets(oddsApiAllFixtures);

    // Filtrer les value bets pour eviter les doublons avec Couche A
    const layerAFixturesUsed = new Set<string>();
    for (const r of layerA.resolved) {
      layerAFixturesUsed.add(r.candidate.fixtureRef);
    }

    const layerBSelected = applyLayerBQuotas(
      engineResult.selected,
      layerAFixturesUsed,
      layerA.resolved.length
    );

    // ─── ETAPE 5 : Persistance Couche A ───
    const persistedLayerA: Array<{
      pickId: string;
      slug: string;
      candidate: ConsensusCandidate;
    }> = [];
    const persistErrorsLayerA: Array<{ candidate: string; error: string }> = [];

    for (const item of layerA.resolved) {
      // Enrichir le candidate avec les infos resolues avant persist
      const enrichedCandidate: ConsensusCandidate = {
        ...item.candidate,
        odds: item.resolvedOdds,
        bookmaker: item.resolvedBookmakerName,
      };

      const persistResult = await persistConsensusCandidate({
        candidate: enrichedCandidate,
        generationBatch: today,
      });

      if (persistResult.success && persistResult.pickId && persistResult.slug) {
        persistedLayerA.push({
          pickId: persistResult.pickId,
          slug: persistResult.slug,
          candidate: enrichedCandidate,
        });
      } else {
        persistErrorsLayerA.push({
          candidate: `${enrichedCandidate.eventName} - ${enrichedCandidate.selection}`,
          error: persistResult.error ?? "unknown",
        });
      }
    }

    // ─── ETAPE 6 : Persistance Couche B ───
    const persistedLayerB: Array<{
      pickId: string;
      slug: string;
      valueBet: ValueBet;
    }> = [];
    const persistErrorsLayerB: Array<{ candidate: string; error: string }> = [];

    for (const valueBet of layerBSelected) {
      const result = await persistValueBet({
        valueBet,
        generationBatch: today,
      });
      if (result.success && result.pickId && result.slug) {
        persistedLayerB.push({
          pickId: result.pickId,
          slug: result.slug,
          valueBet,
        });
      } else {
        persistErrorsLayerB.push({
          candidate: `${valueBet.eventName} ${valueBet.selection}`,
          error: result.error ?? "unknown",
        });
      }
    }

    const persistDurationMs = Date.now() - startedAt;

    // ─── ETAPE 7 : Generation des dossiers en arriere-plan (async, fire-and-forget) ───
    void (async () => {
      // Couche A : dossiers via consensus candidate direct
      for (const { pickId, candidate } of persistedLayerA) {
        try {
          await generateDossierForPick(pickId, candidate);
        } catch (err) {
          console.error(
            `[ai-picks-generate] Dossier failed for pick ${pickId}:`,
            err instanceof Error ? err.message : err
          );
          await updatePickDossierStatus(pickId, "failed");
        }
      }
      // Couche B : adapter ValueBet -> ConsensusCandidate
      for (const { pickId, valueBet } of persistedLayerB) {
        try {
          const candidate = valueBetToConsensusCandidate(valueBet);
          await generateDossierForPick(pickId, candidate);
        } catch (err) {
          console.error(
            `[ai-picks-generate] Dossier failed for value-bet pick ${pickId}:`,
            err instanceof Error ? err.message : err
          );
          await updatePickDossierStatus(pickId, "failed");
        }
      }
    })();

    return NextResponse.json({
      ok: true,
      date: today,
      durationMs: persistDurationMs,
      strategy: "hybrid_v3",
      apiFootballFixtures: apiFootballFixtures.length,
      oddsApiFixtures: oddsApiAllFixtures.length,

      // ─── Couche A : LLM-driven editorial picks ───
      layerA: {
        consensus: {
          claudeCandidates: consensus.rawOutputs.claude?.candidates_classic.length ?? 0,
          gptCandidates: consensus.rawOutputs.gpt?.candidates_classic.length ?? 0,
          afterDedup: consensus.passes.candidatesAfterDedup,
          selectedAfterPasses: consensus.selectedClassic.length,
          claudeError: consensus.errors.claude ?? null,
          gptError: consensus.errors.gpt ?? null,
          costUsd: consensus.meta.totalCostUsd,
        },
        resolution: layerA.stats,
        selected_picks: layerA.resolved.map((r) => ({
          event: r.candidate.eventName,
          sport: r.candidate.league,
          selection: r.candidate.selection,
          market: r.candidate.market,
          odds: r.resolvedOdds,
          bookmaker: r.resolvedBookmakerName,
          consensus_score: r.candidate.consensusScore,
          consensus_tier: r.candidate.consensusTier,
        })),
      },

      // ─── Couche B : Value bet engine (complement) ───
      layerB: {
        engine: engineResult.stats,
        selected_picks: layerBSelected.map((vb) => ({
          event: vb.eventName,
          sport: vb.sportTitle,
          selection: vb.selection,
          market: vb.marketCode,
          odds: vb.bestSoftOdds,
          bookmaker: vb.bestSoftBookName,
          fair_odds: parseFloat(vb.fairOdds.toFixed(3)),
          edge_pct: parseFloat(vb.edgePct.toFixed(2)),
        })),
      },

      // ─── Persistance ───
      persisted: {
        layerA: {
          success: persistedLayerA.length,
          errors: persistErrorsLayerA,
        },
        layerB: {
          success: persistedLayerB.length,
          errors: persistErrorsLayerB,
        },
        totalSuccess: persistedLayerA.length + persistedLayerB.length,
      },

      dossiers_status: "queued_async",
      pickIds: [
        ...persistedLayerA.map((p) => p.pickId),
        ...persistedLayerB.map((p) => p.pickId),
      ],
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        date: today,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
};