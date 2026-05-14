// src/app/api/over-05/_internal/run-analysis/route.ts
//
// PHASE 3 — Job background ENRICHI avec la vraie logique PROJETS.
//
// Pipeline complet :
//   1. Charger la session d'analyse + le championnat
//   2. Verifier que tous les championnats ont PROJETS (validation Q1 = A)
//   3. Fetch les fixtures de la plage de dates via API-Football
//   4. Pour chaque fixture :
//      a) Resoudre les team_id home/away (creer si absents)
//      b) Charger les PROJETS des 2 equipes
//      c) Identifier le favori intrinseque (favori-resolver)
//      d) Recuperer les stats des 3 derniers matchs de la cible (Understat)
//      e) Recuperer les stats defensives des 3 derniers matchs de l'adv (Understat)
//      f) Calculer les scores (scoring-engine)
//      g) Inserer le resultat complet en DB
//   5. Marquer status='completed'

import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import {
  getO05FixturesByDateRange,
  type O05Fixture,
} from "@/lib/over-05-buts-equipes/apifootball-fixtures";
import { getCurrentApiFootballSeason } from "@/lib/over-05-buts-equipes/season-helper";
import {
  apiFootballToDbName,
  normalizeTeamName,
} from "@/lib/over-05-buts-equipes/team-mapping";
import {
  resolveFavoriIntrinseque,
  computeProjectBonus,
} from "@/lib/over-05-buts-equipes/favori-resolver";
import { fetchTeamStatsUnderstat } from "@/lib/over-05-buts-equipes/stats-aggregator";
import { computeScoring } from "@/lib/over-05-buts-equipes/scoring-engine";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min max

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);


// ─── Helper : résolution équipe ──────────────────────────────────

type TeamWithProject = {
  team_id: number;
  team_name: string;
  name_normalized: string;
  current_rank: number | null;
  avg_rank_historical: number | null;
  category: string | null;
  project_bonus: number;  // calcule depuis ecart classement
};

async function resolveTeamWithProject(
  leagueId: number,
  apiFootballTeamId: number,
  apiFootballTeamName: string
): Promise<TeamWithProject | null> {
  // 1. Trouver le team_id dans o05_teams (par api_football_id puis par name_normalized)
  const dbNormalizedName = apiFootballToDbName(apiFootballTeamName);

  // Try par api_football_id
  let { data: team } = await supabaseAdmin
    .from("o05_teams")
    .select("id, name, name_normalized, api_football_id")
    .eq("league_id", leagueId)
    .eq("api_football_id", apiFootballTeamId)
    .maybeSingle();

  // Sinon par name_normalized
  if (!team) {
    const { data: teamByName } = await supabaseAdmin
      .from("o05_teams")
      .select("id, name, name_normalized, api_football_id")
      .eq("league_id", leagueId)
      .eq("name_normalized", dbNormalizedName)
      .maybeSingle();
    team = teamByName;

    // Mettre a jour api_football_id si on l'a trouve par nom
    if (team && !team.api_football_id) {
      await supabaseAdmin
        .from("o05_teams")
        .update({ api_football_id: apiFootballTeamId })
        .eq("id", team.id);
    }
  }

  // Sinon, creer l'equipe (pour les championnats hors L1/PL/LL)
  if (!team) {
    const { data: created, error } = await supabaseAdmin
      .from("o05_teams")
      .insert({
        league_id: leagueId,
        name: apiFootballTeamName,
        name_normalized: normalizeTeamName(apiFootballTeamName),
        api_football_id: apiFootballTeamId,
      })
      .select("id, name, name_normalized")
      .single();

    if (error || !created) {
      console.error(`[run-analysis] Failed to create team ${apiFootballTeamName}:`, error?.message);
      return null;
    }
    // Team créée sans PROJET (championnat non couvert pour l'instant)
    return {
      team_id: created.id,
      team_name: created.name,
      name_normalized: created.name_normalized,
      current_rank: null,
      avg_rank_historical: null,
      category: null,
      project_bonus: 0,
    };
  }

  // 2. Charger le PROJET de cette equipe (peut etre null)
  const { data: project } = await supabaseAdmin
    .from("o05_projects")
    .select("current_rank, avg_rank_historical, category")
    .eq("team_id", team.id)
    .maybeSingle();

  const project_bonus = project
    ? computeProjectBonus(project.current_rank, project.avg_rank_historical)
    : 0;

  return {
    team_id: team.id,
    team_name: team.name,
    name_normalized: team.name_normalized,
    current_rank: project?.current_rank ?? null,
    avg_rank_historical: project?.avg_rank_historical ?? null,
    category: project?.category ?? null,
    project_bonus,
  };
}


// ─── Handler ──────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Auth interne
  const secret = req.headers.get("x-internal-secret");
  const expectedSecret = process.env.CRON_SECRET ?? "PronosClub2026CronAuto";
  if (secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse body
  let body: { analysis_id: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!body.analysis_id) {
    return NextResponse.json({ error: "Missing analysis_id" }, { status: 400 });
  }

  // Charger l'analyse
  const { data: analysis, error: analysisErr } = await supabaseAdmin
    .from("o05_analyses")
    .select("id, league_id, date_from, date_to, status")
    .eq("id", body.analysis_id)
    .single();

  if (analysisErr || !analysis) {
    return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
  }

  if (analysis.status !== "pending") {
    return NextResponse.json({
      ok: false,
      reason: `Analysis already in status '${analysis.status}'`,
    });
  }

  // Charger le championnat
  const { data: league } = await supabaseAdmin
    .from("o05_leagues")
    .select("id, api_football_id, name, xg_source, is_top5, understat_slug")
    .eq("id", analysis.league_id)
    .single();

  if (!league) {
    await markFailed(body.analysis_id, "League not found");
    return NextResponse.json({ error: "League not found" }, { status: 404 });
  }

  // ─── Validation Q1=A : verifier que le championnat a des PROJETS seedes ───
  const { count: projectCount } = await supabaseAdmin
    .from("o05_projects")
    .select("id", { count: "exact", head: true })
    .in(
      "team_id",
      (
        await supabaseAdmin
          .from("o05_teams")
          .select("id")
          .eq("league_id", league.id)
      ).data?.map((t) => t.id) ?? []
    );

  if (!projectCount || projectCount === 0) {
    await markFailed(
      body.analysis_id,
      `Le championnat "${league.name}" n'a pas de PROJETS seedes en DB. ` +
      `Importer les PROJETS depuis l'Excel Bertrand avant d'analyser ce championnat.`
    );
    return NextResponse.json({ error: "PROJETS missing" });
  }

  // ─── Validation Q3 : Understat couvre-t-il ce championnat ? ───
  if (league.xg_source !== "understat") {
    await markFailed(
      body.analysis_id,
      `Le championnat "${league.name}" utilise ${league.xg_source} comme source xG. ` +
      `La Phase 3 ne supporte qu'Understat (5 grands championnats). ` +
      `Le support SofaScore arrivera en Phase 5.`
    );
    return NextResponse.json({ error: "Source xG non supportee en Phase 3" });
  }

  // Passer en running
  await supabaseAdmin
    .from("o05_analyses")
    .update({ status: "running" })
    .eq("id", body.analysis_id);

  // Recuperer les fixtures
  const currentSeason = getCurrentApiFootballSeason();
  let fixtures: O05Fixture[];
  try {
    fixtures = await getO05FixturesByDateRange(
      league.api_football_id,
      currentSeason,
      analysis.date_from,
      analysis.date_to
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown";
    await markFailed(body.analysis_id, `API-Football error: ${msg}`);
    return NextResponse.json({ error: "Fixtures fetch failed" });
  }

  await supabaseAdmin
    .from("o05_analyses")
    .update({ total_matches: fixtures.length })
    .eq("id", body.analysis_id);

  // ─── Pre-charger les categories de toutes les equipes du championnat ───
  // (utile pour le coef niveau adversaire dans stats-aggregator)
  const { data: allLeagueTeams } = await supabaseAdmin
    .from("o05_teams")
    .select("name, o05_projects(category)")
    .eq("league_id", league.id);

  // Construire une Map "Understat opponent name -> category"
  // Comme Understat utilise des noms anglicises ("Atletico Madrid"), on tente
  // une fuzzy match : on indexe par nom DB ET on accepte les variantes courantes.
  const opponentCategories = new Map<string, string | null>();
  if (allLeagueTeams) {
    for (const t of allLeagueTeams) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cat = ((t.o05_projects as any[])?.[0]?.category) ?? null;
      // Ajout par nom direct
      opponentCategories.set(t.name, cat);
      // Ajout par nom normalise pour fuzzy match
      opponentCategories.set(normalizeTeamName(t.name), cat);
    }
  }

  // ─── Pour chaque fixture : analyse complète ───
  let analyzedCount = 0;
  let failedCount = 0;

  for (const fixture of fixtures) {
    try {
      // 1. Resoudre les 2 equipes avec leur PROJET
      const homeTeam = await resolveTeamWithProject(
        league.id,
        fixture.teams.home.id,
        fixture.teams.home.name
      );
      const awayTeam = await resolveTeamWithProject(
        league.id,
        fixture.teams.away.id,
        fixture.teams.away.name
      );

      if (!homeTeam || !awayTeam) {
        await insertFailedMatch(
          body.analysis_id,
          fixture,
          homeTeam?.team_id ?? 0,
          awayTeam?.team_id ?? 0,
          "Failed to resolve teams"
        );
        failedCount++;
        await updateProgress(body.analysis_id, analyzedCount, failedCount);
        continue;
      }

      // 2. Identifier le favori intrinseque
      const favori = resolveFavoriIntrinseque({
        home_team_id: homeTeam.team_id,
        away_team_id: awayTeam.team_id,
        home_project: homeTeam.category
          ? {
              category: homeTeam.category as
                | "ELITE" | "EUROPE" | "AMBITIEUX" | "MILIEU" | "MAINTIEN",
              avg_rank_historical: homeTeam.avg_rank_historical,
            }
          : null,
        away_project: awayTeam.category
          ? {
              category: awayTeam.category as
                | "ELITE" | "EUROPE" | "AMBITIEUX" | "MILIEU" | "MAINTIEN",
              avg_rank_historical: awayTeam.avg_rank_historical,
            }
          : null,
      });

      // 3. Determiner cible et adversaire
      const target = favori.target_role === "home" ? homeTeam : awayTeam;
      const opponent = favori.target_role === "home" ? awayTeam : homeTeam;
      const matchDate = new Date(fixture.fixture.date);

      // 4. Recuperer les stats des 3 derniers matchs de la cible (attaque)
      const targetStats = await fetchTeamStatsUnderstat(
        target.name_normalized,
        currentSeason,
        matchDate,
        opponentCategories,
        3
      );

      // 5. Recuperer les stats des 3 derniers matchs de l'adversaire (defense)
      const opponentStats = await fetchTeamStatsUnderstat(
        opponent.name_normalized,
        currentSeason,
        matchDate,
        opponentCategories,
        3
      );

      // Si AUCUNE des 2 equipes n'a de stats, on marque le match en erreur
      if (
        targetStats.data_quality === "missing" &&
        opponentStats.data_quality === "missing"
      ) {
        await insertFailedMatch(
          body.analysis_id,
          fixture,
          homeTeam.team_id,
          awayTeam.team_id,
          `Stats Understat indisponibles : ${[
            ...targetStats.errors,
            ...opponentStats.errors,
          ].join(" | ")}`,
          target.team_id,
          favori.target_role
        );
        failedCount++;
        await updateProgress(body.analysis_id, analyzedCount, failedCount);
        continue;
      }

      // 6. Calculer les bonus PROJET
      const attack_bonus_projet = target.project_bonus;
      // Pour la defense, le bonus est inversé : si l'adversaire sous-performe
      // (bonus +1 chez lui), c'est mauvais pour sa défense -> on hérite +1.
      const defense_bonus_projet = opponent.project_bonus;

      // 7. Scorer
      const scoring = computeScoring(
        targetStats.attack,
        opponentStats.defense,
        favori.target_role,
        attack_bonus_projet,
        defense_bonus_projet
      );

      // 8. Determiner la qualité globale des données (la pire des 2)
      let data_quality: "complete" | "partial" | "missing" = "complete";
      if (
        targetStats.data_quality === "missing" ||
        opponentStats.data_quality === "missing"
      )
        data_quality = "missing";
      else if (
        targetStats.data_quality === "partial" ||
        opponentStats.data_quality === "partial"
      )
        data_quality = "partial";

      // 9. INSERT du resultat complet
      const { error: insertErr } = await supabaseAdmin
        .from("o05_match_analyses")
        .insert({
          analysis_id: body.analysis_id,
          api_football_fixture_id: fixture.fixture.id,
          match_date: fixture.fixture.date,
          home_team_id: homeTeam.team_id,
          away_team_id: awayTeam.team_id,
          target_team_id: target.team_id,
          target_role: favori.target_role,
          // Attaque
          attack_xg_weighted: targetStats.attack.xg_weighted,
          attack_tc_weighted: targetStats.attack.tc_weighted,
          attack_go_weighted: targetStats.attack.go_weighted,
          attack_goals_weighted: targetStats.attack.goals_weighted,
          attack_efficiency:
            targetStats.attack.xg_weighted > 0
              ? Math.round(
                  (targetStats.attack.goals_weighted /
                    targetStats.attack.xg_weighted) *
                    100
                ) / 100
              : null,
          attack_score: scoring.attack_score,
          attack_bonus_projet,
          // Defense
          defense_xgc_weighted: opponentStats.defense.xgc_weighted,
          defense_tc_subis_weighted: opponentStats.defense.tc_subis_weighted,
          defense_go_conceded_weighted:
            opponentStats.defense.go_conceded_weighted,
          defense_goals_conceded_weighted:
            opponentStats.defense.goals_conceded_weighted,
          defense_clean_sheets: opponentStats.defense.clean_sheets,
          defense_score: scoring.defense_score,
          defense_bonus_projet,
          // Bonus/Malus
          matchup_bonus: scoring.matchup_bonus,
          home_bonus: scoring.home_bonus,
          closed_match_malus: scoring.closed_match_malus,
          // Total
          total_score: scoring.total_score,
          note_10: scoring.note_10,
          verdict: scoring.verdict,
          // Metadata
          data_source: "understat",
          data_quality,
          raw_data: {
            favori_reason: favori.reason,
            target_matches: targetStats.raw_matches,
            opponent_matches: opponentStats.raw_matches,
            attack_breakdown: scoring.attack_breakdown,
            defense_breakdown: scoring.defense_breakdown,
            errors: [...targetStats.errors, ...opponentStats.errors],
          },
        });

      if (insertErr) {
        console.error(`[run-analysis] Insert match error:`, insertErr.message);
        failedCount++;
      } else {
        analyzedCount++;
      }

      await updateProgress(body.analysis_id, analyzedCount, failedCount);
    } catch (err) {
      console.error(
        `[run-analysis] Fatal error on fixture ${fixture.fixture.id}:`,
        err instanceof Error ? err.message : err
      );
      failedCount++;
      await updateProgress(body.analysis_id, analyzedCount, failedCount);
    }
  }

  // Finaliser
  await supabaseAdmin
    .from("o05_analyses")
    .update({
      status: "completed",
      matches_analyzed: analyzedCount,
      matches_failed: failedCount,
      completed_at: new Date().toISOString(),
    })
    .eq("id", body.analysis_id);

  return NextResponse.json({
    ok: true,
    analysis_id: body.analysis_id,
    total_matches: fixtures.length,
    matches_analyzed: analyzedCount,
    matches_failed: failedCount,
  });
}


// ─── Helpers ──────────────────────────────────────────────────────

async function markFailed(analysisId: string, errorMessage: string) {
  await supabaseAdmin
    .from("o05_analyses")
    .update({
      status: "failed",
      error_message: errorMessage,
      completed_at: new Date().toISOString(),
    })
    .eq("id", analysisId);
}

async function updateProgress(
  analysisId: string,
  analyzed: number,
  failed: number
) {
  await supabaseAdmin
    .from("o05_analyses")
    .update({
      matches_analyzed: analyzed,
      matches_failed: failed,
    })
    .eq("id", analysisId);
}

async function insertFailedMatch(
  analysisId: string,
  fixture: O05Fixture,
  homeTeamId: number,
  awayTeamId: number,
  errorMessage: string,
  targetTeamId?: number,
  targetRole?: "home" | "away"
) {
  await supabaseAdmin.from("o05_match_analyses").insert({
    analysis_id: analysisId,
    api_football_fixture_id: fixture.fixture.id,
    match_date: fixture.fixture.date,
    home_team_id: homeTeamId,
    away_team_id: awayTeamId,
    target_team_id: targetTeamId ?? homeTeamId,
    target_role: targetRole ?? "home",
    data_quality: "missing",
    error_message: errorMessage,
  });
}