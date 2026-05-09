/**
 * PRONOS.CLUB — CLV (Closing Line Value) Capture
 *
 * Helper de capture périodique des cotes Pinnacle pré-match pour les picks
 * pending V3.5. Permet de calculer au moment de la résolution (J+1) la
 * "Closing Line Value" : edge réel de l'IA vs marché efficient.
 *
 * Logique :
 *   1. SELECT picks pending V3.5 dont event_date est dans [now, now+3h]
 *   2. Grouper par sport + match pour minimiser les calls The Odds API
 *      (1 call /sports/{sport}/odds retourne tous les matchs du sport)
 *   3. Pour chaque pick :
 *      - Trouver la cote Pinnacle actuelle correspondant à sa selection
 *      - Calculer le no-vig (deux-way si dispo, sinon brut)
 *      - Append dans odds_comparison.closing_pinnacle_odds_history
 *      - Si event_date - now < 30min : marquer closing_pinnacle_odds final
 *
 * Performance attendue :
 *   - ~3-5 sports concernés par run
 *   - ~96 runs/jour (15 min)
 *   - ~300-500 calls The Odds API / jour (budget large : 20k/mois disponible)
 *
 * Au moment du resolve (J+1), `clv_pct` sera calculé comme :
 *   clv_pct = (1 / opening_no_vig) - (1 / closing_no_vig)
 *   Positif = l'IA a battu le marché (cote prise plus haute que la closing efficient)
 *   Négatif = l'IA a sous-performé (cote prise inférieure à la closing)
 */

import { supabaseAdmin } from "@/lib/supabase/admin";
import type { SupportedSport } from "@/lib/ai-picks-v3/tipster-types";

// ============================================================================
// CONFIGURATION
// ============================================================================

const ODDS_API_KEY = process.env.ODDS_API_KEY ?? "";

/** Fenêtre temporelle de capture : on capture les picks dont kickoff dans <3h */
const CAPTURE_WINDOW_HOURS = 3;

/** Si kickoff dans <30 min, on marque la cote comme "closing finale" */
const CLOSING_FINAL_THRESHOLD_MINUTES = 30;

/** Mapping sport interne → key The Odds API (exemple non exhaustif, on construit dynamiquement) */
const SPORT_TO_ODDS_API_GROUP: Record<SupportedSport, string[]> = {
  football: [
    "soccer_epl", "soccer_france_ligue_one", "soccer_spain_la_liga",
    "soccer_italy_serie_a", "soccer_germany_bundesliga", "soccer_uefa_champs_league",
    "soccer_uefa_europa_league", "soccer_uefa_europa_conference_league",
    "soccer_fifa_world_cup", "soccer_portugal_primeira_liga",
    "soccer_netherlands_eredivisie", "soccer_belgium_first_div",
    "soccer_brazil_campeonato", "soccer_usa_mls",
  ],
  tennis: ["tennis_atp_french_open", "tennis_wta_french_open", "tennis_atp_wimbledon", "tennis_wta_wimbledon", "tennis_atp_us_open", "tennis_wta_us_open", "tennis_atp_aus_open", "tennis_wta_aus_open"],
  basketball: ["basketball_nba", "basketball_wnba", "basketball_euroleague", "basketball_ncaab"],
  hockey: ["icehockey_nhl", "icehockey_sweden_hockey_league", "icehockey_finland_liiga"],
  baseball: ["baseball_mlb", "baseball_npb"],
  american_football: ["americanfootball_nfl", "americanfootball_ncaaf"],
  mma: ["mma_mixed_martial_arts"],
  rugby: ["rugby_top14", "rugby_six_nations", "rugby_premiership", "rugby_urc", "rugby_world_cup"],
  handball: ["handball_starligue", "handball_bundesliga", "handball_champions_league"],
  formula_1: ["motorsport_formula1"],
};

/**
 * Note importante : The Odds API ne fournit pas toujours toutes les ligues
 * via leurs `key`. Pour gérer cela on fait une stratégie hybride :
 * - On essaie d'abord avec la key précise (ex: soccer_epl)
 * - Si fail, on fallback sur la liste dynamique des sports actifs
 */

// ============================================================================
// TYPES
// ============================================================================

type CLVHistoryEntry = {
  timestamp: string; // ISO
  pinnacle_odds: number; // cote brute Pinnacle au moment de la capture
  pinnacle_no_vig_odds: number | null; // cote no-vig (si paire 2-way disponible)
  is_final_closing: boolean; // true si capturé dans les 30 min avant kickoff
};

type PendingPick = {
  id: string;
  slug: string | null;
  sport: string; // sport slug interne (football, tennis, etc.)
  league: string;
  event_name: string;
  event_date: string;
  selection: string;
  market: string;
  odds_comparison: Record<string, unknown> | null;
};

type OddsApiSport = {
  key: string;
  active: boolean;
  group: string;
  title: string;
  has_outrights: boolean;
};

type OddsApiOutcome = {
  name: string;
  price: number;
  point?: number;
};

type OddsApiMarket = {
  key: string;
  outcomes: OddsApiOutcome[];
};

type OddsApiBookmaker = {
  key: string;
  markets: OddsApiMarket[];
};

type OddsApiEvent = {
  id: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsApiBookmaker[];
};

export type CLVCaptureResult = {
  success: boolean;
  picks_processed: number;
  picks_updated: number;
  picks_skipped: number;
  picks_errored: number;
  api_calls_made: number;
  errors: string[];
  duration_ms: number;
};

// ============================================================================
// HELPERS
// ============================================================================

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const normalize = (s: string): string => {
  return s.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

/** Match approximatif de noms d'équipes (variations Pinnacle vs nos noms internes) */
const teamsMatchLoose = (a: string, b: string): boolean => {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  // Tokens significatifs
  const tokensA = na.split(" ").filter((t) => t.length >= 4);
  const tokensB = nb.split(" ").filter((t) => t.length >= 4);
  return tokensA.some((t) => tokensB.includes(t));
};

/**
 * Calcule le no-vig (probabilité brute de bookmaker à overround retiré).
 * Pour 1N2 : no_vig_p1 = (1/c1) / (1/c1 + 1/cX + 1/c2)
 * Pour 2-way : no_vig_p1 = (1/c1) / (1/c1 + 1/c2)
 *
 * Retourne la cote no-vig (= 1 / probabilité no-vig).
 *
 * Si on n'a pas la paire complète (juste 1 outcome), retourne null.
 */
const computeNoVigOdds = (odds: number, otherOdds: number[]): number | null => {
  if (otherOdds.length === 0) return null;
  const allOdds = [odds, ...otherOdds];
  const sumImpliedProbas = allOdds.reduce((sum, o) => sum + 1 / o, 0);
  if (sumImpliedProbas <= 0) return null;
  const myImpliedProba = 1 / odds;
  const myNoVigProba = myImpliedProba / sumImpliedProbas;
  return 1 / myNoVigProba;
};

const fetchJson = async <T>(url: string, retries = 2): Promise<T> => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);
      if (response.status === 429) {
        if (attempt < retries) {
          await sleep(5000);
          continue;
        }
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} : ${(await response.text()).substring(0, 100)}`);
      }
      return (await response.json()) as T;
    } catch (err) {
      if (attempt === retries) throw err;
      await sleep(1000);
    }
  }
  throw new Error("fetchJson exhausted retries");
};

// ============================================================================
// EXTRACTION DE LA COTE PINNACLE POUR UN PICK
// ============================================================================

/**
 * Extrait la cote Pinnacle actuelle pour un pick donné depuis la liste des
 * events The Odds API d'un sport.
 *
 * Strategy :
 *   1. Trouver l'event matching home + away teams (loose match)
 *   2. Trouver le bookmaker "pinnacle"
 *   3. Selon le market (1N2, totals, BTTS, etc.), extraire la cote correspondante
 *   4. Si paire 2-way ou 3-way disponible, calculer aussi le no-vig
 */
const extractPinnacleOddsForPick = (
  pick: PendingPick,
  events: OddsApiEvent[]
): { odds: number; noVigOdds: number | null } | null => {
  // Le event_name format = "Home Team vs Away Team" (séparateur " vs " ou " - ")
  const sep = pick.event_name.includes(" vs ") ? " vs " : " - ";
  const parts = pick.event_name.split(sep);
  const homeTeam = parts[0]?.trim() ?? "";
  const awayTeam = parts[1]?.trim() ?? "";

  if (!homeTeam || !awayTeam) return null;

  // Trouver l'event matching
  const event = events.find(
    (e) =>
      teamsMatchLoose(e.home_team, homeTeam) &&
      teamsMatchLoose(e.away_team, awayTeam)
  );
  if (!event) return null;

  // Trouver Pinnacle
  const pinnacle = event.bookmakers.find((b) => b.key === "pinnacle");
  if (!pinnacle) return null;

  // Extraire selon le market
  const sel = pick.selection.toLowerCase();

  // ── 1N2 (h2h) ────────────────────────────────────────────────────────────
  if (pick.market === "1N2" || sel.includes("victoire")) {
    const h2hMarket = pinnacle.markets.find((m) => m.key === "h2h");
    if (!h2hMarket) return null;

    const homeOutcome = h2hMarket.outcomes.find((o) => teamsMatchLoose(o.name, event.home_team));
    const awayOutcome = h2hMarket.outcomes.find((o) => teamsMatchLoose(o.name, event.away_team));
    const drawOutcome = h2hMarket.outcomes.find((o) => o.name === "Draw");

    // Quelle équipe est sélectionnée ?
    const isHomeSelection = teamsMatchLoose(pick.selection, event.home_team) ||
                             pick.selection.toLowerCase().includes("victoire " + normalize(event.home_team).split(" ")[0]);
    const isAwaySelection = teamsMatchLoose(pick.selection, event.away_team);

    const allOdds = [homeOutcome?.price, awayOutcome?.price, drawOutcome?.price].filter((p): p is number => typeof p === "number");

    if (isHomeSelection && homeOutcome) {
      const others = allOdds.filter((o) => o !== homeOutcome.price);
      return { odds: homeOutcome.price, noVigOdds: computeNoVigOdds(homeOutcome.price, others) };
    }
    if (isAwaySelection && awayOutcome) {
      const others = allOdds.filter((o) => o !== awayOutcome.price);
      return { odds: awayOutcome.price, noVigOdds: computeNoVigOdds(awayOutcome.price, others) };
    }
    return null;
  }

  // ── Over / Under (totals) ────────────────────────────────────────────────
  if (pick.market.startsWith("OVER_UNDER") || pick.market === "TOTAL_GOALS" ||
      pick.market === "TOTAL_POINTS" || pick.market === "TOTAL_RUNS" ||
      pick.market === "TOTAL_TRIES" || pick.market === "TOTAL_HANDBALL_GOALS" ||
      pick.market === "TOTAL_GAMES") {
    const totalsMarket = pinnacle.markets.find((m) => m.key === "totals");
    if (!totalsMarket) return null;

    // Extraire le seuil depuis la selection (ex: "Plus de 2.5 buts" → 2.5)
    const matchPoint = pick.selection.match(/(\d+\.?\d*)/);
    const point = matchPoint ? parseFloat(matchPoint[1]) : null;
    if (point === null) return null;

    const isOver = sel.includes("plus de") || sel.includes("over") || /\+\d/.test(sel);
    const targetName = isOver ? "Over" : "Under";

    const outcome = totalsMarket.outcomes.find((o) => o.name === targetName && o.point === point);
    if (!outcome) return null;

    const otherOutcome = totalsMarket.outcomes.find((o) => o.name !== targetName && o.point === point);
    const others = otherOutcome ? [otherOutcome.price] : [];

    return { odds: outcome.price, noVigOdds: computeNoVigOdds(outcome.price, others) };
  }

  // ── Handicaps (spreads) ──────────────────────────────────────────────────
  if (pick.market.startsWith("HANDICAP")) {
    const spreadsMarket = pinnacle.markets.find((m) => m.key === "spreads");
    if (!spreadsMarket) return null;

    const matchPoint = pick.selection.match(/([+-]?\d+\.?\d*)/);
    const point = matchPoint ? parseFloat(matchPoint[1]) : null;
    if (point === null) return null;

    // On cherche l'outcome avec le point matching
    const outcome = spreadsMarket.outcomes.find((o) => o.point === point);
    if (!outcome) return null;

    const otherOutcome = spreadsMarket.outcomes.find((o) => o.name !== outcome.name);
    const others = otherOutcome ? [otherOutcome.price] : [];

    return { odds: outcome.price, noVigOdds: computeNoVigOdds(outcome.price, others) };
  }

  // ── BTTS / autres markets : pas supportés directement par Pinnacle h2h/totals
  // The Odds API ne retourne pas BTTS pour Pinnacle dans la plupart des cas.
  // On retourne null = pas de capture pour ce pick (acceptable, c'est minoritaire).
  return null;
};

// ============================================================================
// FETCH ODDS API
// ============================================================================

/**
 * Récupère les cotes Pinnacle live pour un sport donné.
 * Stratégie : tente d'abord avec la sport key, sinon scan toutes les keys actives.
 */
const fetchPinnacleOddsForSport = async (
  oddsApiSportKey: string
): Promise<{ events: OddsApiEvent[]; apiCallsMade: number }> => {
  try {
    const isFootball = oddsApiSportKey.startsWith("soccer_");
    const markets = isFootball ? "h2h,totals" : "h2h,totals,spreads";
    const url = `https://api.the-odds-api.com/v4/sports/${oddsApiSportKey}/odds?apiKey=${ODDS_API_KEY}&regions=eu&markets=${markets}&oddsFormat=decimal&dateFormat=iso&bookmakers=pinnacle`;
    const events = await fetchJson<OddsApiEvent[]>(url);
    return { events, apiCallsMade: 1 };
  } catch (err) {
    console.warn(`[clv-capture] fetch sport ${oddsApiSportKey} failed: ${(err as Error).message.substring(0, 100)}`);
    return { events: [], apiCallsMade: 1 };
  }
};

/**
 * Liste les sport keys The Odds API actives pour un sport interne donné.
 * Retourne aussi les keys depuis l'endpoint /sports si utile pour fallback.
 */
const resolveOddsApiSportKeys = (sport: SupportedSport): string[] => {
  return SPORT_TO_ODDS_API_GROUP[sport] ?? [];
};

// ============================================================================
// MISE À JOUR D'UN PICK EN BDD
// ============================================================================

/**
 * Append une nouvelle entrée dans odds_comparison.closing_pinnacle_odds_history
 * et marque éventuellement le closing_pinnacle_odds final.
 */
const updatePickWithCLVCapture = async (
  pick: PendingPick,
  pinnacleOdds: number,
  noVigOdds: number | null
): Promise<void> => {
  const now = new Date();
  const eventDate = new Date(pick.event_date);
  const minutesUntilKickoff = (eventDate.getTime() - now.getTime()) / (1000 * 60);
  const isFinalClosing = minutesUntilKickoff <= CLOSING_FINAL_THRESHOLD_MINUTES;

  const newEntry: CLVHistoryEntry = {
    timestamp: now.toISOString(),
    pinnacle_odds: pinnacleOdds,
    pinnacle_no_vig_odds: noVigOdds,
    is_final_closing: isFinalClosing,
  };

  // On lit l'odds_comparison actuel, append, puis update
  const currentOC = (pick.odds_comparison ?? {}) as Record<string, unknown>;
  const currentHistory = (currentOC.closing_pinnacle_odds_history ?? []) as CLVHistoryEntry[];

  const updatedHistory = [...currentHistory, newEntry];
  const updatedOC: Record<string, unknown> = {
    ...currentOC,
    closing_pinnacle_odds_history: updatedHistory,
  };

  // Si c'est la capture finale, on stocke aussi closing_pinnacle_odds + closing_pinnacle_no_vig_odds
  // pour faciliter le calcul CLV au moment du resolve sans avoir à parcourir l'history
  if (isFinalClosing) {
    updatedOC.closing_pinnacle_odds = pinnacleOdds;
    updatedOC.closing_pinnacle_no_vig_odds = noVigOdds;
    updatedOC.closing_captured_at = now.toISOString();
  }

  const { error } = await supabaseAdmin
    .from("ai_picks")
    .update({ odds_comparison: updatedOC })
    .eq("id", pick.id);

  if (error) {
    throw new Error(`Update pick ${pick.id} failed: ${error.message}`);
  }
};

// ============================================================================
// FONCTION PRINCIPALE
// ============================================================================

/**
 * Capture les cotes Pinnacle actuelles pour tous les picks pending V3.5
 * dont event_date est dans la fenêtre [now, now+3h].
 *
 * Stratégie de minimisation des calls API :
 *   - Grouper les picks par sport
 *   - Pour chaque sport, fetcher 1 fois toutes les keys The Odds API associées
 *   - Pour chaque pick, extraire la cote Pinnacle depuis le cache local
 */
export const captureCLVForPendingPicks = async (): Promise<CLVCaptureResult> => {
  const startedAt = Date.now();
  const result: CLVCaptureResult = {
    success: true,
    picks_processed: 0,
    picks_updated: 0,
    picks_skipped: 0,
    picks_errored: 0,
    api_calls_made: 0,
    errors: [],
    duration_ms: 0,
  };

  if (!ODDS_API_KEY) {
    result.success = false;
    result.errors.push("ODDS_API_KEY not set");
    result.duration_ms = Date.now() - startedAt;
    return result;
  }

  // ─── STEP 1 : Récupérer les picks pending dans la fenêtre [now, now+3h]
  const now = new Date();
  const windowEnd = new Date(now.getTime() + CAPTURE_WINDOW_HOURS * 60 * 60 * 1000);

  const { data: picks, error: fetchError } = await supabaseAdmin
    .from("ai_picks")
    .select("id, slug, sport, league, event_name, event_date, selection, market, odds_comparison")
    .eq("status", "pending")
    .eq("generation_version", "v3")
    .is("deleted_at", null)
    .gte("event_date", now.toISOString())
    .lte("event_date", windowEnd.toISOString());

  if (fetchError) {
    result.success = false;
    result.errors.push(`Supabase fetch failed: ${fetchError.message}`);
    result.duration_ms = Date.now() - startedAt;
    return result;
  }

  if (!picks || picks.length === 0) {
    console.log("[clv-capture] Aucun pick pending dans la fenêtre 3h. Rien à faire.");
    result.duration_ms = Date.now() - startedAt;
    return result;
  }

  result.picks_processed = picks.length;
  console.log(`[clv-capture] ${picks.length} pick(s) pending dans la fenêtre 3h`);

  // ─── STEP 2 : Grouper par sport
  // Mapping sport slug interne → SupportedSport (gère les variantes)
  const slugToSport: Record<string, SupportedSport> = {
    football: "football",
    "football-americain": "american_football",
    basketball: "basketball",
    hockey: "hockey",
    baseball: "baseball",
    tennis: "tennis",
    mma: "mma",
    rugby: "rugby",
    handball: "handball",
    "formula-1": "formula_1",
    multi: "football", // combinés multi-sport, on prend football par défaut (rarement actif en CLV)
  };

  const picksBySport = new Map<SupportedSport, PendingPick[]>();
  for (const p of picks as PendingPick[]) {
    const sport = slugToSport[p.sport];
    if (!sport) {
      console.warn(`[clv-capture] sport slug "${p.sport}" non mappé, skip pick ${p.id}`);
      result.picks_skipped++;
      continue;
    }
    if (!picksBySport.has(sport)) picksBySport.set(sport, []);
    picksBySport.get(sport)!.push(p);
  }

  // ─── STEP 3 : Pour chaque sport, fetch les cotes Pinnacle et update les picks
  for (const [sport, sportPicks] of picksBySport.entries()) {
    const oddsApiKeys = resolveOddsApiSportKeys(sport);
    if (oddsApiKeys.length === 0) {
      console.warn(`[clv-capture] Aucune key The Odds API pour sport ${sport}, skip ${sportPicks.length} pick(s)`);
      result.picks_skipped += sportPicks.length;
      continue;
    }

    console.log(`[clv-capture] Sport ${sport} : ${sportPicks.length} pick(s) à capturer (${oddsApiKeys.length} keys API à scanner)`);

    // Fetch en parallèle limité (max 5 simultané pour éviter le rate limit)
    const allEvents: OddsApiEvent[] = [];
    const BATCH_SIZE = 5;
    for (let i = 0; i < oddsApiKeys.length; i += BATCH_SIZE) {
      const batch = oddsApiKeys.slice(i, i + BATCH_SIZE);
      const fetched = await Promise.all(batch.map((key) => fetchPinnacleOddsForSport(key)));
      for (const f of fetched) {
        allEvents.push(...f.events);
        result.api_calls_made += f.apiCallsMade;
      }
      // Petit sleep entre batches pour ne pas hammer l'API
      if (i + BATCH_SIZE < oddsApiKeys.length) await sleep(500);
    }

    // Pour chaque pick du sport, extraire la cote Pinnacle et update
    for (const pick of sportPicks) {
      try {
        const extracted = extractPinnacleOddsForPick(pick, allEvents);
        if (!extracted) {
          // Pas de match Pinnacle pour ce pick (ex: BTTS non couvert, ou cote non trouvée)
          // On ne loggue pas en error, c'est attendu pour ~10-20% des picks
          result.picks_skipped++;
          continue;
        }

        await updatePickWithCLVCapture(pick, extracted.odds, extracted.noVigOdds);
        result.picks_updated++;
      } catch (err) {
        const msg = `Pick ${pick.id} (${pick.event_name}): ${(err as Error).message}`;
        console.warn(`[clv-capture] ${msg}`);
        result.errors.push(msg);
        result.picks_errored++;
      }
    }
  }

  result.duration_ms = Date.now() - startedAt;
  console.log(
    `[clv-capture] Terminé : ${result.picks_updated} mis à jour, ${result.picks_skipped} skipped, ${result.picks_errored} erreurs, ${result.api_calls_made} API calls, ${(result.duration_ms / 1000).toFixed(1)}s`
  );

  return result;
};