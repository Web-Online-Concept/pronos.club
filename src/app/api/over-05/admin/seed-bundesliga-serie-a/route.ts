// src/app/api/over-05/admin/seed-bundesliga-serie-a/route.ts
//
// POST /api/over-05/admin/seed-bundesliga-serie-a
//
// Route ADMIN one-shot pour seeder les PROJETS de Bundesliga + Serie A.
// Recupere automatiquement les 5 dernieres saisons via API-Football et
// determine la categorie sportive selon la moyenne historique.
//
// Auth : header x-internal-secret (idem cron secret)
//
// SEUILS DE CATEGORISATION AUTOMATIQUE :
//   Moyenne historique :
//     1.0  - 3.0  -> ELITE
//     3.01 - 7.0  -> EUROPE
//     7.01 - 11.0 -> AMBITIEUX
//     11.01 - 15.0 -> MILIEU
//     > 15  -> MAINTIEN
//
// Note : ces categories sont approximatives. Bertrand pourra les ajuster
// manuellement plus tard via Supabase (UPDATE direct).

import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getO05Standings } from "@/lib/over-05-buts-equipes/apifootball-standings";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Championnats a seeder
const LEAGUES_TO_SEED = [
  { db_id: 4, api_football_id: 78, name: "Bundesliga" },
  { db_id: 5, api_football_id: 135, name: "Serie A" },
];

// Saisons API-Football (annee de demarrage)
//   2025 = saison 2025-26 (actuelle)
//   2024 = 23/24 historique pour le PROJET
//   etc.
// On veut les 5 dernieres : 24/25, 23/24, 22/23, 21/22, 20/21
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
      // 1. Recuperer la saison en cours pour avoir la liste des equipes
      const currentStandings = await getO05Standings(league.api_football_id, 2025);

      if (!currentStandings || currentStandings.length === 0) {
        leagueReport.errors.push(`No standings for current season ${league.name}`);
        report.push(leagueReport);
        continue;
      }

      // 2. Pre-charger les standings de chaque saison historique (1 fois par saison)
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

      // 3. Pour chaque equipe de la saison en cours, calculer son historique
      for (const teamEntry of currentStandings) {
        const teamName = teamEntry.team.name;
        const apiFootballTeamId = teamEntry.team.id;

        try {
          // Recuperer les rangs historiques (21 si non present)
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

          // Calcul moyenne
          const avg = ranks.reduce((a, b) => a + b, 0) / ranks.length;
          const avgRounded = Math.round(avg * 100) / 100;

          // Categorisation
          const category = categorize(avg);

          leagueReport.teams_detail.push({
            team: teamName,
            ranks,
            avg: avgRounded,
            category,
          });

          // 4. UPSERT dans o05_teams
          const nameNormalized = normalizeTeamName(teamName);
          const { data: existingTeam } = await supabaseAdmin
            .from("o05_teams")
            .select("id")
            .eq("league_id", league.db_id)
            .eq("name_normalized", nameNormalized)
            .maybeSingle();

          let teamDbId: number;
          if (existingTeam) {
            // Update api_football_id si manquant
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

          // 5. UPSERT dans o05_projects
          // ranks order : [2024, 2023, 2022, 2021, 2020]
          //              = [24/25, 23/24, 22/23, 21/22, 20/21]
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


// GET = preview sans modification (test)
export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-internal-secret");
  if (secret !== (process.env.CRON_SECRET ?? "PronosClub2026CronAuto")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    info: "POST cette route pour seeder Bundesliga + Serie A depuis API-Football",
    leagues_to_seed: LEAGUES_TO_SEED.map((l) => l.name),
    seasons_fetched: SEASONS_TO_FETCH.map((s) => `${s}-${s + 1}`),
    seuils_categorisation: {
      "ELITE": "moyenne <= 3.0",
      "EUROPE": "moyenne 3.01 - 7.0",
      "AMBITIEUX": "moyenne 7.01 - 11.0",
      "MILIEU": "moyenne 11.01 - 15.0",
      "MAINTIEN": "moyenne > 15.0",
    },
  });
}