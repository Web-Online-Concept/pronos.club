// src/app/api/over-05/_internal/run-analysis/route.ts
//
// POST /api/over-05/_internal/run-analysis
// Body: { analysis_id }
//
// JOB BACKGROUND — appelé en fire-and-forget par /api/over-05/analyze.
//
// Auth : header x-internal-secret partagé (pas de session user)
//
// Phase 2 (cette version) : squelette qui :
//   1. Vérifie l'auth interne
//   2. Charge l'analyse
//   3. Fetch les fixtures de la plage de dates via API-Football
//   4. Update total_matches et passe status='running'
//   5. Pour CHAQUE fixture, crée une ligne o05_match_analyses VIDE
//      (les champs de scoring sont null pour l'instant)
//   6. Passe status='completed'
//
// Phase 3 enrichira ce job avec :
//   - Identification du favori intrinsèque (via PROJETS)
//   - Récupération des stats Understat/SofaScore
//   - Calcul des scores attack/defense/total
//   - UPDATE de o05_match_analyses avec les vraies valeurs

import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import {
  getO05FixturesByDateRange,
  type O05Fixture,
} from "@/lib/over-05-buts-equipes/apifootball-fixtures";
import { getCurrentApiFootballSeason } from "@/lib/over-05-buts-equipes/season-helper";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min max (Phase 3 utilisera plus)

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);


// ─── Helpers ──────────────────────────────────────────────────────

/**
 * Crée ou récupère une équipe dans o05_teams par api_football_id.
 * Utilisé pour les équipes qui ne sont pas encore dans la DB (championnats
 * autres que L1/PL/La Liga qui sont seedés).
 */
async function getOrCreateTeam(
  leagueId: number,
  apiFootballId: number,
  name: string
): Promise<number> {
  // Chercher d'abord par api_football_id
  const { data: existing } = await supabaseAdmin
    .from("o05_teams")
    .select("id")
    .eq("league_id", leagueId)
    .eq("api_football_id", apiFootballId)
    .maybeSingle();

  if (existing) return existing.id;

  // Sinon, chercher par nom normalisé (cas où on a seedé via Excel sans api_football_id)
  const normalized = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, "_");

  const { data: byName } = await supabaseAdmin
    .from("o05_teams")
    .select("id, api_football_id")
    .eq("league_id", leagueId)
    .eq("name_normalized", normalized)
    .maybeSingle();

  if (byName) {
    // Mettre à jour avec l'api_football_id si manquant
    if (!byName.api_football_id) {
      await supabaseAdmin
        .from("o05_teams")
        .update({ api_football_id: apiFootballId })
        .eq("id", byName.id);
    }
    return byName.id;
  }

  // Sinon, créer
  const { data: created, error } = await supabaseAdmin
    .from("o05_teams")
    .insert({
      league_id: leagueId,
      name,
      name_normalized: normalized,
      api_football_id: apiFootballId,
    })
    .select("id")
    .single();

  if (error || !created) {
    throw new Error(`Failed to create team: ${error?.message}`);
  }

  return created.id;
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
    return NextResponse.json(
      { error: "Missing analysis_id" },
      { status: 400 }
    );
  }

  // Charger l'analyse
  const { data: analysis, error: analysisErr } = await supabaseAdmin
    .from("o05_analyses")
    .select("id, league_id, date_from, date_to, status")
    .eq("id", body.analysis_id)
    .single();

  if (analysisErr || !analysis) {
    return NextResponse.json(
      { error: "Analysis not found" },
      { status: 404 }
    );
  }

  // Empêcher re-run d'une analyse déjà completed/running
  if (analysis.status !== "pending") {
    return NextResponse.json({
      ok: false,
      reason: `Analysis already in status '${analysis.status}'`,
    });
  }

  // Charger le championnat pour avoir l'api_football_id
  const { data: league, error: leagueErr } = await supabaseAdmin
    .from("o05_leagues")
    .select("id, api_football_id, name")
    .eq("id", analysis.league_id)
    .single();

  if (leagueErr || !league) {
    await markFailed(body.analysis_id, "League not found");
    return NextResponse.json(
      { error: "League not found" },
      { status: 404 }
    );
  }

  // Passer en running
  await supabaseAdmin
    .from("o05_analyses")
    .update({ status: "running" })
    .eq("id", body.analysis_id);

  // Récupérer les fixtures
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

  // Update total_matches
  await supabaseAdmin
    .from("o05_analyses")
    .update({ total_matches: fixtures.length })
    .eq("id", body.analysis_id);

  // ─── PHASE 2 : on crée des lignes match_analyses VIDES pour chaque fixture
  // ─── PHASE 3 enrichira avec les calculs réels
  let analyzedCount = 0;
  let failedCount = 0;

  for (const fixture of fixtures) {
    try {
      const homeTeamId = await getOrCreateTeam(
        league.id,
        fixture.teams.home.id,
        fixture.teams.home.name
      );
      const awayTeamId = await getOrCreateTeam(
        league.id,
        fixture.teams.away.id,
        fixture.teams.away.name
      );

      // Placeholder : target_team = home par défaut (sera recalculé en Phase 3)
      const { error: insertErr } = await supabaseAdmin
        .from("o05_match_analyses")
        .insert({
          analysis_id: body.analysis_id,
          api_football_fixture_id: fixture.fixture.id,
          match_date: fixture.fixture.date,
          home_team_id: homeTeamId,
          away_team_id: awayTeamId,
          target_team_id: homeTeamId, // placeholder Phase 2
          target_role: "home",
          data_source: null,
          data_quality: "missing",
          error_message: "Phase 2 - calcul non implémenté (sera fait en Phase 3)",
        });

      if (insertErr) {
        console.error(
          "[run-analysis] Insert error for fixture",
          fixture.fixture.id,
          insertErr.message
        );
        failedCount++;
      } else {
        analyzedCount++;
      }

      // Update progression au fur et à mesure (permet au polling de voir l'avancement)
      await supabaseAdmin
        .from("o05_analyses")
        .update({
          matches_analyzed: analyzedCount,
          matches_failed: failedCount,
        })
        .eq("id", body.analysis_id);
    } catch (err) {
      console.error(
        "[run-analysis] Match error for fixture",
        fixture.fixture.id,
        err instanceof Error ? err.message : err
      );
      failedCount++;
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


// ─── Helper d'erreur ──────────────────────────────────────────────

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