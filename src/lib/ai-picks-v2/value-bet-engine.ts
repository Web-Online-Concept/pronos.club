/**
 * ═══════════════════════════════════════════════════════════════════
 * value-bet-engine.ts
 * ═══════════════════════════════════════════════════════════════════
 *
 * MOTEUR DE DETECTION DE VALUE BETS +EV
 *
 * Principe : on ne demande JAMAIS aux LLM de "choisir" des picks.
 * On utilise les mathematiques du value betting standard :
 *
 *   1. Pinnacle est le sharp book de reference (vig ~2-3%)
 *   2. On de-vig les cotes Pinnacle (methode multiplicative) pour
 *      obtenir la probabilite "vraie" de chaque issue
 *   3. On cherche dans les 5 autres books (1xbet, Betclic, Winamax,
 *      Unibet, Stake) une cote qui DEPASSE la cote fair Pinnacle
 *   4. Si oui, c'est une value bet : edge = (cote_book / fair_odds - 1) * 100
 *
 * Ensuite on applique :
 *   - Filtre cote dans [1.5, 3.0]
 *   - Filtre edge >= 3%
 *   - Tri par edge decroissant
 *   - Quotas par sport : max 3 picks foot, max 2 picks par autre sport
 *   - Plafond global : max 7 picks
 *
 * ZERO HALLUCINATION POSSIBLE : toutes les cotes proviennent
 * directement d'OddsAPI (donnees reelles bookmakers).
 * ═══════════════════════════════════════════════════════════════════
 */

import type {
  OddsApiBookmaker,
  OddsApiOutcome,
  SimplifiedFixture,
} from "./odds-api-client";


// Seuils configurables
const MIN_ODDS = 1.5;
const MAX_ODDS = 3.0;
const MIN_EDGE_PCT = 3;
const MAX_PICKS = 7;

// Quotas par sport : max picks/jour par categorie
const MAX_PICKS_FOOTBALL = 3;
const MAX_PICKS_OTHER_SPORTS = 2;

/**
 * Marge minimale entre maintenant et le coup d'envoi du match.
 * En dessous, on rejette : les abonnes n'ont plus le temps de parier
 * et les bookmakers freezent souvent les cotes en derniere minute.
 */
const MIN_MINUTES_BEFORE_KICKOFF = 30;

// Books de reference (slug OddsAPI)
const SHARP_BOOK_KEY = "pinnacle";
const SOFT_BOOKS_KEYS = ["onexbet", "betclic_fr", "winamax_fr", "unibet_fr", "stake"];

// Mapping slug -> nom affichage
const BOOK_DISPLAY: Record<string, string> = {
  pinnacle: "PS3838",
  onexbet: "1xbet",
  betclic_fr: "Betclic",
  winamax_fr: "Winamax",
  unibet_fr: "Unibet",
  stake: "Stake",
};


// ─── Types exposes ────────────────────────────────────────────────


export type BookOddsSnapshot = {
  key: string;
  name: string;
  odds: number | null;
};


export type ValueBet = {
  /** Identifiant unique pour dedup : fixtureId + market + selection */
  uniqueKey: string;
  /** Identifiant OddsAPI du fixture */
  fixtureId: string;
  sportKey: string;
  sportTitle: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  eventName: string;
  commenceTime: string;

  /** Market resolu (h2h, totals_2_5, etc.) */
  market: string;
  /** Code market normalise pour la DB (ex: "1N2", "OVER_UNDER_2_5") */
  marketCode: string;
  /** Selection (ex: "Borussia Dortmund", "Plus de 2.5 buts") */
  selection: string;

  /** Cote fair Pinnacle apres de-vig */
  fairOdds: number;
  /** Probabilite vraie implicite */
  fairProbability: number;
  /** Cote brute Pinnacle (avec vig) */
  pinnacleRawOdds: number;

  /** Cote du meilleur soft book (celle qu'on va publier) */
  bestSoftOdds: number;
  bestSoftBookKey: string;
  bestSoftBookName: string;

  /** Edge en % : (bestSoftOdds / fairOdds - 1) * 100 */
  edgePct: number;

  /** Snapshot des 6 books pour la page detail */
  books: BookOddsSnapshot[];
};


export type ValueBetEngineResult = {
  /** Picks selectionnes apres quotas (max 7) */
  selected: ValueBet[];
  /** Toutes les value bets trouvees, triees par edge desc */
  allCandidates: ValueBet[];
  /** Stats du run */
  stats: {
    fixturesScanned: number;
    fixturesWithPinnacle: number;
    fixturesRejectedTooLate: number;
    h2hMarketsAnalyzed: number;
    totalsMarketsAnalyzed: number;
    valueBetsFound: number;
    selectedAfterQuotas: number;
    rejectedByOddsRange: number;
    rejectedByMinEdge: number;
    /** Nombre de picks rejetes parce que quota du sport atteint */
    rejectedByQuota: number;
    /** Repartition finale des picks selectionnes par sport */
    sportDistribution: Record<string, number>;
  };
};


// ─── Helper detection foot ────────────────────────────────────────


/**
 * OddsAPI utilise des sportKey comme :
 *   - soccer_epl, soccer_france_ligue_one, soccer_uefa_champs_league...
 *   - basketball_nba, basketball_euroleague...
 *   - icehockey_nhl, icehockey_sweden_hockey_league...
 *   - tennis_atp_..., tennis_wta_...
 *   - mma_mixed_martial_arts
 *   - americanfootball_nfl
 *   - baseball_mlb
 *   - rugbyleague_nrl, rugbyunion_six_nations...
 *
 * On detecte le foot par prefixe car il y a des dizaines de ligues.
 */
const isFootball = (sportKey: string): boolean => {
  return sportKey.toLowerCase().startsWith("soccer");
};


/**
 * Categorie sport simplifiee pour les quotas.
 * Foot = "football", tout le reste = sportKey brut.
 * Cela permet de regrouper toutes les ligues de foot ensemble
 * (Ligue 1, Premier League, Serie A...) sous un meme quota,
 * tandis que NBA != Euroleague != ACB pour basket.
 *
 * Note : on garde sportKey brut pour les autres sports car la
 * granularite ligue est interessante (eviter 2 picks meme jour
 * sur la meme ligue de basket par exemple).
 */
const getSportCategory = (sportKey: string): string => {
  if (isFootball(sportKey)) return "football";
  return sportKey;
};


// ─── De-vigging multiplicatif (standard pro) ──────────────────────


/**
 * De-vigge un set d'odds via la methode multiplicative.
 *
 * Source : https://edgeslip.com/articles/no-vig
 *
 * Exemple H2H : odds = [1.50, 4.00, 7.00]
 *   prob brutes = [0.667, 0.250, 0.143] = 1.060 (vig = 6%)
 *   prob fair = [0.667/1.060, 0.250/1.060, 0.143/1.060]
 *             = [0.629, 0.236, 0.135] = 1.000
 *   fair odds = [1/0.629, 1/0.236, 1/0.135]
 *             = [1.589, 4.237, 7.407]
 */
const deVigMultiplicative = (rawOdds: number[]): {
  fairOdds: number[];
  fairProbabilities: number[];
  vigPct: number;
} => {
  const probs = rawOdds.map((o) => 1 / o);
  const totalProb = probs.reduce((a, b) => a + b, 0);
  const vigPct = (totalProb - 1) * 100;
  const fairProbs = probs.map((p) => p / totalProb);
  const fairOdds = fairProbs.map((p) => 1 / p);
  return { fairOdds, fairProbabilities: fairProbs, vigPct };
};


// ─── Helpers extraction markets ───────────────────────────────────


type H2HSet = {
  homeOdds: number;
  drawOdds: number | null;
  awayOdds: number;
  homeName: string;
  drawName: string | null;
  awayName: string;
};


/**
 * Extrait le market h2h d'un bookmaker, en retournant les outcomes
 * dans l'ordre [home, draw?, away].
 */
const extractH2H = (
  bookmaker: OddsApiBookmaker,
  homeTeam: string,
  awayTeam: string
): H2HSet | null => {
  const market = bookmaker.markets.find((m) => m.key === "h2h");
  if (!market || market.outcomes.length < 2) return null;

  const home = market.outcomes.find((o) => o.name === homeTeam);
  const away = market.outcomes.find((o) => o.name === awayTeam);
  const draw = market.outcomes.find((o) => o.name === "Draw");

  if (!home || !away) return null;

  return {
    homeOdds: home.price,
    drawOdds: draw?.price ?? null,
    awayOdds: away.price,
    homeName: homeTeam,
    drawName: draw ? "Draw" : null,
    awayName: awayTeam,
  };
};


/**
 * Extrait toutes les paires Over/Under d'un bookmaker.
 * Cherche dans "totals" ET "alternate_totals" et retourne
 * pour chaque point trouve une paire complete (over + under).
 */
type TotalsSet = {
  point: number;
  overOdds: number;
  underOdds: number;
};

const extractTotals = (bookmaker: OddsApiBookmaker): TotalsSet[] => {
  const result: TotalsSet[] = [];
  const allOutcomes: OddsApiOutcome[] = [];

  const main = bookmaker.markets.find((m) => m.key === "totals");
  const alt = bookmaker.markets.find((m) => m.key === "alternate_totals");

  if (main) allOutcomes.push(...main.outcomes);
  if (alt) allOutcomes.push(...alt.outcomes);

  // Grouper par point
  const byPoint = new Map<number, { over?: number; under?: number }>();
  for (const o of allOutcomes) {
    if (typeof o.point !== "number") continue;
    const entry = byPoint.get(o.point) ?? {};
    if (o.name === "Over") entry.over = o.price;
    if (o.name === "Under") entry.under = o.price;
    byPoint.set(o.point, entry);
  }

  for (const [point, { over, under }] of byPoint.entries()) {
    if (typeof over === "number" && typeof under === "number") {
      result.push({ point, overOdds: over, underOdds: under });
    }
  }

  return result;
};


// ─── Detection des value bets pour un fixture ────────────────────


type ValueBetCandidate = Omit<ValueBet, "books">;


const detectValueBetsForFixture = (
  fixture: SimplifiedFixture,
  stats: ValueBetEngineResult["stats"]
): ValueBetCandidate[] => {
  const results: ValueBetCandidate[] = [];

  // ─── Filtre temporel ───────────────────────
  // Le match doit commencer dans plus de MIN_MINUTES_BEFORE_KICKOFF
  // pour laisser aux abonnes le temps de parier.
  const kickoffTime = new Date(fixture.commenceTime).getTime();
  const now = Date.now();
  const minutesUntilKickoff = (kickoffTime - now) / (1000 * 60);
  if (minutesUntilKickoff < MIN_MINUTES_BEFORE_KICKOFF) {
    stats.fixturesRejectedTooLate += 1;
    return results;
  }

  const pinnacle = fixture.rawBookmakers.find((b) => b.key === SHARP_BOOK_KEY);
  if (!pinnacle) return results;

  stats.fixturesWithPinnacle += 1;

  // ─── H2H ───────────────────────────────────
  const pinnacleH2H = extractH2H(pinnacle, fixture.homeTeam, fixture.awayTeam);
  if (pinnacleH2H) {
    stats.h2hMarketsAnalyzed += 1;

    // De-vig sur les cotes Pinnacle
    const rawOdds: number[] = [pinnacleH2H.homeOdds];
    const labels: Array<{
      label: "home" | "draw" | "away";
      teamName: string;
    }> = [{ label: "home", teamName: pinnacleH2H.homeName }];
    if (pinnacleH2H.drawOdds && pinnacleH2H.drawName) {
      rawOdds.push(pinnacleH2H.drawOdds);
      labels.push({ label: "draw", teamName: pinnacleH2H.drawName });
    }
    rawOdds.push(pinnacleH2H.awayOdds);
    labels.push({ label: "away", teamName: pinnacleH2H.awayName });

    const { fairOdds, fairProbabilities } = deVigMultiplicative(rawOdds);

    // Pour chaque issue, chercher la meilleure cote dans les soft books
    for (let i = 0; i < labels.length; i += 1) {
      const fair = fairOdds[i];
      const fairProb = fairProbabilities[i];
      const pinnacleRaw = rawOdds[i];
      const target = labels[i];

      // Filtre cote (sur la cote soft cible)
      // On filtre apres avoir trouve la best soft odds

      // Trouver la meilleure cote soft pour cette issue
      let bestSoftOdds = 0;
      let bestSoftKey = "";
      for (const softKey of SOFT_BOOKS_KEYS) {
        const softBook = fixture.rawBookmakers.find((b) => b.key === softKey);
        if (!softBook) continue;
        const softH2H = extractH2H(softBook, fixture.homeTeam, fixture.awayTeam);
        if (!softH2H) continue;

        let softOdds = 0;
        if (target.label === "home") softOdds = softH2H.homeOdds;
        else if (target.label === "away") softOdds = softH2H.awayOdds;
        else if (target.label === "draw" && softH2H.drawOdds)
          softOdds = softH2H.drawOdds;

        if (softOdds > bestSoftOdds) {
          bestSoftOdds = softOdds;
          bestSoftKey = softKey;
        }
      }

      if (bestSoftOdds === 0) continue; // Aucun soft book n'a cote

      // Filtre cote dans la fourchette
      if (bestSoftOdds < MIN_ODDS || bestSoftOdds > MAX_ODDS) {
        stats.rejectedByOddsRange += 1;
        continue;
      }

      // Edge
      const edgePct = ((bestSoftOdds / fair) - 1) * 100;
      if (edgePct < MIN_EDGE_PCT) {
        stats.rejectedByMinEdge += 1;
        continue;
      }

      // Selection francaise
      const selection =
        target.label === "draw"
          ? "Match nul"
          : target.label === "home"
          ? fixture.homeTeam
          : fixture.awayTeam;

      results.push({
        uniqueKey: `${fixture.externalId}|h2h|${target.label}`,
        fixtureId: fixture.externalId,
        sportKey: fixture.sportKey,
        sportTitle: fixture.sportTitle,
        league: fixture.league,
        homeTeam: fixture.homeTeam,
        awayTeam: fixture.awayTeam,
        eventName: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
        commenceTime: fixture.commenceTime,
        market: "h2h",
        marketCode: "1N2",
        selection,
        fairOdds: fair,
        fairProbability: fairProb,
        pinnacleRawOdds: pinnacleRaw,
        bestSoftOdds,
        bestSoftBookKey: bestSoftKey,
        bestSoftBookName: BOOK_DISPLAY[bestSoftKey] ?? bestSoftKey,
        edgePct,
      });
    }
  }

  // ─── Totals (Over/Under) ───────────────────
  const pinnacleTotals = extractTotals(pinnacle);
  for (const pinnacleTotal of pinnacleTotals) {
    stats.totalsMarketsAnalyzed += 1;

    // De-vig 2 issues : Over et Under
    const rawOdds = [pinnacleTotal.overOdds, pinnacleTotal.underOdds];
    const { fairOdds, fairProbabilities } = deVigMultiplicative(rawOdds);

    const sides: Array<{ label: "over" | "under"; idx: number }> = [
      { label: "over", idx: 0 },
      { label: "under", idx: 1 },
    ];

    for (const side of sides) {
      const fair = fairOdds[side.idx];
      const fairProb = fairProbabilities[side.idx];
      const pinnacleRaw = rawOdds[side.idx];

      // Trouver le meilleur soft book qui cote ce point + cette side
      let bestSoftOdds = 0;
      let bestSoftKey = "";
      for (const softKey of SOFT_BOOKS_KEYS) {
        const softBook = fixture.rawBookmakers.find((b) => b.key === softKey);
        if (!softBook) continue;
        const softTotals = extractTotals(softBook);
        const matchingPoint = softTotals.find(
          (t) => t.point === pinnacleTotal.point
        );
        if (!matchingPoint) continue;
        const softOdds =
          side.label === "over" ? matchingPoint.overOdds : matchingPoint.underOdds;
        if (softOdds > bestSoftOdds) {
          bestSoftOdds = softOdds;
          bestSoftKey = softKey;
        }
      }

      if (bestSoftOdds === 0) continue;
      if (bestSoftOdds < MIN_ODDS || bestSoftOdds > MAX_ODDS) {
        stats.rejectedByOddsRange += 1;
        continue;
      }

      const edgePct = ((bestSoftOdds / fair) - 1) * 100;
      if (edgePct < MIN_EDGE_PCT) {
        stats.rejectedByMinEdge += 1;
        continue;
      }

      // Code market et selection en francais
      const pointStr = pinnacleTotal.point.toString().replace(".", "_");
      const marketCode = `OVER_UNDER_${pointStr}`;
      const selection =
        side.label === "over"
          ? `Plus de ${pinnacleTotal.point} buts`
          : `Moins de ${pinnacleTotal.point} buts`;

      results.push({
        uniqueKey: `${fixture.externalId}|totals_${pointStr}|${side.label}`,
        fixtureId: fixture.externalId,
        sportKey: fixture.sportKey,
        sportTitle: fixture.sportTitle,
        league: fixture.league,
        homeTeam: fixture.homeTeam,
        awayTeam: fixture.awayTeam,
        eventName: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
        commenceTime: fixture.commenceTime,
        market: `totals_${pointStr}`,
        marketCode,
        selection,
        fairOdds: fair,
        fairProbability: fairProb,
        pinnacleRawOdds: pinnacleRaw,
        bestSoftOdds,
        bestSoftBookKey: bestSoftKey,
        bestSoftBookName: BOOK_DISPLAY[bestSoftKey] ?? bestSoftKey,
        edgePct,
      });
    }
  }

  return results;
};


// ─── Snapshot des 6 books pour la page detail ────────────────────


const buildBooksSnapshot = (
  fixture: SimplifiedFixture,
  market: string,
  selection: string,
  marketCode: string
): BookOddsSnapshot[] => {
  const books: BookOddsSnapshot[] = [];
  const allBookKeys = [SHARP_BOOK_KEY, ...SOFT_BOOKS_KEYS];

  for (const bookKey of allBookKeys) {
    const bk = fixture.rawBookmakers.find((b) => b.key === bookKey);
    const name = BOOK_DISPLAY[bookKey] ?? bookKey;

    if (!bk) {
      books.push({ key: bookKey, name, odds: null });
      continue;
    }

    let odds: number | null = null;

    if (market === "h2h") {
      const h2h = extractH2H(bk, fixture.homeTeam, fixture.awayTeam);
      if (h2h) {
        if (selection === "Match nul") odds = h2h.drawOdds;
        else if (selection === fixture.homeTeam) odds = h2h.homeOdds;
        else if (selection === fixture.awayTeam) odds = h2h.awayOdds;
      }
    } else if (market.startsWith("totals_")) {
      // marketCode = "OVER_UNDER_2_5"
      const pointStr = marketCode.replace("OVER_UNDER_", "").replace("_", ".");
      const point = parseFloat(pointStr);
      const totals = extractTotals(bk);
      const matching = totals.find((t) => t.point === point);
      if (matching) {
        if (selection.startsWith("Plus de")) odds = matching.overOdds;
        else if (selection.startsWith("Moins de")) odds = matching.underOdds;
      }
    }

    books.push({ key: bookKey, name, odds });
  }

  return books;
};


// ─── Selection avec quotas par sport ─────────────────────────────


/**
 * Selection greedy par edge decroissant en respectant les quotas :
 *   - Foot (toutes ligues confondues) : max 3 picks
 *   - Tout autre sport : max 2 picks par sportKey
 *   - Plafond global : 7 picks
 *   - Pas 2 picks sur le meme fixture
 *
 * Si un sport ne produit pas de candidate ce jour-la, on ne le force
 * pas : on ne sort que des picks ayant edge >= 3% (qualite > quantite).
 */
const applySportQuotas = (
  candidates: ValueBetCandidate[],
  fixturesById: Map<string, SimplifiedFixture>,
  stats: ValueBetEngineResult["stats"]
): ValueBet[] => {
  // Tri par edge desc — qualite avant tout
  const sorted = [...candidates].sort((a, b) => b.edgePct - a.edgePct);

  const selected: ValueBet[] = [];
  const fixturesUsed = new Set<string>();
  const sportCounts = new Map<string, number>();

  for (const cand of sorted) {
    if (selected.length >= MAX_PICKS) break;

    // Pas 2 picks sur le meme fixture
    if (fixturesUsed.has(cand.fixtureId)) continue;

    // Resoudre la categorie sport (foot regroupe, autres = sportKey brut)
    const category = getSportCategory(cand.sportKey);
    const currentCount = sportCounts.get(category) ?? 0;

    // Quota : 3 pour foot, 2 pour le reste
    const maxForCategory = category === "football"
      ? MAX_PICKS_FOOTBALL
      : MAX_PICKS_OTHER_SPORTS;

    if (currentCount >= maxForCategory) {
      stats.rejectedByQuota += 1;
      continue;
    }

    // Snapshot books a la volee
    const fixture = fixturesById.get(cand.fixtureId);
    const books = fixture
      ? buildBooksSnapshot(fixture, cand.market, cand.selection, cand.marketCode)
      : [];

    selected.push({ ...cand, books });
    fixturesUsed.add(cand.fixtureId);
    sportCounts.set(category, currentCount + 1);
  }

  // Repartition finale pour stats
  stats.sportDistribution = Object.fromEntries(sportCounts.entries());

  return selected;
};


// ─── API publique ─────────────────────────────────────────────────


export const findValueBets = (
  oddsApiFixtures: SimplifiedFixture[]
): ValueBetEngineResult => {
  const stats: ValueBetEngineResult["stats"] = {
    fixturesScanned: oddsApiFixtures.length,
    fixturesWithPinnacle: 0,
    fixturesRejectedTooLate: 0,
    h2hMarketsAnalyzed: 0,
    totalsMarketsAnalyzed: 0,
    valueBetsFound: 0,
    selectedAfterQuotas: 0,
    rejectedByOddsRange: 0,
    rejectedByMinEdge: 0,
    rejectedByQuota: 0,
    sportDistribution: {},
  };

  // Detection brute toutes fixtures
  const allCandidatesRaw: ValueBetCandidate[] = [];
  const fixturesById = new Map<string, SimplifiedFixture>();
  for (const fixture of oddsApiFixtures) {
    fixturesById.set(fixture.externalId, fixture);
    const candidates = detectValueBetsForFixture(fixture, stats);
    allCandidatesRaw.push(...candidates);
  }

  stats.valueBetsFound = allCandidatesRaw.length;

  // Application des quotas par sport
  const selected = applySportQuotas(allCandidatesRaw, fixturesById, stats);
  stats.selectedAfterQuotas = selected.length;

  // Pour les "all candidates" exposes, on ajoute aussi le snapshot books
  // pour audit/debug (mais sans dedup fixture)
  const allCandidates: ValueBet[] = allCandidatesRaw
    .sort((a, b) => b.edgePct - a.edgePct)
    .map((c) => {
      const fixture = fixturesById.get(c.fixtureId);
      const books = fixture
        ? buildBooksSnapshot(fixture, c.market, c.selection, c.marketCode)
        : [];
      return { ...c, books };
    });

  return { selected, allCandidates, stats };
};