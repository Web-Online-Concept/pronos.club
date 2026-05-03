/**
 * ═══════════════════════════════════════════════════════════════════
 * dossier-builder.ts
 * ═══════════════════════════════════════════════════════════════════
 *
 * Agrege toutes les donnees pour la page dossier d'un pick IA.
 *
 * Sources combinees :
 * - Pick lui-meme (cotes 6 books, edge, fair odds) -> Supabase ai_picks
 * - Stats foot (forme, H2H, line-ups, blessures, predictions) -> API-Football
 * - Stats multi-sports (NHL, NBA, MLB, soccer, tennis...) -> ESPN gratuit
 * - Analyse Claude + GPT (200 mots) -> ai_picks_analysis
 *
 * Le dossier resultant alimente la page /pronos-ia/match/[slug]
 * ═══════════════════════════════════════════════════════════════════
 */

import { supabaseAdmin } from "@/lib/supabase/admin";
import { aggregateMatchData } from "./match-aggregator";
import {
  getEspnContextForPick,
  type EspnPickContext,
} from "./espn-client";
import type { AggregatedMatchData } from "@/types/apifootball";


// ─── Types ────────────────────────────────────────────────────────


export type BookOddsSnapshot = {
  key: string;
  name: string;
  odds: number | null;
};


export type DossierPickData = {
  // Identite
  pickId: string;
  slug: string;
  classicNumber: number | null;
  scorerNumber: number | null;
  pickType: "classic" | "scorer";

  // Match
  sport: string; // "football", "hockey", etc.
  league: string;
  eventName: string;
  homeTeam: string;
  awayTeam: string;
  eventDate: string;

  // Pick
  selection: string;
  market: string;
  odds: number;
  bookmaker: string;
  status: string;

  // Edge mathematique
  edgePct: number | null;
  fairOdds: number | null;
  fairProbability: number | null;
  pinnacleRawOdds: number | null;
  bestSoftOdds: number | null;
  bestSoftBookName: string | null;

  // Comparateur 6 books
  booksSnapshot: BookOddsSnapshot[];

  // Reasoning IA
  reasoning: string | null;
  reasoningClaude: string | null;
  reasoningGpt: string | null;

  // Dossier IA long (genere par dossier-generator)
  dossierFullText: string | null;
  dossierSections: unknown | null;

  // Confidences
  aiConfidence: number | null;
  consensusScore: number | null;

  // Sport context — null si non dispo
  espnContext: EspnPickContext | null;
  apiFootballContext: AggregatedMatchData | null;

  // Nouvelles stats v3 (depuis odds_comparison.fixture_*)
  footballStats: {
    home: Record<string, unknown>;
    away: Record<string, unknown>;
  } | null;
  footballPrediction: Record<string, unknown> | null;
  classement: {
    home: Record<string, unknown>;
    away: Record<string, unknown>;
  } | null;
  h2hReel: {
    resume: string;
    derniers_matchs: string[];
  } | null;
  pitchers: {
    home: Record<string, unknown> | null;
    away: Record<string, unknown> | null;
  } | null;
  recordsFighters: Record<string, Record<string, unknown>> | null;
};


// ─── Helpers DB ───────────────────────────────────────────────────


type AiPickRow = {
  id: string;
  slug: string | null;
  classic_number: number | null;
  scorer_number: number | null;
  pick_type: string;
  sport: string;
  league: string | null;
  event_name: string;
  event_date: string;
  selection: string;
  market: string;
  odds: number;
  odds_bookmaker: string | null;
  odds_comparison: Record<string, unknown> | null;
  reasoning: string | null;
  reasoning_claude: string | null;
  reasoning_gpt: string | null;
  ai_confidence: number | null;
  consensus_score: number | null;
  apifootball_fixture_id: number | null;
  status: string;
  deleted_at: string | null;
};


type AiAnalysisRow = {
  pick_id: string;
  locale: string;
  full_text: string | null;
  sections: unknown;
};


/**
 * Extract du nom des equipes a partir de event_name "Home vs Away".
 */
const extractTeamsFromEventName = (
  eventName: string
): { home: string; away: string } => {
  const sep = eventName.includes(" vs ")
    ? " vs "
    : eventName.includes(" - ")
    ? " - "
    : null;
  if (!sep) return { home: eventName, away: "" };
  const parts = eventName.split(sep);
  return { home: parts[0]?.trim() ?? "", away: parts[1]?.trim() ?? "" };
};


/**
 * Lit le pick depuis Supabase par son slug.
 */
const fetchPickBySlug = async (slug: string): Promise<AiPickRow | null> => {
  const { data, error } = await supabaseAdmin
    .from("ai_picks")
    .select(
      "id, slug, classic_number, scorer_number, pick_type, sport, league, event_name, event_date, selection, market, odds, odds_bookmaker, odds_comparison, reasoning, reasoning_claude, reasoning_gpt, ai_confidence, consensus_score, apifootball_fixture_id, status, deleted_at"
    )
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) return null;
  return data as AiPickRow;
};


/**
 * Lit le dossier IA (Claude long-form) si dispo.
 */
const fetchAiAnalysis = async (
  pickId: string,
  locale: string = "fr"
): Promise<AiAnalysisRow | null> => {
  const { data } = await supabaseAdmin
    .from("ai_picks_analysis")
    .select("pick_id, locale, full_text, sections")
    .eq("pick_id", pickId)
    .eq("locale", locale)
    .maybeSingle();

  return (data as AiAnalysisRow | null) ?? null;
};


// ─── Mapping sportKey OddsAPI a partir de notre data ──────────────


/**
 * Trouve le sportKey OddsAPI utilise pour ce pick. On le retrouve dans
 * odds_comparison.bookmakers_snapshot ou via le sport stocke en DB.
 *
 * Si le pick vient du value-bet engine, on a stocke `oddsapi_sport_key`
 * dans odds_comparison (a ajouter au persister).
 *
 * Fallback : on devine a partir de sport + league.
 */
const inferOddsApiSportKey = (pick: AiPickRow): string | null => {
  const oc = pick.odds_comparison ?? {};
  // Cle directe si on l'a stockee
  if (typeof oc.oddsapi_sport_key === "string") {
    return oc.oddsapi_sport_key;
  }

  const sport = pick.sport.toLowerCase();
  const league = (pick.league ?? "").toLowerCase();

  // Heuristiques basiques
  if (sport === "hockey") {
    if (league.includes("nhl")) return "icehockey_nhl";
    return "icehockey_nhl"; // fallback
  }
  if (sport === "basketball") {
    if (league.includes("nba")) return "basketball_nba";
    if (league.includes("wnba")) return "basketball_wnba";
    return null;
  }
  if (sport === "baseball") {
    if (league.includes("mlb")) return "baseball_mlb";
    return null;
  }
  if (sport === "football-americain" || sport === "americanfootball") {
    return "americanfootball_nfl";
  }
  if (sport === "football" || sport === "soccer") {
    if (league.includes("ligue 1") || league.includes("france")) return "soccer_france_ligue_one";
    if (league.includes("premier") || league.includes("epl")) return "soccer_epl";
    if (league.includes("bundesliga")) return "soccer_germany_bundesliga";
    if (league.includes("liga")) return "soccer_spain_la_liga";
    if (league.includes("serie a")) return "soccer_italy_serie_a";
    if (league.includes("champions")) return "soccer_uefa_champs_league";
    if (league.includes("europa")) return "soccer_uefa_europa_league";
    return null; // foot mais ligue inconnue : ESPN essaiera quand meme
  }
  if (sport === "tennis") return "tennis_atp"; // fallback ATP
  if (sport === "mma") return "mma_mixed_martial_arts";
  return null;
};


// ─── API publique ─────────────────────────────────────────────────


/**
 * Construit toutes les data necessaires a la page dossier.
 * Combine 4 sources en parallele pour rapidite :
 * - Pick + analysis (Supabase)
 * - ESPN (gratuit, multi-sports)
 * - API-Football (uniquement si fixture_id present)
 *
 * Retourne null si le pick n'existe pas ou est supprime.
 */
export const buildDossierData = async (
  slug: string,
  locale: string = "fr"
): Promise<DossierPickData | null> => {
  const pick = await fetchPickBySlug(slug);
  if (!pick) return null;

  const { home, away } = extractTeamsFromEventName(pick.event_name);

  // Lance les 3 fetchs annexes en parallele
  const [analysis, apiFootballContext, espnContext] = await Promise.all([
    fetchAiAnalysis(pick.id, locale),
    pick.apifootball_fixture_id
      ? aggregateMatchData(pick.apifootball_fixture_id, { pickId: pick.id })
          .catch((err) => {
            console.warn("[dossier-builder] api-football failed:", err);
            return null;
          })
      : Promise.resolve(null),
    (async () => {
      const sportKey = inferOddsApiSportKey(pick);
      if (!sportKey) return null;
      try {
        return await getEspnContextForPick(
          sportKey,
          home,
          away,
          pick.event_date
        );
      } catch (err) {
        console.warn("[dossier-builder] espn failed:", err);
        return null;
      }
    })(),
  ]);

  // Extract odds_comparison data
  const oc = (pick.odds_comparison ?? {}) as Record<string, unknown>;

  const edgePct = typeof oc.edge_pct === "number" ? oc.edge_pct : null;
  const fairOdds = typeof oc.fair_odds === "number" ? oc.fair_odds : null;
  const fairProbability =
    typeof oc.fair_probability === "number" ? oc.fair_probability : null;
  const pinnacleRawOdds =
    typeof oc.pinnacle_raw_odds === "number" ? oc.pinnacle_raw_odds : null;
  const bestSoftOdds =
    typeof oc.best_soft_odds === "number" ? oc.best_soft_odds : null;
  const bestSoftBookName =
    typeof oc.best_soft_book_name === "string" ? oc.best_soft_book_name : null;

  const snapshot = (oc.bookmakers_snapshot ?? {}) as Record<string, unknown>;
  const booksRaw = (snapshot.books ?? []) as Array<{
    key?: string;
    name?: string;
    odds?: number | null;
  }>;
  const booksSnapshot: BookOddsSnapshot[] = booksRaw.map((b) => ({
    key: b.key ?? "",
    name: b.name ?? "",
    odds: typeof b.odds === "number" ? b.odds : null,
  }));

  // Extraction des stats fixture stockées dans odds_comparison
  const footballStats = (oc.fixture_stats_equipe as {
    home: Record<string, unknown>;
    away: Record<string, unknown>;
  } | null) ?? null;

  const footballPrediction = (oc.fixture_predictions as Record<string, unknown> | null) ?? null;

  const classement = (oc.fixture_classement as {
    home: Record<string, unknown>;
    away: Record<string, unknown>;
  } | null) ?? null;

  const h2hReel = (oc.fixture_h2h_reel as {
    resume: string;
    derniers_matchs: string[];
  } | null) ?? null;

  const pitchers = (oc.fixture_pitchers as {
    home: Record<string, unknown> | null;
    away: Record<string, unknown> | null;
  } | null) ?? null;

  const recordsFighters = (oc.fixture_records_fighters as Record<string, Record<string, unknown>> | null) ?? null;

  return {
    pickId: pick.id,
    slug: pick.slug ?? slug,
    classicNumber: pick.classic_number,
    scorerNumber: pick.scorer_number,
    pickType: pick.pick_type === "scorer" ? "scorer" : "classic",
    sport: pick.sport,
    league: pick.league ?? "",
    eventName: pick.event_name,
    homeTeam: home,
    awayTeam: away,
    eventDate: pick.event_date,
    selection: pick.selection,
    market: pick.market,
    odds: pick.odds,
    bookmaker: pick.odds_bookmaker ?? "",
    status: pick.status,
    edgePct,
    fairOdds,
    fairProbability,
    pinnacleRawOdds,
    bestSoftOdds,
    bestSoftBookName,
    booksSnapshot,
    reasoning: pick.reasoning,
    reasoningClaude: pick.reasoning_claude,
    reasoningGpt: pick.reasoning_gpt,
    dossierFullText: analysis?.full_text ?? null,
    dossierSections: analysis?.sections ?? null,
    aiConfidence: pick.ai_confidence,
    consensusScore: pick.consensus_score,
    espnContext,
    apiFootballContext,
    footballStats,
    footballPrediction,
    classement,
    h2hReel,
    pitchers,
    recordsFighters,
  };
};