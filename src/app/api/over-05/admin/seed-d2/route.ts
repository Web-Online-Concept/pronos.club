// src/app/api/over-05/admin/seed-d2/route.ts
//
// POST /api/over-05/admin/seed-d2
//
// Route admin pour seeder les PROJETS de 3 championnats hors Top 5 :
//   - Ligue 2 (league_id DB = 6, API-Football = 62)
//   - Championship (league_id DB = 7, API-Football = 40)
//   - Serie B (league_id DB = 10, API-Football = 136)
//
// Memes seuils de categorisation auto que pour Bundesliga/Serie A.
// Bertrand pourra ajuster manuellement plus tard via Supabase.

import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getO05Standings } from "@/lib/over-05-buts-equipes/apifootball-standings";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Championnats a seeder pour ce test
const LEAGUES_TO_SEED = [
  { db_id: 6,  api_football_id: 62,  name: "Ligue 2" },
  { db_id: 7,  api_football_id: 40,  name: "Championship" },
  { db_id: 10, api_football_id: 136, name: "Serie B" },
];

// Saisons API-Football : 24/25, 23/24, 22/23, 21/22, 20/21
const SEASONS_TO_FETCH = [2024, 2023, 2022, 2021, 2020];


// ─── Normalisation nom equipe ─────────────────────────────────────

function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, "_");
}


// ─── Categorisation automatique ───────────────────────────────────

function categorize(avgRank: number): "ELITE" | "EUROPE" | "AMBITIEUX" | "MILIEU" | "MAINTIEN" {
  if (avgRank <= 3.0) return "ELITE";
  if (avgRank <= 7.0) return "EUROPE";
  if (avgRank <= 11.0) return "AMBITIEUX";
  if (avgRank <= 15.0) return "MILIEU";
  return "MAINTIEN";
}


// ─── Handler ──────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Auth
  const secret = req.headers.get("x-internal-secret");
  if (secret !== (process.env.CRON_SECRET ?? "PronosClub2026CronAuto")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const report: Array<{
    league: string;
    teams_seeded: number;
    projects_created: number;
    errors: string[];
    teams_detail: Array<{
      team: string;
      ranks: number[];
      avg: number;
      category: string;
    }>;
  }> = [];

  for (const league of LEAGUES_TO_SEED) {
    const leagueReport = {
      league: league.name,
      teams_seeded: 0,
      projects_created: 0,
      errors: [] as string[],
      teams_detail: [] as Array<{
        team: string;
        ranks: number[];
        avg: number;
        category: string;
      }>,
    };

    try {
      const currentStandings = await getO05Standings(league.api_football_id, 2025);

      if (!currentStandings || currentStandings.length === 0) {
        leagueReport.errors.push(`No standings for current season ${league.name}`);
        report.push(leagueReport);
        continue;
      }

      const standingsBySeason = new Map<number, Awaited<ReturnType<typeof getO05Standings>>>();
      for (const season of SEASONS_TO_FETCH) {
        try {
          const s = await getO05Standings(league.api_football_id, season);
          standingsBySeason.set(season, s);
        } catch (err) {
          leagueReport.errors.push(
            `Failed to fetch ${league.name} season ${season}: ${err instanceof Error ? err.message : "?"}`
          );
          standingsBySeason.set(season, null);
        }
      }

      for (const teamEntry of currentStandings) {
        const teamName = teamEntry.team.name;
        const apiFootballTeamId = teamEntry.team.id;

        try {
          const ranks: number[] = [];
          for (const season of SEASONS_TO_FETCH) {
            const standings = standingsBySeason.get(season);
            if (!standings) {
              ranks.push(21);
              continue;
            }
            const found = standings.find((s) => s.team.id === apiFootballTeamId);
            ranks.push(found ? found.rank : 21);
          }

          const avg = ranks.reduce((a, b) => a + b, 0) / ranks.length;
          const avgRounded = Math.round(avg * 100) / 100;
          const category = categorize(avg);

          leagueReport.teams_detail.push({
            team: teamName,
            ranks,
            avg: avgRounded,
            category,
          });

          const nameNormalized = normalizeTeamName(teamName);
          const { data: existingTeam } = await supabaseAdmin
            .from("o05_teams")
            .select("id")
            .eq("league_id", league.db_id)
            .eq("name_normalized", nameNormalized)
            .maybeSingle();

          let teamDbId: number;
          if (existingTeam) {
            await supabaseAdmin
              .from("o05_teams")
              .update({ api_football_id: apiFootballTeamId })
              .eq("id", existingTeam.id);
            teamDbId = existingTeam.id;
          } else {
            const { data: created, error: createErr } = await supabaseAdmin
              .from("o05_teams")
              .insert({
                league_id: league.db_id,
                name: teamName,
                name_normalized: nameNormalized,
                api_football_id: apiFootballTeamId,
              })
              .select("id")
              .single();
            if (createErr || !created) {
              leagueReport.errors.push(`Failed to insert team ${teamName}: ${createErr?.message}`);
              continue;
            }
            teamDbId = created.id;
            leagueReport.teams_seeded++;
          }

          const { data: existingProject } = await supabaseAdmin
            .from("o05_projects")
            .select("id")
            .eq("team_id", teamDbId)
            .maybeSingle();

          const projectData = {
            team_id: teamDbId,
            rank_24_25: ranks[0],
            rank_23_24: ranks[1],
            rank_22_23: ranks[2],
            rank_21_22: ranks[3],
            rank_20_21: ranks[4],
            avg_rank_historical: avgRounded,
            category,
            current_rank: teamEntry.rank,
            source: "auto",
          };

          if (existingProject) {
            const { error: updateErr } = await supabaseAdmin
              .from("o05_projects")
              .update(projectData)
              .eq("id", existingProject.id);
            if (updateErr) {
              leagueReport.errors.push(`Update project ${teamName}: ${updateErr.message}`);
            }
          } else {
            const { error: insertErr } = await supabaseAdmin
              .from("o05_projects")
              .insert(projectData);
            if (insertErr) {
              leagueReport.errors.push(`Insert project ${teamName}: ${insertErr.message}`);
              continue;
            }
            leagueReport.projects_created++;
          }
        } catch (err) {
          leagueReport.errors.push(
            `Team ${teamName} error: ${err instanceof Error ? err.message : "?"}`
          );
        }
      }
    } catch (err) {
      leagueReport.errors.push(
        `League ${league.name} fatal error: ${err instanceof Error ? err.message : "?"}`
      );
    }

    report.push(leagueReport);
  }

  return NextResponse.json({
    ok: true,
    summary: report.map((r) => ({
      league: r.league,
      teams_seeded: r.teams_seeded,
      projects_created: r.projects_created,
      errors_count: r.errors.length,
    })),
    detail: report,
  });
}


// GET = preview (test)
export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-internal-secret");
  if (secret !== (process.env.CRON_SECRET ?? "PronosClub2026CronAuto")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    info: "POST cette route pour seeder Ligue 2 + Championship + Serie B",
    leagues_to_seed: LEAGUES_TO_SEED.map((l) => `${l.name} (DB ${l.db_id})`),
    seasons_fetched: SEASONS_TO_FETCH.map((s) => `${s}-${s + 1}`),
  });
}