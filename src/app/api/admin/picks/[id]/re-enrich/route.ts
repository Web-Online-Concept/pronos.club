/**
 * PRONOS.CLUB — V3.5 Lot 19
 * Admin endpoint : POST /api/admin/picks/[id]/re-enrich
 *
 * Réenrichit un pick AI dont les stats équipe/joueur sont vides ou incomplètes
 * (typiquement parce qu'un timeout fetcher a planté l'enrichissement au moment
 * du drop initial).
 *
 * Workflow :
 *   1. Lit le pick depuis la BDD (id en URL)
 *   2. Appelle `reEnrichPick()` du multi-sport-fetcher (Lot 19) avec les infos
 *      du pick (sport, équipes, date, league)
 *   3. Construit un patch `odds_comparison` avec les nouveaux champs `fixture_*`
 *   4. MERGE le patch avec l'odds_comparison existant (préserve cotes,
 *      bookmakers_snapshot, telegram_published_at, etc.)
 *   5. UPDATE le pick en BDD
 *
 * Réponse :
 *   - 200 : { success: true, fields_updated: [...], stats: { ... } }
 *   - 401 : auth requise
 *   - 404 : pick introuvable
 *   - 500 : erreur enrichment
 *
 * Path : src/app/api/admin/picks/[id]/re-enrich/route.ts
 */

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { reEnrichPick } from "@/lib/ai-picks-v3/multi-sport-fetcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // re-enrich = ~10-30s, marge confortable

// ─── Type minimal du pick depuis BDD ────────────────────────────────────────
type AiPickRow = {
  id: string;
  sport: string;
  league: string;
  event_name: string;
  event_date: string;
  pick_type: string;
  apifootball_fixture_id: number | null;
  odds_comparison: Record<string, unknown> | null;
};

// ─── Type minimal du EnrichedFixture pour mapping ──────────────────────────
type EnrichedFixturePartial = {
  stats_equipe?: unknown;
  predictions_api?: unknown;
  classement?: unknown;
  h2h_reel?: unknown;
  pitchers?: unknown;
  records_fighters?: unknown;
  splits_dom_ext?: unknown;
  recent_matches_stats?: unknown;
  sidelined?: unknown;
  top_scorers_league?: unknown;
  tennis_past_matches?: unknown;
  tennis_tournament_record?: unknown;
  tennis_career_stats?: unknown;
  tennis_finals_titles?: unknown;
  rugby_stats?: unknown;
  handball_stats?: unknown;
  f1_race?: unknown;
  f1_drivers?: unknown;
  home_team?: string;
  away_team?: string;
  forme_5_derniers?: string;
  h2h_5_derniers?: string;
  apifootball_fixture_id?: number | null;
};

// ─── Helper : construit le patch odds_comparison depuis EnrichedFixture ────
const buildPatchFromFixture = (
  fixture: EnrichedFixturePartial
): Record<string, unknown> => {
  const patch: Record<string, unknown> = {};

  // V3 — stats foot, prédictions, classement, H2H, pitchers, MMA
  if (fixture.stats_equipe)     patch.fixture_stats_equipe    = fixture.stats_equipe;
  if (fixture.predictions_api)  patch.fixture_predictions     = fixture.predictions_api;
  if (fixture.classement)       patch.fixture_classement      = fixture.classement;
  if (fixture.h2h_reel)         patch.fixture_h2h_reel        = fixture.h2h_reel;
  if (fixture.pitchers)         patch.fixture_pitchers        = fixture.pitchers;
  if (fixture.records_fighters) patch.fixture_records_fighters = fixture.records_fighters;

  // V3.5 — Football enrichi
  if (fixture.splits_dom_ext)       patch.fixture_splits_dom_ext       = fixture.splits_dom_ext;
  if (fixture.recent_matches_stats) patch.fixture_recent_matches_stats = fixture.recent_matches_stats;
  if (fixture.sidelined)            patch.fixture_sidelined            = fixture.sidelined;
  if (fixture.top_scorers_league)   patch.fixture_top_scorers_league   = fixture.top_scorers_league;

  // V3.5 — Tennis enrichi
  if (fixture.tennis_past_matches)      patch.fixture_tennis_past_matches      = fixture.tennis_past_matches;
  if (fixture.tennis_tournament_record) patch.fixture_tennis_tournament_record = fixture.tennis_tournament_record;
  if (fixture.tennis_career_stats)      patch.fixture_tennis_career_stats      = fixture.tennis_career_stats;
  if (fixture.tennis_finals_titles)     patch.fixture_tennis_finals_titles     = fixture.tennis_finals_titles;

  // V3.5 — Rugby / Handball / F1
  if (fixture.rugby_stats)    patch.fixture_rugby_stats    = fixture.rugby_stats;
  if (fixture.handball_stats) patch.fixture_handball_stats = fixture.handball_stats;
  if (fixture.f1_race)        patch.fixture_f1_race        = fixture.f1_race;
  if (fixture.f1_drivers)     patch.fixture_f1_drivers     = fixture.f1_drivers;

  // Métadonnées générales
  if (fixture.home_team) patch.fixture_home_team = fixture.home_team;
  if (fixture.away_team) patch.fixture_away_team = fixture.away_team;

  return patch;
};

// ─── Helper : extrait home_team / away_team depuis event_name ──────────────
// event_name est typiquement "Hartberg vs Sturm Graz" pour les sports d'équipe,
// ou "Casper Ruud vs Jiri Lehecka" pour le tennis.
const extractTeams = (
  eventName: string
): { home: string; away: string } | null => {
  const match = eventName.match(/^(.+?)\s+vs\s+(.+?)$/i);
  if (!match) return null;
  return { home: match[1].trim(), away: match[2].trim() };
};

// ============================================================================
// HANDLER POST
// ============================================================================

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json(
      { error: "Unauthorized — admin only" },
      { status: 401 }
    );
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json(
      { error: "Pick id manquant dans l'URL" },
      { status: 400 }
    );
  }

  // ── 1. Lire le pick depuis BDD
  const { data: pickData, error: fetchError } = await supabaseAdmin
    .from("ai_picks")
    .select(
      "id, sport, league, event_name, event_date, pick_type, apifootball_fixture_id, odds_comparison"
    )
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (fetchError || !pickData) {
    return NextResponse.json(
      { error: `Pick ${id} introuvable: ${fetchError?.message ?? "not found"}` },
      { status: 404 }
    );
  }

  const pick = pickData as AiPickRow;

  // ── 2. Refus si combiné (chaque sélection devrait être réenrichie séparément)
  if (pick.pick_type === "combine") {
    return NextResponse.json(
      { error: "Pick combiné : re-enrich pas supporté (multi-fixtures)" },
      { status: 400 }
    );
  }

  // ── 3. Extraire home/away depuis event_name
  const teams = extractTeams(pick.event_name);
  if (!teams) {
    return NextResponse.json(
      { error: `event_name invalide : "${pick.event_name}" (attendu "X vs Y")` },
      { status: 400 }
    );
  }

  // ── 4. Appeler reEnrichPick()
  const startedAt = Date.now();
  let enriched: EnrichedFixturePartial;
  try {
    const result = await reEnrichPick({
      sport: pick.sport,
      league: pick.league,
      home_team: teams.home,
      away_team: teams.away,
      commence_time_iso: pick.event_date,
      apifootball_fixture_id: pick.apifootball_fixture_id,
    });
    enriched = result as EnrichedFixturePartial;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Erreur enrichment: ${errMsg}` },
      { status: 500 }
    );
  }

  const enrichDurationMs = Date.now() - startedAt;

  // ── 5. Construire le patch
  const patch = buildPatchFromFixture(enriched);
  const fieldsUpdated = Object.keys(patch);

  if (fieldsUpdated.length === 0) {
    return NextResponse.json({
      success: false,
      message:
        "Re-enrich a tourné mais n'a retourné aucune donnée exploitable (sport non couvert ?)",
      enrich_duration_ms: enrichDurationMs,
      fields_updated: [],
    });
  }

  // ── 6. MERGE avec l'odds_comparison existant + UPDATE en BDD
  const currentOC = (pick.odds_comparison ?? {}) as Record<string, unknown>;
  const newOC: Record<string, unknown> = {
    ...currentOC,
    ...patch,
    re_enriched_at: new Date().toISOString(),
    re_enriched_fields: fieldsUpdated,
  };

  const { error: updateError } = await supabaseAdmin
    .from("ai_picks")
    .update({ odds_comparison: newOC })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json(
      { error: `UPDATE failed: ${updateError.message}` },
      { status: 500 }
    );
  }

  // ── 7. Réponse OK
  // Récap des champs où on a maintenant des données
  const home = (enriched.stats_equipe as { home?: unknown })?.home ?? null;
  const away = (enriched.stats_equipe as { away?: unknown })?.away ?? null;

  return NextResponse.json({
    success: true,
    pick_id: id,
    sport: pick.sport,
    event_name: pick.event_name,
    enrich_duration_ms: enrichDurationMs,
    fields_updated: fieldsUpdated,
    summary: {
      stats_equipe_home_present: home !== null,
      stats_equipe_away_present: away !== null,
      total_fields_updated: fieldsUpdated.length,
    },
  });
}