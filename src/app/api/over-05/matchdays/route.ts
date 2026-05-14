// src/app/api/over-05/matchdays/route.ts
//
// GET /api/over-05/matchdays?league_id=X
// → Retourne la liste des "journées" disponibles d'un championnat,
//   pour la saison API-Football en cours.
//
// L'utilisateur Bertrand sélectionnera une de ces journées avant
// de cliquer "Analyser".
//
// Source : API-Football endpoint /fixtures (regroupement par "round")

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { isO05Authorized } from "@/lib/over-05-buts-equipes/auth";
import { getO05FixturesByDateRange } from "@/lib/over-05-buts-equipes/apifootball-fixtures";
import { getCurrentApiFootballSeason } from "@/lib/over-05-buts-equipes/season-helper";
import type { MatchdayOption } from "@/lib/over-05-buts-equipes/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);


export async function GET(req: NextRequest) {
  // Auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isO05Authorized(user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Validation params
  const { searchParams } = new URL(req.url);
  const leagueIdRaw = searchParams.get("league_id");
  if (!leagueIdRaw) {
    return NextResponse.json(
      { error: "Missing required param: league_id" },
      { status: 400 }
    );
  }
  const leagueId = parseInt(leagueIdRaw, 10);
  if (Number.isNaN(leagueId)) {
    return NextResponse.json(
      { error: "Invalid league_id" },
      { status: 400 }
    );
  }

  // Récupérer le championnat depuis la DB
  const { data: league, error: leagueErr } = await supabaseAdmin
    .from("o05_leagues")
    .select("id, api_football_id, name")
    .eq("id", leagueId)
    .single();

  if (leagueErr || !league) {
    return NextResponse.json(
      { error: "League not found" },
      { status: 404 }
    );
  }

  const currentSeason = getCurrentApiFootballSeason();

  // Fetch les fixtures de la saison en cours sur une plage large.
  // On prend une fenêtre de 4 mois autour de la date du jour pour
  // récupérer les matchs récents (analysables a posteriori) + à venir
  // (analysables a priori pour parier).
  const now = new Date();
  const dateFrom = new Date(now);
  dateFrom.setMonth(dateFrom.getMonth() - 2);
  const dateTo = new Date(now);
  dateTo.setMonth(dateTo.getMonth() + 2);

  const toIsoDate = (d: Date) => d.toISOString().split("T")[0];

  let fixtures;
  try {
    fixtures = await getO05FixturesByDateRange(
      league.api_football_id,
      currentSeason,
      toIsoDate(dateFrom),
      toIsoDate(dateTo)
    );
  } catch (err) {
    console.error("[o05-matchdays] API-Football error:", err);
    return NextResponse.json(
      {
        error: "Failed to fetch fixtures",
        details: err instanceof Error ? err.message : "Unknown",
      },
      { status: 502 }
    );
  }

  // Regrouper par "round" (ex: "Regular Season - 32")
  const byRound = new Map<
    string,
    { round: string; dates: string[]; count: number }
  >();

  for (const f of fixtures) {
    const round = f.league.round ?? "Unknown round";
    if (!byRound.has(round)) {
      byRound.set(round, { round, dates: [], count: 0 });
    }
    const entry = byRound.get(round)!;
    entry.dates.push(f.fixture.date);
    entry.count++;
  }

  // Transformer en MatchdayOption[]
  const matchdays: MatchdayOption[] = [];
  for (const entry of byRound.values()) {
    if (entry.count === 0) continue;

    // Date la plus tôt et la plus tard du round
    const sortedDates = entry.dates.slice().sort();
    const firstIso = sortedDates[0];
    const lastIso = sortedDates[sortedDates.length - 1];

    // Label "Journée 32" extrait de "Regular Season - 32"
    let label = entry.round;
    const matchNum = /(\d+)\s*$/.exec(entry.round);
    if (matchNum) {
      label = `Journée ${matchNum[1]}`;
    }

    matchdays.push({
      matchday_label: label,
      round_value: entry.round,
      date_from: firstIso.split("T")[0],
      date_to: lastIso.split("T")[0],
      match_count: entry.count,
      first_match_iso: firstIso,
    });
  }

  // Tri par date du premier match (plus récent en haut)
  matchdays.sort((a, b) =>
    b.first_match_iso.localeCompare(a.first_match_iso)
  );

  return NextResponse.json({
    league_id: league.id,
    league_name: league.name,
    current_season: currentSeason,
    matchdays,
  });
}