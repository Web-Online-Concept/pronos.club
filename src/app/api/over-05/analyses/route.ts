// src/app/api/over-05/analyses/route.ts
//
// GET /api/over-05/analyses?league_id=X&period=30d&bet_status=won
//
// Liste les analyses du user connecte avec metadonnees enrichies :
//   - Info championnat (nom, pays, drapeau)
//   - Bilan des paris associes a chaque analyse (mises, profits, ROI)
//   - Stats globales : nb analyses, paris totaux, ROI global
//
// Filtres optionnels :
//   - league_id : un championnat specifique
//   - period : '7d', '30d', '90d', 'all'
//   - bet_status : 'with_bets', 'won_only', 'lost_only', 'all'

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { isO05Authorized } from "@/lib/over-05-buts-equipes/auth";

export const dynamic = "force-dynamic";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);


export async function GET(req: NextRequest) {
  // Auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email || !isO05Authorized(user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userEmail = user.email;
  const { searchParams } = new URL(req.url);
  const filterLeagueId = searchParams.get("league_id");
  const filterPeriod = searchParams.get("period") ?? "all";
  const filterBetStatus = searchParams.get("bet_status") ?? "all";

  // ─── 1. Recuperer les analyses du user ───
  let analysesQuery = supabaseAdmin
    .from("o05_analyses")
    .select(`
      id,
      league_id,
      matchday_label,
      date_from,
      date_to,
      total_matches,
      matches_analyzed,
      matches_failed,
      status,
      created_at,
      completed_at,
      league:o05_leagues!o05_analyses_league_id_fkey(id, name, country, country_code)
    `)
    .eq("requested_by", userEmail)
    .order("created_at", { ascending: false });

  // Filtre championnat
  if (filterLeagueId) {
    const lid = parseInt(filterLeagueId, 10);
    if (!Number.isNaN(lid)) {
      analysesQuery = analysesQuery.eq("league_id", lid);
    }
  }

  // Filtre periode
  if (filterPeriod !== "all") {
    const days =
      filterPeriod === "7d" ? 7 :
      filterPeriod === "30d" ? 30 :
      filterPeriod === "90d" ? 90 : 0;
    if (days > 0) {
      const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      analysesQuery = analysesQuery.gte("created_at", threshold);
    }
  }

  const { data: analyses, error: analysesErr } = await analysesQuery.limit(100);

  if (analysesErr) {
    return NextResponse.json(
      { error: "Failed to fetch analyses", details: analysesErr.message },
      { status: 500 }
    );
  }

  if (!analyses || analyses.length === 0) {
    return NextResponse.json({
      analyses: [],
      stats: emptyStats(),
    });
  }

  // ─── 2. Recuperer les paris associes ───
  const analysisIds = analyses.map((a) => a.id);

  // o05_bets est lié via match_analysis_id → o05_match_analyses → analysis_id
  // On joint via une sous-requête
  const { data: matchAnalyses } = await supabaseAdmin
    .from("o05_match_analyses")
    .select("id, analysis_id")
    .in("analysis_id", analysisIds);

  const matchAnalysisIds = matchAnalyses?.map((m) => m.id) ?? [];
  const matchToAnalysisMap = new Map<string, string>();
  for (const ma of matchAnalyses ?? []) {
    matchToAnalysisMap.set(ma.id, ma.analysis_id);
  }

  const { data: bets } = await supabaseAdmin
    .from("o05_bets")
    .select(`
      id,
      match_analysis_id,
      user_email,
      played,
      stake_amount,
      odds,
      bet_status,
      target_team_scored,
      profit
    `)
    .in("match_analysis_id", matchAnalysisIds.length > 0 ? matchAnalysisIds : ["__none__"])
    .eq("user_email", userEmail);

  // ─── 3. Agreger les paris par analyse ───
  type BetSummary = {
    bets_count: number;
    bets_played: number;
    bets_pending: number;
    bets_won: number;
    bets_lost: number;
    total_staked: number;
    total_profit: number;
    has_won: boolean;   // pour le filtre bet_status
    has_lost: boolean;
  };

  const betSummaryByAnalysis = new Map<string, BetSummary>();
  for (const aId of analysisIds) {
    betSummaryByAnalysis.set(aId, {
      bets_count: 0,
      bets_played: 0,
      bets_pending: 0,
      bets_won: 0,
      bets_lost: 0,
      total_staked: 0,
      total_profit: 0,
      has_won: false,
      has_lost: false,
    });
  }

  for (const b of bets ?? []) {
    const aId = matchToAnalysisMap.get(b.match_analysis_id);
    if (!aId) continue;
    const summary = betSummaryByAnalysis.get(aId);
    if (!summary) continue;
    summary.bets_count++;
    if (b.played) summary.bets_played++;
    if (b.bet_status === "pending") summary.bets_pending++;
    else if (b.bet_status === "won") {
      summary.bets_won++;
      summary.has_won = true;
    } else if (b.bet_status === "lost") {
      summary.bets_lost++;
      summary.has_lost = true;
    }
    if (b.played && b.stake_amount) summary.total_staked += Number(b.stake_amount);
    if (b.profit) summary.total_profit += Number(b.profit);
  }

  // ─── 4. Enrichir + filtrer (bet_status) ───
  let enriched = analyses.map((a) => {
    const summary = betSummaryByAnalysis.get(a.id) ?? {
      bets_count: 0, bets_played: 0, bets_pending: 0,
      bets_won: 0, bets_lost: 0, total_staked: 0,
      total_profit: 0, has_won: false, has_lost: false,
    };
    return {
      ...a,
      bets: summary,
    };
  });

  if (filterBetStatus === "with_bets") {
    enriched = enriched.filter((a) => a.bets.bets_played > 0);
  } else if (filterBetStatus === "won_only") {
    enriched = enriched.filter((a) => a.bets.has_won);
  } else if (filterBetStatus === "lost_only") {
    enriched = enriched.filter((a) => a.bets.has_lost);
  }

  // ─── 5. Stats globales sur les analyses retournees ───
  const globalStats = {
    total_analyses: enriched.length,
    total_matches_analyzed: enriched.reduce((s, a) => s + (a.matches_analyzed ?? 0), 0),
    total_bets: enriched.reduce((s, a) => s + a.bets.bets_played, 0),
    total_bets_won: enriched.reduce((s, a) => s + a.bets.bets_won, 0),
    total_bets_lost: enriched.reduce((s, a) => s + a.bets.bets_lost, 0),
    total_bets_pending: enriched.reduce((s, a) => s + a.bets.bets_pending, 0),
    total_staked: round2(enriched.reduce((s, a) => s + a.bets.total_staked, 0)),
    total_profit: round2(enriched.reduce((s, a) => s + a.bets.total_profit, 0)),
    roi_percent: 0,
    win_rate_percent: 0,
  };

  if (globalStats.total_staked > 0) {
    globalStats.roi_percent = round2(
      (globalStats.total_profit / globalStats.total_staked) * 100
    );
  }
  const resolvedBets = globalStats.total_bets_won + globalStats.total_bets_lost;
  if (resolvedBets > 0) {
    globalStats.win_rate_percent = round2(
      (globalStats.total_bets_won / resolvedBets) * 100
    );
  }

  return NextResponse.json({
    analyses: enriched,
    stats: globalStats,
  });
}


function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function emptyStats() {
  return {
    total_analyses: 0,
    total_matches_analyzed: 0,
    total_bets: 0,
    total_bets_won: 0,
    total_bets_lost: 0,
    total_bets_pending: 0,
    total_staked: 0,
    total_profit: 0,
    roi_percent: 0,
    win_rate_percent: 0,
  };
}