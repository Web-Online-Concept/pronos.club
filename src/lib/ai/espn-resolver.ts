/**
 * ═══════════════════════════════════════════════════════════════════
 * ESPN RESOLVER — Pronos IA
 * ═══════════════════════════════════════════════════════════════════
 *
 * Résout les picks "pending" en récupérant les résultats sur ESPN.
 *
 * Flow :
 *  1. Fetch tous les picks avec status='pending' ET event_date < NOW - 2h
 *  2. Pour chaque pick : récupère le match via ESPN summary
 *  3. Détermine won/lost/void selon le market et le résultat
 *  4. UPDATE la ligne en base avec status + final_score + resolved_at
 *
 * Ce module est appelé par le cron /api/crons/ai-picks-resolve.
 * ═══════════════════════════════════════════════════════════════════
 */

import { LEAGUES, type ESPNLeagueConfig } from "./espn-matches";
import { createClient } from "@supabase/supabase-js";


// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export interface ResolutionReport {
  success: boolean;
  startedAt: string;
  durationMs: number;

  picksChecked: number;
  picksResolved: number;
  picksStillPending: number;
  picksVoided: number;

  breakdown: {
    won: number;
    lost: number;
    void: number;
  };

  errors: string[];
  logId?: string;
}

/** Pick en base (ligne ai_picks) */
interface PendingPick {
  id: string;
  pick_type: "classic" | "scorer";
  sport: string;
  league: string;
  event_name: string;
  event_date: string;
  espn_event_id: string | null;
  selection: string;
  market: string;
  odds: number | null;
}

/** Résultat ESPN parsé pour un match */
interface MatchResult {
  completed: boolean;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  /** Pour le foot : liste des buteurs parsés */
  scorers: string[];
  /** Pour tennis : gagnant */
  winner: "home" | "away" | null;
  /** Données brutes pour audit */
  rawData: Record<string, unknown>;
}


// ═══════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports";
const FETCH_TIMEOUT_MS = 10000;

/** Nombre d'heures min après event_date pour tenter une résolution */
const MIN_HOURS_AFTER_EVENT = 2;

/** Nombre de jours max au-delà desquels un pick pending devient "void" */
const MAX_DAYS_TO_VOID = 3;


function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Supabase credentials manquantes");
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}


// ═══════════════════════════════════════════════════════════════════
// HELPER FETCH
// ═══════════════════════════════════════════════════════════════════

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "PronosClub-AI/1.0" },
      cache: "no-store",
    });
  } finally {
    clearTimeout(timeout);
  }
}


// ═══════════════════════════════════════════════════════════════════
// RÉCUPÉRATION DU RÉSULTAT D'UN MATCH
// ═══════════════════════════════════════════════════════════════════

/**
 * Récupère le résultat d'un match ESPN via l'endpoint summary.
 * Gère foot, tennis, basket.
 */
async function fetchMatchResult(
  espnEventId: string,
  league: ESPNLeagueConfig,
): Promise<MatchResult | null> {
  const url = `${ESPN_BASE}/${league.espnPath}/summary?event=${espnEventId}`;

  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      console.warn(`[Resolver] ESPN ${espnEventId}: HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();

    // Selon le sport, la structure est différente
    if (league.sport === "soccer") return parseSoccerResult(data);
    if (league.sport === "basketball") return parseBasketResult(data);
    if (league.sport === "tennis") return parseTennisResult(data);

    return null;
  } catch (err) {
    console.error(`[Resolver] Erreur fetch ${espnEventId}:`, err);
    return null;
  }
}


// ═══════════════════════════════════════════════════════════════════
// PARSERS PAR SPORT
// ═══════════════════════════════════════════════════════════════════

function parseSoccerResult(data: Record<string, unknown>): MatchResult | null {
  const header = data?.header as Record<string, unknown> | undefined;
  const competition = ((header?.competitions as unknown[])?.[0]) as
    | Record<string, unknown>
    | undefined;
  if (!competition) return null;

  const status = competition.status as
    | { type?: { completed?: boolean; state?: string } }
    | undefined;
  const completed =
    status?.type?.completed === true ||
    status?.type?.state === "post" ||
    false;

  const competitors = (competition.competitors as Array<Record<string, unknown>>) ?? [];
  const home = competitors.find((c) => c.homeAway === "home");
  const away = competitors.find((c) => c.homeAway === "away");

  if (!home || !away) return null;

  const homeTeam = String(
    (home.team as { displayName?: string } | undefined)?.displayName ?? "",
  );
  const awayTeam = String(
    (away.team as { displayName?: string } | undefined)?.displayName ?? "",
  );

  const homeScore = home.score != null ? Number(home.score) : null;
  const awayScore = away.score != null ? Number(away.score) : null;

  // Extraction des buteurs depuis les plays
  const scorers = extractSoccerScorers(data);

  return {
    completed,
    homeTeam,
    awayTeam,
    homeScore,
    awayScore,
    scorers,
    winner: null,
    rawData: { header },
  };
}


/**
 * Extrait les noms des buteurs depuis les events ESPN foot.
 * Retourne un tableau dédupliqué de noms.
 *
 * ESPN structure ses données ainsi :
 *   - `keyEvents[]` : TOUS les events (kickoffs, cartons, buts, etc.)
 *     → on filtre sur `scoringPlay === true` pour garder uniquement les buts
 *     → le buteur est dans `participants[0].athlete.displayName`
 *
 * Fallbacks legacy (au cas où ESPN changerait de structure selon les ligues) :
 *   - `scoringPlays[]` (ancien format)
 *   - `plays[]` avec type.text contenant "goal"
 */
function extractSoccerScorers(data: Record<string, unknown>): string[] {
  const scorers = new Set<string>();

  // ═══ PRIORITÉ 1 : keyEvents (format actuel ESPN pour la plupart des ligues)
  const keyEvents =
    (data?.keyEvents as Array<Record<string, unknown>> | undefined) ?? [];
  for (const event of keyEvents) {
    if (event.scoringPlay !== true) continue;

    const participants =
      (event.participants as Array<Record<string, unknown>> | undefined) ?? [];
    for (const p of participants) {
      const athlete = p.athlete as { displayName?: string } | undefined;
      if (athlete?.displayName) {
        scorers.add(athlete.displayName);
      }
    }
  }

  // ═══ FALLBACK 1 : scoringPlays (format alternatif)
  const scoringPlays =
    (data?.scoringPlays as Array<Record<string, unknown>> | undefined) ?? [];
  for (const play of scoringPlays) {
    const participants =
      (play.participants as Array<Record<string, unknown>> | undefined) ?? [];
    for (const p of participants) {
      const athlete = p.athlete as { displayName?: string } | undefined;
      if (athlete?.displayName) {
        scorers.add(athlete.displayName);
      }
    }
  }

  // ═══ FALLBACK 2 : plays (ancien format)
  const plays =
    (data?.plays as Array<Record<string, unknown>> | undefined) ?? [];
  for (const play of plays) {
    const type = (play.type as { text?: string } | undefined)?.text ?? "";
    if (!type.toLowerCase().includes("goal")) continue;

    const participants =
      (play.participants as Array<Record<string, unknown>> | undefined) ?? [];
    for (const p of participants) {
      const athlete = p.athlete as { displayName?: string } | undefined;
      if (athlete?.displayName) {
        scorers.add(athlete.displayName);
      }
    }
  }

  return Array.from(scorers);
}


function parseBasketResult(data: Record<string, unknown>): MatchResult | null {
  const header = data?.header as Record<string, unknown> | undefined;
  const competition = ((header?.competitions as unknown[])?.[0]) as
    | Record<string, unknown>
    | undefined;
  if (!competition) return null;

  const status = competition.status as
    | { type?: { completed?: boolean; state?: string } }
    | undefined;
  const completed =
    status?.type?.completed === true || status?.type?.state === "post";

  const competitors =
    (competition.competitors as Array<Record<string, unknown>>) ?? [];
  const home = competitors.find((c) => c.homeAway === "home");
  const away = competitors.find((c) => c.homeAway === "away");

  if (!home || !away) return null;

  const homeTeam = String(
    (home.team as { displayName?: string } | undefined)?.displayName ?? "",
  );
  const awayTeam = String(
    (away.team as { displayName?: string } | undefined)?.displayName ?? "",
  );

  return {
    completed,
    homeTeam,
    awayTeam,
    homeScore: home.score != null ? Number(home.score) : null,
    awayScore: away.score != null ? Number(away.score) : null,
    scorers: [],
    winner: null,
    rawData: { header },
  };
}


function parseTennisResult(data: Record<string, unknown>): MatchResult | null {
  const header = data?.header as Record<string, unknown> | undefined;
  const competition = ((header?.competitions as unknown[])?.[0]) as
    | Record<string, unknown>
    | undefined;
  if (!competition) return null;

  const status = competition.status as
    | { type?: { completed?: boolean; state?: string } }
    | undefined;
  const completed =
    status?.type?.completed === true || status?.type?.state === "post";

  const competitors =
    (competition.competitors as Array<Record<string, unknown>>) ?? [];
  if (competitors.length < 2) return null;

  // Pour le tennis, ESPN met souvent "winner: true" sur le vainqueur
  let winner: "home" | "away" | null = null;
  for (const c of competitors) {
    if (c.winner === true) {
      winner = c.homeAway === "home" ? "home" : "away";
      break;
    }
  }

  const home = competitors.find((c) => c.homeAway === "home") ?? competitors[0];
  const away = competitors.find((c) => c.homeAway === "away") ?? competitors[1];

  const homeName =
    (home.team as { displayName?: string } | undefined)?.displayName ??
    (home.athlete as { displayName?: string } | undefined)?.displayName ??
    "";
  const awayName =
    (away.team as { displayName?: string } | undefined)?.displayName ??
    (away.athlete as { displayName?: string } | undefined)?.displayName ??
    "";

  return {
    completed,
    homeTeam: String(homeName),
    awayTeam: String(awayName),
    homeScore: null, // pas pertinent au tennis
    awayScore: null,
    scorers: [],
    winner,
    rawData: { header },
  };
}


// ═══════════════════════════════════════════════════════════════════
// LOGIQUE DE RÉSOLUTION DES PICKS
// ═══════════════════════════════════════════════════════════════════

type ResolutionStatus = "won" | "lost" | "void";

/**
 * Détermine si un pick est gagné/perdu/void selon le résultat du match.
 */
function resolvePickOutcome(
  pick: PendingPick,
  result: MatchResult,
): ResolutionStatus {
  // ═══ FOOT : Market h2h (1N2)
  if (pick.sport === "soccer" && pick.market === "h2h") {
    if (result.homeScore === null || result.awayScore === null) return "void";

    const pickSelection = pick.selection.toLowerCase();
    const homeLower = result.homeTeam.toLowerCase();
    const awayLower = result.awayTeam.toLowerCase();

    // Match nul
    if (result.homeScore === result.awayScore) {
      if (pickSelection === "draw" || pickSelection === "nul") return "won";
      return "lost";
    }

    // Victoire home
    if (result.homeScore > result.awayScore) {
      if (
        pickSelection === homeLower ||
        homeLower.includes(pickSelection) ||
        pickSelection.includes(homeLower)
      ) {
        return "won";
      }
      return "lost";
    }

    // Victoire away
    if (
      pickSelection === awayLower ||
      awayLower.includes(pickSelection) ||
      pickSelection.includes(awayLower)
    ) {
      return "won";
    }
    return "lost";
  }

  // ═══ FOOT : Market ou25 (Over/Under 2.5 buts)
  if (pick.sport === "soccer" && pick.market === "ou25") {
    if (result.homeScore === null || result.awayScore === null) return "void";
    const total = result.homeScore + result.awayScore;
    const isOver = pick.selection.toLowerCase().includes("over");

    if (isOver) {
      return total > 2.5 ? "won" : "lost";
    } else {
      return total < 2.5 ? "won" : "lost";
    }
  }

  // ═══ FOOT : Market btts (Both Teams To Score)
  if (pick.sport === "soccer" && pick.market === "btts") {
    if (result.homeScore === null || result.awayScore === null) return "void";

    const bothScored = result.homeScore > 0 && result.awayScore > 0;
    const pickedYes = pick.selection.toLowerCase() === "yes";

    if (pickedYes) return bothScored ? "won" : "lost";
    return bothScored ? "lost" : "won";
  }

  // ═══ FOOT : Scorer (buteur)
  if (pick.pick_type === "scorer") {
    if (result.scorers.length === 0) {
      // Si on n'a pas réussi à extraire les buteurs alors que le match est fini,
      // on met void plutôt que lost pour éviter les faux négatifs
      return "void";
    }

    const pickedPlayer = pick.selection.toLowerCase();
    const scored = result.scorers.some((scorer) => {
      const scorerLower = scorer.toLowerCase();
      return (
        scorerLower === pickedPlayer ||
        scorerLower.includes(pickedPlayer) ||
        pickedPlayer.includes(scorerLower) ||
        // Match sur le nom de famille (dernier mot)
        scorerLower.split(" ").pop() === pickedPlayer.split(" ").pop()
      );
    });

    return scored ? "won" : "lost";
  }

  // ═══ BASKET : h2h (vainqueur) + totals
  if (pick.sport === "basketball") {
    if (result.homeScore === null || result.awayScore === null) return "void";

    if (pick.market === "h2h") {
      const pickLower = pick.selection.toLowerCase();
      const homeLower = result.homeTeam.toLowerCase();
      const awayLower = result.awayTeam.toLowerCase();

      if (result.homeScore > result.awayScore) {
        return homeLower.includes(pickLower) || pickLower.includes(homeLower)
          ? "won"
          : "lost";
      } else {
        return awayLower.includes(pickLower) || pickLower.includes(awayLower)
          ? "won"
          : "lost";
      }
    }

    if (pick.market === "totals") {
      // Pick selection format attendu : "Over 225.5" ou "Under 225.5"
      const match = pick.selection.match(/(\d+\.?\d*)/);
      if (!match) return "void";
      const line = parseFloat(match[1]);
      const total = result.homeScore + result.awayScore;
      const isOver = pick.selection.toLowerCase().includes("over");

      if (isOver) return total > line ? "won" : "lost";
      return total < line ? "won" : "lost";
    }
  }

  // ═══ TENNIS : h2h (vainqueur)
  if (pick.sport === "tennis" && pick.market === "h2h") {
    if (!result.winner) return "void";

    const pickLower = pick.selection.toLowerCase();
    const homeLower = result.homeTeam.toLowerCase();
    const awayLower = result.awayTeam.toLowerCase();

    const winnerName = result.winner === "home" ? homeLower : awayLower;

    if (
      winnerName === pickLower ||
      winnerName.includes(pickLower) ||
      pickLower.includes(winnerName) ||
      winnerName.split(" ").pop() === pickLower.split(" ").pop()
    ) {
      return "won";
    }
    return "lost";
  }

  return "void";
}


// ═══════════════════════════════════════════════════════════════════
// FONCTION PRINCIPALE
// ═══════════════════════════════════════════════════════════════════

/**
 * Résout tous les picks pending dont les matchs sont terminés.
 */
export async function resolveDailyPicks(): Promise<ResolutionReport> {
  const startTime = Date.now();
  const startedAt = new Date().toISOString();
  const errors: string[] = [];

  const report: ResolutionReport = {
    success: false,
    startedAt,
    durationMs: 0,
    picksChecked: 0,
    picksResolved: 0,
    picksStillPending: 0,
    picksVoided: 0,
    breakdown: { won: 0, lost: 0, void: 0 },
    errors,
  };

  try {
    const supabase = getSupabaseAdmin();

    // Fetch tous les picks pending dont event_date < NOW - 2h
    const cutoffTime = new Date(
      Date.now() - MIN_HOURS_AFTER_EVENT * 3600 * 1000,
    ).toISOString();

    const { data: pendingPicks, error: fetchError } = await supabase
      .from("ai_picks")
      .select("id, pick_type, sport, league, event_name, event_date, espn_event_id, selection, market, odds")
      .eq("status", "pending")
      .lt("event_date", cutoffTime)
      .order("event_date", { ascending: true });

    if (fetchError) {
      errors.push(`Erreur fetch pending: ${fetchError.message}`);
      report.durationMs = Date.now() - startTime;
      await logResolution(report);
      return report;
    }

    const picks = (pendingPicks ?? []) as PendingPick[];
    report.picksChecked = picks.length;

    console.log(`[Resolver] ${picks.length} picks pending à résoudre`);

    // Résoudre chaque pick
    for (const pick of picks) {
      // Si pick trop vieux (> MAX_DAYS_TO_VOID jours) on le void
      const pickAge = Date.now() - new Date(pick.event_date).getTime();
      const pickAgeDays = pickAge / (1000 * 3600 * 24);

      if (pickAgeDays > MAX_DAYS_TO_VOID) {
        await updatePickStatus(supabase, pick.id, "void", null, {
          reason: "too_old",
        });
        report.picksVoided++;
        report.breakdown.void++;
        report.picksResolved++;
        continue;
      }

      // Trouver la config de ligue ESPN
      const leagueConfig = LEAGUES.find((l) => l.league === pick.league);
      if (!leagueConfig) {
        errors.push(`Config ligue inconnue pour ${pick.league}`);
        continue;
      }

      if (!pick.espn_event_id) {
        errors.push(`espn_event_id manquant pour pick ${pick.id}`);
        report.picksStillPending++;
        continue;
      }

      // Fetch le résultat
      const result = await fetchMatchResult(pick.espn_event_id, leagueConfig);

      if (!result || !result.completed) {
        // Match pas encore fini ou erreur ESPN
        report.picksStillPending++;
        continue;
      }

      // Déterminer l'issue du pick
      const outcome = resolvePickOutcome(pick, result);
      const finalScore =
        result.homeScore !== null && result.awayScore !== null
          ? `${result.homeScore}-${result.awayScore}`
          : null;

      // Update
      const updateError = await updatePickStatus(
        supabase,
        pick.id,
        outcome,
        finalScore,
        {
          homeTeam: result.homeTeam,
          awayTeam: result.awayTeam,
          homeScore: result.homeScore,
          awayScore: result.awayScore,
          scorers: result.scorers,
          winner: result.winner,
        },
      );

      if (updateError) {
        errors.push(`Erreur update pick ${pick.id}: ${updateError}`);
        continue;
      }

      report.picksResolved++;
      report.breakdown[outcome]++;

      console.log(
        `[Resolver] ${pick.event_name} → ${outcome.toUpperCase()} (${finalScore ?? "no score"})`,
      );
    }

    report.success = true;
    report.durationMs = Date.now() - startTime;

    const logId = await logResolution(report);
    report.logId = logId ?? undefined;

    console.log(
      `[Resolver] ✅ Terminé — ${report.picksResolved}/${report.picksChecked} résolus (${report.breakdown.won}W / ${report.breakdown.lost}L / ${report.breakdown.void}V)`,
    );

    return report;
  } catch (err) {
    const msg = `Erreur fatale: ${err instanceof Error ? err.message : String(err)}`;
    errors.push(msg);
    console.error(`[Resolver] ${msg}`, err);
    report.durationMs = Date.now() - startTime;
    await logResolution(report);
    return report;
  }
}


// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

async function updatePickStatus(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  pickId: string,
  status: ResolutionStatus,
  finalScore: string | null,
  finalData: Record<string, unknown>,
): Promise<string | null> {
  const { error } = await supabase
    .from("ai_picks")
    .update({
      status,
      resolved_at: new Date().toISOString(),
      final_score: finalScore,
      final_data: finalData,
    })
    .eq("id", pickId);

  return error?.message ?? null;
}


async function logResolution(report: ResolutionReport): Promise<string | null> {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("ai_generation_logs")
      .insert({
        run_type: "resolution",
        run_date: new Date().toISOString().split("T")[0],
        status: report.success ? "success" : report.errors.length > 0 ? "error" : "partial",
        picks_created: 0,
        picks_resolved: report.picksResolved,
        errors_count: report.errors.length,
        errors: report.errors.length > 0 ? report.errors : null,
        duration_ms: report.durationMs,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[Resolver] Erreur log:", error);
      return null;
    }

    return data?.id ?? null;
  } catch (err) {
    console.error("[Resolver] Erreur log (catch):", err);
    return null;
  }
}