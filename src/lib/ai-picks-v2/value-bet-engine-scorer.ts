/**
 * ═══════════════════════════════════════════════════════════════════
 * value-bet-engine-scorer.ts
 * ═══════════════════════════════════════════════════════════════════
 *
 * Detecte les value bets sur le marche "Anytime Goal Scorer".
 *
 * Methode standard pro :
 *  1. Pour chaque match foot des 5 grands championnats, fetch :
 *     - Cotes Bet365 du marche Anytime Goal Scorer (via API-Football)
 *     - Stats Understat (xG joueur + xGA equipe adverse)
 *  2. Pour chaque joueur cote, calcule la probabilite fair via :
 *     xG_attendu = npxG_per_90 × ajustement_defense_adverse
 *     P(marque) = 1 - exp(-xG_attendu)
 *  3. Compare cote Bet365 vs fair odd → edge
 *  4. Filtre : cote 1.6-5.0, edge ≥ 5%, ≥30min, max 1 par match,
 *     max 3 picks/jour, partage fixturesUsed avec classics
 *
 * Reference : Mohamed Salah avec npxG_per_90 = 0.65 → P(marque) = 47.8%
 * Si cote Bet365 = 2.50 (40% implicite), edge = +19.5%.
 *
 * ZERO hallucination : toutes les cotes viennent de Bet365 reel,
 * toutes les probabilites viennent de stats Understat reelles.
 * ═══════════════════════════════════════════════════════════════════
 */

import { apiFootball } from "./apifootball-client";
import {
  apiFootballLeagueToUnderstat,
  filterEligibleScorers,
  findUnderstatPlayerByName,
  getCurrentUnderstatSeason,
  getLeagueAverageXGAPerMatch,
  getUnderstatLeaguePlayers,
  getUnderstatLeagueTeams,
  teamsMatchUnderstat,
  type UnderstatPlayerStats,
  type UnderstatTeamStats,
} from "./understat-client";


// ─── Constantes ───────────────────────────────────────────────────


const MIN_ODDS_SCORER = 1.6;
const MAX_ODDS_SCORER = 5.0;
const MIN_EDGE_PCT_SCORER = 5; // plus eleve que classics car plus variance
const MAX_SCORER_PICKS = 3;
const MIN_MINUTES_BEFORE_KICKOFF = 30;

const BET_ID_ANYTIME_GOAL_SCORER = 92; // API-Football bet type ID
const TARGET_BOOKMAKER_ID = 8; // Bet365


// ─── Types ────────────────────────────────────────────────────────


export type ValueBetScorer = {
  /** ID API-Football du fixture */
  fixtureId: number;
  fixtureRef: string;
  apiFootballLeagueId: number;
  league: string;
  homeTeam: string;
  awayTeam: string;
  eventName: string;
  commenceTime: string; // ISO

  // Joueur et equipe
  playerName: string;
  playerTeam: string; // home or away
  playerSide: "home" | "away";

  // Math du value bet
  npxG_per_90: number; // xG du joueur par 90min
  defenseMultiplier: number; // ajustement vs defense adverse
  xG_expected: number; // xG attendu pour ce match
  fairProbability: number; // 1 - exp(-xG_expected)
  fairOdds: number; // 1 / fairProbability

  // Cote bookmaker
  bookmakerName: string;
  bookmakerOdds: number;
  edgePct: number; // (fairOdds / bookmakerOdds - 1) * 100... wait inverse
};


export type ValueBetScorerEngineResult = {
  selected: ValueBetScorer[];
  stats: {
    fixturesScanned: number;
    fixturesWithBet365Scorer: number;
    fixturesRejectedTooLate: number;
    fixturesNotInBig5: number;
    candidatesAnalyzed: number;
    candidatesRejectedNoXG: number;
    candidatesRejectedOddsRange: number;
    candidatesRejectedMinEdge: number;
    valueBetsFound: number;
    selectedAfterAntiSaturation: number;
  };
};


// ─── Cache Understat (in-memory pendant le run) ──────────────────


type UnderstatCache = {
  league: string;
  season: string;
  players: UnderstatPlayerStats[];
  teams: UnderstatTeamStats[];
  leagueAvgXGA: number;
};


const fetchUnderstatDataForLeague = async (
  apiFootballLeagueId: number
): Promise<UnderstatCache | null> => {
  const understatLeague = apiFootballLeagueToUnderstat(apiFootballLeagueId);
  if (!understatLeague) return null;

  const season = getCurrentUnderstatSeason();

  const [players, teams] = await Promise.all([
    getUnderstatLeaguePlayers(understatLeague, season),
    getUnderstatLeagueTeams(understatLeague, season),
  ]);

  if (players.length === 0) {
    console.warn(
      `[value-bet-scorer] no Understat players for league ${understatLeague}/${season}`
    );
    return null;
  }

  if (teams.length === 0) {
    console.warn(
      `[value-bet-scorer] no Understat teams for league ${understatLeague}/${season} - falling back to defense_mult=1.0`
    );
  }

  return {
    league: understatLeague,
    season,
    players: filterEligibleScorers(players),
    teams,
    leagueAvgXGA: teams.length > 0 ? getLeagueAverageXGAPerMatch(teams) : 1.4,
  };
};


// ─── Fetch cotes Bet365 Anytime Goalscorer pour un fixture ───────


type ScorerOdds = {
  playerName: string;
  odds: number;
};


const fetchBet365ScorerOdds = async (
  fixtureId: number
): Promise<ScorerOdds[]> => {
  // On utilise le client apifootball existant pour appeler /odds
  // Note : apiFootball.getOdds() retourne le tableau brut des entrees Odds
  // qu'on doit filtrer pour ne garder que Bet365 + bet 92.
  try {
    const oddsRows = await apiFootball.getOdds(fixtureId);

    // Debug : combien de bookmakers et bets disponibles ?
    let totalBookmakers = 0;
    let totalBets = 0;
    let foundBet365 = false;
    let foundBet92 = false;
    for (const oddsRow of oddsRows) {
      const bookmakers = oddsRow.bookmakers ?? [];
      totalBookmakers += bookmakers.length;
      for (const bm of bookmakers) {
        if (bm.id === TARGET_BOOKMAKER_ID) foundBet365 = true;
        const bets = bm.bets ?? [];
        totalBets += bets.length;
        for (const bet of bets) {
          if (bet.id === BET_ID_ANYTIME_GOAL_SCORER) foundBet92 = true;
        }
      }
    }
    console.log(
      `[scorer] fixture ${fixtureId} odds debug: rows=${oddsRows.length}, bookmakers=${totalBookmakers}, bets=${totalBets}, hasBet365=${foundBet365}, hasBet92=${foundBet92}`
    );

    const results: ScorerOdds[] = [];

    for (const oddsRow of oddsRows) {
      // oddsRow.bookmakers est un array
      const bookmakers = oddsRow.bookmakers ?? [];
      for (const bm of bookmakers) {
        if (bm.id !== TARGET_BOOKMAKER_ID) continue;
        const bets = bm.bets ?? [];
        for (const bet of bets) {
          if (bet.id !== BET_ID_ANYTIME_GOAL_SCORER) continue;
          const values = bet.values ?? [];
          for (const v of values) {
            const odds = parseFloat(String(v.odd));
            if (Number.isFinite(odds) && odds > 1) {
              results.push({
                playerName: String(v.value),
                odds,
              });
            }
          }
        }
      }
    }

    return results;
  } catch (err) {
    console.warn(
      `[value-bet-scorer] failed to fetch odds for fixture ${fixtureId}:`,
      err instanceof Error ? err.message : err
    );
    return [];
  }
};


// ─── Calcul du fair odds via Poisson + xG joueur ──────────────────


/**
 * Calcule la probabilite de marquer >= 1 but pour un joueur donne,
 * en utilisant son npxG/90 ajuste par la defense de l'adversaire.
 *
 * Formule Poisson :
 *   xG_match = npxG_per_90 × multiplicateur_defense
 *   P(marque) = 1 - exp(-xG_match)
 *
 * @param defenseMultiplier ratio xGA_adversaire / xGA_moyen_ligue
 *   - = 1.0 si defense moyenne
 *   - > 1.0 si defense plus permissive que la moyenne (= chances + de marquer)
 *   - < 1.0 si defense plus solide
 */
const computePlayerFairOdds = (
  npxG_per_90: number,
  defenseMultiplier: number
): { fairProbability: number; fairOdds: number; xG_expected: number } => {
  const xG_expected = npxG_per_90 * defenseMultiplier;
  const fairProbability = 1 - Math.exp(-xG_expected);
  const fairOdds = fairProbability > 0 ? 1 / fairProbability : 999;
  return { xG_expected, fairProbability, fairOdds };
};


// ─── API publique : moteur principal ──────────────────────────────


export type FindValueBetsScorerInput = {
  /** Fixtures a scanner (vient de l'agreggation amont) */
  apiFootballFixtures: Array<{
    id: number;
    leagueId: number;
    leagueName: string;
    homeTeam: string;
    awayTeam: string;
    commenceTime: string; // ISO
  }>;
  /**
   * Set des fixturesId deja utilisees par les classics. On les exclut
   * pour respecter la regle "max 1 pick par match" (classique OU buteur).
   */
  fixturesUsedByClassics?: Set<number>;
};


/**
 * Detecte les value bets buteurs.
 *
 * Strategie :
 * 1. Pour chaque fixture, verifie : Big 5 + delai > 30min + non utilise par classics
 * 2. Si OK, fetch cotes Bet365 Anytime Goalscorer
 * 3. Pour chaque joueur cote, calcule fair odds via Understat xG
 * 4. Filtre par cote (1.6-5.0) et edge (>= 5%)
 * 5. Garde max 1 par match (le meilleur edge)
 * 6. Anti-saturation finale : max MAX_SCORER_PICKS picks total
 */
export const findValueBetsScorer = async (
  input: FindValueBetsScorerInput
): Promise<ValueBetScorerEngineResult> => {
  const { apiFootballFixtures, fixturesUsedByClassics = new Set() } = input;

  const stats: ValueBetScorerEngineResult["stats"] = {
    fixturesScanned: apiFootballFixtures.length,
    fixturesWithBet365Scorer: 0,
    fixturesRejectedTooLate: 0,
    fixturesNotInBig5: 0,
    candidatesAnalyzed: 0,
    candidatesRejectedNoXG: 0,
    candidatesRejectedOddsRange: 0,
    candidatesRejectedMinEdge: 0,
    valueBetsFound: 0,
    selectedAfterAntiSaturation: 0,
  };

  // Cache Understat : on charge 1x par ligue, pas par fixture
  const understatCache = new Map<number, UnderstatCache | null>();

  const allCandidates: ValueBetScorer[] = [];

  for (const fx of apiFootballFixtures) {
    // Skip si fixture deja utilise par les classics
    if (fixturesUsedByClassics.has(fx.id)) continue;

    // Skip si pas dans les 5 grands championnats supportes par Understat
    if (apiFootballLeagueToUnderstat(fx.leagueId) === null) {
      stats.fixturesNotInBig5 += 1;
      continue;
    }

    // Filtre temporel : minimum 30 min avant kickoff
    const kickoffTime = new Date(fx.commenceTime).getTime();
    const minutesUntilKickoff = (kickoffTime - Date.now()) / (1000 * 60);
    if (minutesUntilKickoff < MIN_MINUTES_BEFORE_KICKOFF) {
      stats.fixturesRejectedTooLate += 1;
      continue;
    }

    // Charge Understat pour cette ligue (cache)
    if (!understatCache.has(fx.leagueId)) {
      const cache = await fetchUnderstatDataForLeague(fx.leagueId);
      understatCache.set(fx.leagueId, cache);
    }
    const cache = understatCache.get(fx.leagueId);
    if (!cache) {
      stats.candidatesRejectedNoXG += 1;
      continue;
    }

    // Fetch cotes Bet365 scorer pour ce match
    const scorerOdds = await fetchBet365ScorerOdds(fx.id);
    if (scorerOdds.length === 0) {
      console.log(
        `[scorer] fixture ${fx.id} (${fx.homeTeam} vs ${fx.awayTeam}) : aucune cote Bet365 anytime goalscorer trouvee`
      );
      continue;
    }
    console.log(
      `[scorer] fixture ${fx.id} (${fx.homeTeam} vs ${fx.awayTeam}) : ${scorerOdds.length} joueurs cotes chez Bet365`
    );
    stats.fixturesWithBet365Scorer += 1;

    // Calculer le multiplicateur defense pour les 2 cotes
    // Si teams Understat indisponibles (endpoint /getTeamsStats KO),
    // on tombe sur 1.0 = defense moyenne, plutot que de skipper le match.
    const homeUnderstatTeam = cache.teams.find((t) =>
      teamsMatchUnderstat(t.title, fx.homeTeam)
    );
    const awayUnderstatTeam = cache.teams.find((t) =>
      teamsMatchUnderstat(t.title, fx.awayTeam)
    );

    const homeMult =
      awayUnderstatTeam && cache.leagueAvgXGA > 0
        ? awayUnderstatTeam.xGA_per_match / cache.leagueAvgXGA
        : 1.0; // attaque home -> defense away
    const awayMult =
      homeUnderstatTeam && cache.leagueAvgXGA > 0
        ? homeUnderstatTeam.xGA_per_match / cache.leagueAvgXGA
        : 1.0; // attaque away -> defense home

    // Pour chaque joueur cote chez Bet365
    const candidatesForFixture: ValueBetScorer[] = [];

    for (const scorer of scorerOdds) {
      stats.candidatesAnalyzed += 1;

      // Filtre cote
      if (scorer.odds < MIN_ODDS_SCORER || scorer.odds > MAX_ODDS_SCORER) {
        stats.candidatesRejectedOddsRange += 1;
        continue;
      }

      // Trouver le joueur dans Understat
      const understatPlayer = findUnderstatPlayerByName(
        cache.players,
        scorer.playerName,
        // On donne pas de teamHint car on ne sait pas dans quelle equipe
        // Bet365 a classe le joueur ; on cherche dans toute la ligue.
        undefined
      );
      if (!understatPlayer) {
        stats.candidatesRejectedNoXG += 1;
        continue;
      }

      // Determiner le cote (home ou away) du joueur
      let playerSide: "home" | "away" | null = null;
      if (teamsMatchUnderstat(understatPlayer.team_title, fx.homeTeam)) {
        playerSide = "home";
      } else if (teamsMatchUnderstat(understatPlayer.team_title, fx.awayTeam)) {
        playerSide = "away";
      }
      if (!playerSide) {
        // Joueur trouve dans la ligue mais pas dans une des 2 equipes du match
        // (ex : transfert recent, homonyme, etc.) → on skip
        stats.candidatesRejectedNoXG += 1;
        continue;
      }

      // Calcul fair odds
      const defenseMultiplier = playerSide === "home" ? homeMult : awayMult;
      const { xG_expected, fairProbability, fairOdds } = computePlayerFairOdds(
        understatPlayer.npxG_per_90,
        defenseMultiplier
      );

      // Edge = (cote_bookmaker / fair_odds - 1) × 100
      // Si bookmaker_odds > fair_odds → on a value
      const edgePct = (scorer.odds / fairOdds - 1) * 100;

      if (edgePct < MIN_EDGE_PCT_SCORER) {
        stats.candidatesRejectedMinEdge += 1;
        continue;
      }

      stats.valueBetsFound += 1;

      candidatesForFixture.push({
        fixtureId: fx.id,
        fixtureRef: String(fx.id),
        apiFootballLeagueId: fx.leagueId,
        league: fx.leagueName,
        homeTeam: fx.homeTeam,
        awayTeam: fx.awayTeam,
        eventName: `${fx.homeTeam} vs ${fx.awayTeam}`,
        commenceTime: fx.commenceTime,
        playerName: scorer.playerName,
        playerTeam: understatPlayer.team_title,
        playerSide,
        npxG_per_90: understatPlayer.npxG_per_90,
        defenseMultiplier,
        xG_expected,
        fairProbability,
        fairOdds,
        bookmakerName: "Bet365",
        bookmakerOdds: scorer.odds,
        edgePct,
      });
    }

    // Pour ce match, on garde 1 SEUL candidat : celui avec le meilleur edge
    if (candidatesForFixture.length > 0) {
      candidatesForFixture.sort((a, b) => b.edgePct - a.edgePct);
      allCandidates.push(candidatesForFixture[0]);
    }
  }

  // Anti-saturation globale : tri par edge desc, max MAX_SCORER_PICKS
  allCandidates.sort((a, b) => b.edgePct - a.edgePct);
  const selected = allCandidates.slice(0, MAX_SCORER_PICKS);
  stats.selectedAfterAntiSaturation = selected.length;

  return {
    selected,
    stats,
  };
};