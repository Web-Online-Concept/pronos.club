/**
 * ═══════════════════════════════════════════════════════════════════
 * dossier-builder.ts (V3.5)
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
 * MAJ V3.5 (09/05/2026) :
 *   + Champs V3.5 exposés : tier, drop_window, clv_pct_final
 *   + Foot enrichi : splits_dom_ext, recent_matches_stats, sidelined, top_scorers_league
 *   + Tennis enrichi : past_matches, tournament_record, career_stats, finals_titles
 *   + Nouveaux sports : rugby_stats, handball_stats, f1_race, f1_drivers
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
import type {
  FootballSplitStats,
  FootballRecentMatchStats,
  FootballSidelinedItem,
  FootballTopScorer,
  TennisPastMatchWithOdds,
  TennisTournamentRecord,
  TennisCareerStats,
  TennisFinalsTitles,
  RugbyTeamStats,
  HandballTeamStats,
  F1RaceData,
  F1DriverStats,
  PickTier,
  DropWindow,
} from "@/lib/ai-picks-v3/tipster-types";


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

  // ═══ V3.5 NOUVEAUX CHAMPS ═══════════════════════════════════════
  /** Tier de classification (lock/strong/value/coup_de_coeur) */
  tier: PickTier | null;
  /** Drop window (morning/evening) */
  dropWindow: DropWindow | null;
  /** CLV final calculé après résolution (en %, ex: +5.2 = +5.2% edge marché) */
  clvPctFinal: number | null;
  /** CLV history capturé pré-match (pour graphique évolution cote) */
  clvHistory: Array<{
    timestamp: string;
    pinnacle_odds: number;
    pinnacle_no_vig_odds: number | null;
    is_final_closing: boolean;
  }> | null;

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

  // ═══ V3 (existant) — stats fixture stockées dans odds_comparison ═══
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

  // ═══ V3.5 — FOOTBALL enrichi ═══════════════════════════════════
  /** Splits domicile/extérieur des 2 équipes */
  footballSplits: {
    home_team_at_home: FootballSplitStats;
    away_team_at_away: FootballSplitStats;
  } | null;
  /** Stats des 5 derniers matchs avec détails (xG, possession, tirs, etc.) */
  footballRecentMatches: {
    home: FootballRecentMatchStats[];
    away: FootballRecentMatchStats[];
  } | null;
  /** Liste des absents/suspendus (sidelined complet) */
  footballSidelined: {
    home: FootballSidelinedItem[];
    away: FootballSidelinedItem[];
  } | null;
  /** Top scorers de la league (cache 24h) */
  footballTopScorers: FootballTopScorer[] | null;

  // ═══ V3.5 — TENNIS enrichi ═════════════════════════════════════
  /** Past matches avec cotes pré-match (filtré M1000+/GC) */
  tennisPastMatches: {
    player1: TennisPastMatchWithOdds[];
    player2: TennisPastMatchWithOdds[];
  } | null;
  /** Record sur ce tournoi spécifique */
  tennisTournamentRecord: {
    player1: TennisTournamentRecord | null;
    player2: TennisTournamentRecord | null;
  } | null;
  /** Stats serve/return de carrière des 2 joueurs */
  tennisCareerStats: {
    player1: TennisCareerStats | null;
    player2: TennisCareerStats | null;
  } | null;
  /** Finales et titres (uniquement si SF/Final) */
  tennisFinalsTitles: {
    player1: TennisFinalsTitles | null;
    player2: TennisFinalsTitles | null;
  } | null;

  // ═══ V3.5 — NOUVEAUX SPORTS ═════════════════════════════════════
  /** Stats rugby des 2 équipes (Top 14, 6 Nations, Coupe d'Europe) */
  rugbyStats: {
    home: RugbyTeamStats;
    away: RugbyTeamStats;
  } | null;
  /** Stats handball des 2 équipes (Starligue, EHF) */
  handballStats: {
    home: HandballTeamStats;
    away: HandballTeamStats;
  } | null;
  /** Données du Grand Prix F1 + pilotes engagés */
  f1Race: F1RaceData | null;
  f1Drivers: F1DriverStats[] | null;
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
  /** V3.5 colonnes dédiées */
  tier: string | null;
  drop_window: string | null;
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
      "id, slug, classic_number, scorer_number, pick_type, sport, league, event_name, event_date, selection, market, odds, odds_bookmaker, odds_comparison, reasoning, reasoning_claude, reasoning_gpt, ai_confidence, consensus_score, apifootball_fixture_id, status, deleted_at, tier, drop_window"
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


const inferOddsApiSportKey = (pick: AiPickRow): string | null => {
  const oc = pick.odds_comparison ?? {};
  if (typeof oc.oddsapi_sport_key === "string") {
    return oc.oddsapi_sport_key;
  }

  const sport = pick.sport.toLowerCase();
  const league = (pick.league ?? "").toLowerCase();

  if (sport === "hockey") {
    if (league.includes("nhl")) return "icehockey_nhl";
    return "icehockey_nhl";
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
    return null;
  }
  if (sport === "tennis") return "tennis_atp";
  if (sport === "mma") return "mma_mixed_martial_arts";
  return null;
};


// ─── Helpers d'extraction typée des champs JSONB ───────────────────

/**
 * Extraction safe d'un champ générique de odds_comparison.
 * Cast minimal — on retourne null si l'objet n'a pas la forme attendue.
 */
const extractOcField = <T>(
  oc: Record<string, unknown>,
  key: string
): T | null => {
  const v = oc[key];
  if (v === undefined || v === null) return null;
  return v as T;
};

const extractClvPctFinal = (oc: Record<string, unknown>): number | null => {
  const v = oc.clv_pct_final;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
};

const extractClvHistory = (
  oc: Record<string, unknown>
): DossierPickData["clvHistory"] => {
  const v = oc.closing_pinnacle_odds_history;
  if (!Array.isArray(v) || v.length === 0) return null;
  return v as DossierPickData["clvHistory"];
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

  // Extraction des stats fixture stockées dans odds_comparison (V3 existant)
  const footballStats = extractOcField<{
    home: Record<string, unknown>;
    away: Record<string, unknown>;
  }>(oc, "fixture_stats_equipe");

  const footballPrediction = extractOcField<Record<string, unknown>>(oc, "fixture_predictions");

  const classement = extractOcField<{
    home: Record<string, unknown>;
    away: Record<string, unknown>;
  }>(oc, "fixture_classement");

  const h2hReel = extractOcField<{
    resume: string;
    derniers_matchs: string[];
  }>(oc, "fixture_h2h_reel");

  const pitchers = extractOcField<{
    home: Record<string, unknown> | null;
    away: Record<string, unknown> | null;
  }>(oc, "fixture_pitchers");

  const recordsFighters = extractOcField<Record<string, Record<string, unknown>>>(oc, "fixture_records_fighters");

  // ═══ V3.5 — Extraction des nouveaux champs ═══
  const footballSplits = extractOcField<DossierPickData["footballSplits"]>(oc, "fixture_splits_dom_ext");
  const footballRecentMatches = extractOcField<DossierPickData["footballRecentMatches"]>(oc, "fixture_recent_matches_stats");
  const footballSidelined = extractOcField<DossierPickData["footballSidelined"]>(oc, "fixture_sidelined");
  const footballTopScorers = extractOcField<DossierPickData["footballTopScorers"]>(oc, "fixture_top_scorers_league");

  const tennisPastMatches = extractOcField<DossierPickData["tennisPastMatches"]>(oc, "fixture_tennis_past_matches");
  const tennisTournamentRecord = extractOcField<DossierPickData["tennisTournamentRecord"]>(oc, "fixture_tennis_tournament_record");
  const tennisCareerStats = extractOcField<DossierPickData["tennisCareerStats"]>(oc, "fixture_tennis_career_stats");
  const tennisFinalsTitles = extractOcField<DossierPickData["tennisFinalsTitles"]>(oc, "fixture_tennis_finals_titles");

  const rugbyStats = extractOcField<DossierPickData["rugbyStats"]>(oc, "fixture_rugby_stats");
  const handballStats = extractOcField<DossierPickData["handballStats"]>(oc, "fixture_handball_stats");
  const f1Race = extractOcField<F1RaceData>(oc, "fixture_f1_race");
  const f1Drivers = extractOcField<F1DriverStats[]>(oc, "fixture_f1_drivers");

  // V3.5 — CLV (calculé après résolution dans publish-results)
  const clvPctFinal = extractClvPctFinal(oc);
  const clvHistory = extractClvHistory(oc);

  // V3.5 — Tier + drop window (colonnes dédiées dans ai_picks)
  const tier = (pick.tier ?? null) as PickTier | null;
  const dropWindow = (pick.drop_window ?? null) as DropWindow | null;

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

    // V3.5
    tier,
    dropWindow,
    clvPctFinal,
    clvHistory,

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

    // V3 existant
    footballStats,
    footballPrediction,
    classement,
    h2hReel,
    pitchers,
    recordsFighters,

    // V3.5 — Football enrichi
    footballSplits,
    footballRecentMatches,
    footballSidelined,
    footballTopScorers,

    // V3.5 — Tennis enrichi
    tennisPastMatches,
    tennisTournamentRecord,
    tennisCareerStats,
    tennisFinalsTitles,

    // V3.5 — Nouveaux sports
    rugbyStats,
    handballStats,
    f1Race,
    f1Drivers,
  };
};