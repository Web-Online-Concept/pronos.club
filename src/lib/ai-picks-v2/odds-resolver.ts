/**
 * ═══════════════════════════════════════════════════════════════════
 * odds-resolver.ts
 * ═══════════════════════════════════════════════════════════════════
 *
 * RESOLVER DE COTES — ANTI-HALLUCINATION
 *
 * Quand un LLM (Claude/GPT) propose un pick "PSG gagne", il ne doit
 * JAMAIS fournir lui-meme la cote (risque d'hallucination prouve en
 * V1 historique). Ce fichier prend en entree la combinaison
 * (fixtureId, market, selection) et retourne la VRAIE cote depuis
 * les donnees OddsAPI deja fetchees.
 *
 * Strategie : best soft odds parmi les 5 books soft du tipster
 * (1xbet, Betclic, Winamax, Unibet, Stake). Pinnacle est exclu
 * volontairement de la "cote publiable" car les abonnes ne parient
 * pas chez Pinnacle (utilise comme reference fair odds dans le
 * value-bet-engine).
 *
 * Markets supportes :
 *   - 1N2 (h2h)
 *   - OVER_UNDER_X_Y (totals + alternate_totals)
 *   - DOUBLE_CHANCE (necessite market "double_chance" fetched)
 *   - BTTS (necessite market "btts" fetched, foot uniquement)
 *
 * Si la cote n'existe pas (selection introuvable) ou est hors range
 * [1.40, 3.00], le pick est rejete et jamais persiste.
 * ═══════════════════════════════════════════════════════════════════
 */

import type {
  OddsApiBookmaker,
  OddsApiOutcome,
  SimplifiedFixture,
} from "./odds-api-client";


// Range de cote acceptable (cohherent avec value-bet-engine)
const MIN_ODDS = 1.4;
const MAX_ODDS = 3.0;

// Books soft (ceux ou les abonnes parient reellement)
const SOFT_BOOKS_KEYS = ["onexbet", "betclic_fr", "winamax_fr", "unibet_fr", "stake"];
const SHARP_BOOK_KEY = "pinnacle";

// Mapping slug -> nom affichage (cohherent avec value-bet-engine)
const BOOK_DISPLAY: Record<string, string> = {
  pinnacle: "PS3838",
  onexbet: "1xbet",
  betclic_fr: "Betclic",
  winamax_fr: "Winamax",
  unibet_fr: "Unibet",
  stake: "Stake",
};


// ─── Types exposes ────────────────────────────────────────────────


export type BookSnapshot = {
  key: string;
  name: string;
  odds: number | null;
};


export type OddsResolveSuccess = {
  resolved: true;
  odds: number;
  bookmakerKey: string;
  bookmakerName: string;
  /** Snapshot des 6 books pour la page detail */
  books: BookSnapshot[];
  /** Cote brute Pinnacle (pour affichage "fair odds" si utile) */
  pinnacleRawOdds: number | null;
};


export type OddsResolveFailure = {
  resolved: false;
  reason:
    | "fixture_not_found"
    | "market_not_supported"
    | "selection_not_found"
    | "no_soft_book_odds"
    | "odds_out_of_range";
  details?: string;
};


export type OddsResolveResult = OddsResolveSuccess | OddsResolveFailure;


export type ResolveInput = {
  /** Liste de fixtures OddsAPI deja fetchee (oddsApiAllFixtures) */
  fixtures: SimplifiedFixture[];
  /** externalId OddsAPI du fixture */
  fixtureId: string;
  /** Code marche normalise : "1N2", "DOUBLE_CHANCE", "OVER_UNDER_2_5", "BTTS" */
  market: string;
  /**
   * Selection en francais (telle que sortie par le LLM).
   * Exemples : "Real Madrid", "Match nul", "Plus de 2.5 buts",
   * "1X", "Les deux equipes marquent : OUI"
   */
  selection: string;
  /** Nom equipe domicile et exterieur (pour matching fuzzy 1N2) */
  homeTeam: string;
  awayTeam: string;
};


// ─── Helpers fuzzy team matching ──────────────────────────────────


/**
 * Normalise un nom d'equipe pour matching tolerant :
 * - lowercase
 * - retire accents
 * - retire ponctuation
 * - retire mots communs (CF, FC, AC, Real, etc. quand ils gênent)
 */
const normalizeTeamName = (name: string): string => {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // retire accents
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};


/**
 * Test si 2 noms d'equipe correspondent (l'un contient l'autre apres
 * normalisation). Permet de matcher "Real Madrid" avec "Real Madrid CF"
 * ou "PSG" avec "Paris Saint-Germain".
 */
const teamsMatch = (a: string, b: string): boolean => {
  const na = normalizeTeamName(a);
  const nb = normalizeTeamName(b);
  if (na === nb) return true;
  // Match si l'un contient l'autre (et au moins 4 chars communs)
  if (na.length >= 4 && nb.includes(na)) return true;
  if (nb.length >= 4 && na.includes(nb)) return true;
  return false;
};


// ─── Helpers extraction markets ───────────────────────────────────


type H2HSet = {
  homeOdds: number;
  drawOdds: number | null;
  awayOdds: number;
  homeName: string;
  awayName: string;
};


const extractH2H = (
  bookmaker: OddsApiBookmaker,
  homeTeam: string,
  awayTeam: string
): H2HSet | null => {
  const market = bookmaker.markets.find((m) => m.key === "h2h");
  if (!market || market.outcomes.length < 2) return null;

  const home = market.outcomes.find((o) => teamsMatch(o.name, homeTeam));
  const away = market.outcomes.find((o) => teamsMatch(o.name, awayTeam));
  const draw = market.outcomes.find((o) => o.name === "Draw");

  if (!home || !away) return null;

  return {
    homeOdds: home.price,
    drawOdds: draw?.price ?? null,
    awayOdds: away.price,
    homeName: home.name,
    awayName: away.name,
  };
};


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


/**
 * Extrait les cotes Double Chance d'un bookmaker.
 * OddsAPI renvoie 3 outcomes nommes "{home} or Draw", "{home} or {away}",
 * "Draw or {away}" — on les map vers 1X/12/X2.
 */
type DoubleChanceSet = {
  oneX: number | null;  // home or draw
  twelve: number | null; // home or away
  xTwo: number | null;  // draw or away
};


const extractDoubleChance = (
  bookmaker: OddsApiBookmaker,
  homeTeam: string,
  awayTeam: string
): DoubleChanceSet | null => {
  const market = bookmaker.markets.find((m) => m.key === "double_chance");
  if (!market || market.outcomes.length === 0) return null;

  let oneX: number | null = null;
  let twelve: number | null = null;
  let xTwo: number | null = null;

  for (const o of market.outcomes) {
    const nameLower = o.name.toLowerCase();
    const hasHome = teamsMatch(o.name, homeTeam);
    const hasAway = teamsMatch(o.name, awayTeam);
    const hasDraw = nameLower.includes("draw");

    if (hasHome && hasDraw) oneX = o.price;
    else if (hasAway && hasDraw) xTwo = o.price;
    else if (hasHome && hasAway) twelve = o.price;
  }

  if (oneX === null && twelve === null && xTwo === null) return null;
  return { oneX, twelve, xTwo };
};


/**
 * Extrait les cotes BTTS (both teams to score) d'un bookmaker.
 * OddsAPI renvoie 2 outcomes "Yes" et "No".
 */
type BttsSet = {
  yes: number | null;
  no: number | null;
};


const extractBtts = (bookmaker: OddsApiBookmaker): BttsSet | null => {
  const market = bookmaker.markets.find((m) => m.key === "btts");
  if (!market || market.outcomes.length === 0) return null;

  const yes = market.outcomes.find((o) => o.name === "Yes")?.price ?? null;
  const no = market.outcomes.find((o) => o.name === "No")?.price ?? null;

  if (yes === null && no === null) return null;
  return { yes, no };
};


// ─── Parse de la selection LLM ────────────────────────────────────


type ParsedSelection =
  | { kind: "h2h"; side: "home" | "draw" | "away" }
  | { kind: "totals"; point: number; side: "over" | "under" }
  | { kind: "double_chance"; combo: "1X" | "X2" | "12" }
  | { kind: "btts"; yes: boolean }
  | { kind: "unknown"; raw: string };


/**
 * Parse la selection francaise sortie par le LLM en intent structure.
 * Le LLM peut retourner des variations ("Match nul" / "Nul" / "Draw"),
 * on tolere les principales formes.
 */
const parseSelection = (
  market: string,
  selection: string,
  homeTeam: string,
  awayTeam: string
): ParsedSelection => {
  const sel = selection.trim();
  const selLower = sel.toLowerCase();

  // ─── 1N2 ─────────────────────────────────
  if (market === "1N2") {
    if (
      selLower === "match nul" ||
      selLower === "nul" ||
      selLower === "draw" ||
      selLower === "n"
    ) {
      return { kind: "h2h", side: "draw" };
    }
    if (teamsMatch(sel, homeTeam)) return { kind: "h2h", side: "home" };
    if (teamsMatch(sel, awayTeam)) return { kind: "h2h", side: "away" };
    return { kind: "unknown", raw: sel };
  }

  // ─── OVER_UNDER_X_Y ───────────────────────
  if (market.startsWith("OVER_UNDER_")) {
    const pointStr = market.replace("OVER_UNDER_", "").replace("_", ".");
    const point = parseFloat(pointStr);
    if (Number.isNaN(point)) return { kind: "unknown", raw: sel };

    if (selLower.startsWith("plus de") || selLower.startsWith("over")) {
      return { kind: "totals", point, side: "over" };
    }
    if (selLower.startsWith("moins de") || selLower.startsWith("under")) {
      return { kind: "totals", point, side: "under" };
    }
    return { kind: "unknown", raw: sel };
  }

  // ─── DOUBLE_CHANCE ────────────────────────
  if (market === "DOUBLE_CHANCE") {
    if (selLower === "1x" || selLower === "x2" || selLower === "12") {
      return { kind: "double_chance", combo: selLower.toUpperCase() as "1X" | "X2" | "12" };
    }
    return { kind: "unknown", raw: sel };
  }

  // ─── BTTS ─────────────────────────────────
  if (market === "BTTS") {
    if (selLower.includes("oui") || selLower.includes("yes")) {
      return { kind: "btts", yes: true };
    }
    if (selLower.includes("non") || selLower.includes("no")) {
      return { kind: "btts", yes: false };
    }
    return { kind: "unknown", raw: sel };
  }

  return { kind: "unknown", raw: sel };
};


// ─── Resolution h2h (1N2) ─────────────────────────────────────────


const resolveH2H = (
  fixture: SimplifiedFixture,
  side: "home" | "draw" | "away"
): OddsResolveResult => {
  let bestOdds = 0;
  let bestKey = "";

  for (const softKey of SOFT_BOOKS_KEYS) {
    const bk = fixture.rawBookmakers.find((b) => b.key === softKey);
    if (!bk) continue;
    const h2h = extractH2H(bk, fixture.homeTeam, fixture.awayTeam);
    if (!h2h) continue;

    let odds = 0;
    if (side === "home") odds = h2h.homeOdds;
    else if (side === "away") odds = h2h.awayOdds;
    else if (side === "draw" && h2h.drawOdds) odds = h2h.drawOdds;

    if (odds > bestOdds) {
      bestOdds = odds;
      bestKey = softKey;
    }
  }

  if (bestOdds === 0) {
    return {
      resolved: false,
      reason: "no_soft_book_odds",
      details: `Aucun book soft ne cote ${side} sur ${fixture.homeTeam} vs ${fixture.awayTeam}`,
    };
  }

  if (bestOdds < MIN_ODDS || bestOdds > MAX_ODDS) {
    return {
      resolved: false,
      reason: "odds_out_of_range",
      details: `Cote ${bestOdds} hors range [${MIN_ODDS}, ${MAX_ODDS}]`,
    };
  }

  const books = buildH2HBooksSnapshot(fixture, side);
  const pinnacleRaw = books.find((b) => b.key === SHARP_BOOK_KEY)?.odds ?? null;

  return {
    resolved: true,
    odds: bestOdds,
    bookmakerKey: bestKey,
    bookmakerName: BOOK_DISPLAY[bestKey] ?? bestKey,
    books,
    pinnacleRawOdds: pinnacleRaw,
  };
};


const buildH2HBooksSnapshot = (
  fixture: SimplifiedFixture,
  side: "home" | "draw" | "away"
): BookSnapshot[] => {
  const books: BookSnapshot[] = [];
  const allKeys = [SHARP_BOOK_KEY, ...SOFT_BOOKS_KEYS];

  for (const bookKey of allKeys) {
    const bk = fixture.rawBookmakers.find((b) => b.key === bookKey);
    const name = BOOK_DISPLAY[bookKey] ?? bookKey;

    if (!bk) {
      books.push({ key: bookKey, name, odds: null });
      continue;
    }

    const h2h = extractH2H(bk, fixture.homeTeam, fixture.awayTeam);
    let odds: number | null = null;
    if (h2h) {
      if (side === "home") odds = h2h.homeOdds;
      else if (side === "away") odds = h2h.awayOdds;
      else if (side === "draw") odds = h2h.drawOdds;
    }

    books.push({ key: bookKey, name, odds });
  }

  return books;
};


// ─── Resolution totals (Over/Under) ───────────────────────────────


const resolveTotals = (
  fixture: SimplifiedFixture,
  point: number,
  side: "over" | "under"
): OddsResolveResult => {
  let bestOdds = 0;
  let bestKey = "";

  for (const softKey of SOFT_BOOKS_KEYS) {
    const bk = fixture.rawBookmakers.find((b) => b.key === softKey);
    if (!bk) continue;
    const totals = extractTotals(bk);
    const matching = totals.find((t) => t.point === point);
    if (!matching) continue;

    const odds = side === "over" ? matching.overOdds : matching.underOdds;

    if (odds > bestOdds) {
      bestOdds = odds;
      bestKey = softKey;
    }
  }

  if (bestOdds === 0) {
    return {
      resolved: false,
      reason: "no_soft_book_odds",
      details: `Aucun book soft ne cote ${side} ${point} sur ${fixture.homeTeam} vs ${fixture.awayTeam}`,
    };
  }

  if (bestOdds < MIN_ODDS || bestOdds > MAX_ODDS) {
    return {
      resolved: false,
      reason: "odds_out_of_range",
      details: `Cote ${bestOdds} hors range [${MIN_ODDS}, ${MAX_ODDS}]`,
    };
  }

  const books = buildTotalsBooksSnapshot(fixture, point, side);
  const pinnacleRaw = books.find((b) => b.key === SHARP_BOOK_KEY)?.odds ?? null;

  return {
    resolved: true,
    odds: bestOdds,
    bookmakerKey: bestKey,
    bookmakerName: BOOK_DISPLAY[bestKey] ?? bestKey,
    books,
    pinnacleRawOdds: pinnacleRaw,
  };
};


const buildTotalsBooksSnapshot = (
  fixture: SimplifiedFixture,
  point: number,
  side: "over" | "under"
): BookSnapshot[] => {
  const books: BookSnapshot[] = [];
  const allKeys = [SHARP_BOOK_KEY, ...SOFT_BOOKS_KEYS];

  for (const bookKey of allKeys) {
    const bk = fixture.rawBookmakers.find((b) => b.key === bookKey);
    const name = BOOK_DISPLAY[bookKey] ?? bookKey;

    if (!bk) {
      books.push({ key: bookKey, name, odds: null });
      continue;
    }

    const totals = extractTotals(bk);
    const matching = totals.find((t) => t.point === point);
    let odds: number | null = null;
    if (matching) {
      odds = side === "over" ? matching.overOdds : matching.underOdds;
    }

    books.push({ key: bookKey, name, odds });
  }

  return books;
};


// ─── Resolution Double Chance ─────────────────────────────────────


const resolveDoubleChance = (
  fixture: SimplifiedFixture,
  combo: "1X" | "X2" | "12"
): OddsResolveResult => {
  let bestOdds = 0;
  let bestKey = "";

  for (const softKey of SOFT_BOOKS_KEYS) {
    const bk = fixture.rawBookmakers.find((b) => b.key === softKey);
    if (!bk) continue;
    const dc = extractDoubleChance(bk, fixture.homeTeam, fixture.awayTeam);
    if (!dc) continue;

    let odds: number | null = null;
    if (combo === "1X") odds = dc.oneX;
    else if (combo === "12") odds = dc.twelve;
    else if (combo === "X2") odds = dc.xTwo;

    if (odds && odds > bestOdds) {
      bestOdds = odds;
      bestKey = softKey;
    }
  }

  if (bestOdds === 0) {
    return {
      resolved: false,
      reason: "no_soft_book_odds",
      details: `Aucun book soft ne cote ${combo} sur ${fixture.homeTeam} vs ${fixture.awayTeam}`,
    };
  }

  if (bestOdds < MIN_ODDS || bestOdds > MAX_ODDS) {
    return {
      resolved: false,
      reason: "odds_out_of_range",
      details: `Cote ${bestOdds} hors range [${MIN_ODDS}, ${MAX_ODDS}]`,
    };
  }

  const books = buildDoubleChanceBooksSnapshot(fixture, combo);
  const pinnacleRaw = books.find((b) => b.key === SHARP_BOOK_KEY)?.odds ?? null;

  return {
    resolved: true,
    odds: bestOdds,
    bookmakerKey: bestKey,
    bookmakerName: BOOK_DISPLAY[bestKey] ?? bestKey,
    books,
    pinnacleRawOdds: pinnacleRaw,
  };
};


const buildDoubleChanceBooksSnapshot = (
  fixture: SimplifiedFixture,
  combo: "1X" | "X2" | "12"
): BookSnapshot[] => {
  const books: BookSnapshot[] = [];
  const allKeys = [SHARP_BOOK_KEY, ...SOFT_BOOKS_KEYS];

  for (const bookKey of allKeys) {
    const bk = fixture.rawBookmakers.find((b) => b.key === bookKey);
    const name = BOOK_DISPLAY[bookKey] ?? bookKey;

    if (!bk) {
      books.push({ key: bookKey, name, odds: null });
      continue;
    }

    const dc = extractDoubleChance(bk, fixture.homeTeam, fixture.awayTeam);
    let odds: number | null = null;
    if (dc) {
      if (combo === "1X") odds = dc.oneX;
      else if (combo === "12") odds = dc.twelve;
      else if (combo === "X2") odds = dc.xTwo;
    }

    books.push({ key: bookKey, name, odds });
  }

  return books;
};


// ─── Resolution BTTS ──────────────────────────────────────────────


const resolveBtts = (
  fixture: SimplifiedFixture,
  yes: boolean
): OddsResolveResult => {
  let bestOdds = 0;
  let bestKey = "";

  for (const softKey of SOFT_BOOKS_KEYS) {
    const bk = fixture.rawBookmakers.find((b) => b.key === softKey);
    if (!bk) continue;
    const btts = extractBtts(bk);
    if (!btts) continue;

    const odds = yes ? btts.yes : btts.no;
    if (odds && odds > bestOdds) {
      bestOdds = odds;
      bestKey = softKey;
    }
  }

  if (bestOdds === 0) {
    return {
      resolved: false,
      reason: "no_soft_book_odds",
      details: `Aucun book soft ne cote BTTS ${yes ? "Yes" : "No"} sur ${fixture.homeTeam} vs ${fixture.awayTeam}`,
    };
  }

  if (bestOdds < MIN_ODDS || bestOdds > MAX_ODDS) {
    return {
      resolved: false,
      reason: "odds_out_of_range",
      details: `Cote ${bestOdds} hors range [${MIN_ODDS}, ${MAX_ODDS}]`,
    };
  }

  const books = buildBttsBooksSnapshot(fixture, yes);
  const pinnacleRaw = books.find((b) => b.key === SHARP_BOOK_KEY)?.odds ?? null;

  return {
    resolved: true,
    odds: bestOdds,
    bookmakerKey: bestKey,
    bookmakerName: BOOK_DISPLAY[bestKey] ?? bestKey,
    books,
    pinnacleRawOdds: pinnacleRaw,
  };
};


const buildBttsBooksSnapshot = (
  fixture: SimplifiedFixture,
  yes: boolean
): BookSnapshot[] => {
  const books: BookSnapshot[] = [];
  const allKeys = [SHARP_BOOK_KEY, ...SOFT_BOOKS_KEYS];

  for (const bookKey of allKeys) {
    const bk = fixture.rawBookmakers.find((b) => b.key === bookKey);
    const name = BOOK_DISPLAY[bookKey] ?? bookKey;

    if (!bk) {
      books.push({ key: bookKey, name, odds: null });
      continue;
    }

    const btts = extractBtts(bk);
    let odds: number | null = null;
    if (btts) {
      odds = yes ? btts.yes : btts.no;
    }

    books.push({ key: bookKey, name, odds });
  }

  return books;
};


// ─── API publique ─────────────────────────────────────────────────


/**
 * Resout un pick LLM en cote reelle. Retourne l'objet success ou
 * failure avec raison precise (pour stats / logs).
 */
export const resolveOdds = (input: ResolveInput): OddsResolveResult => {
  const { fixtures, fixtureId, market, selection, homeTeam, awayTeam } = input;

  // 1. Trouver le fixture
  const fixture = fixtures.find((f) => f.externalId === fixtureId);
  if (!fixture) {
    return {
      resolved: false,
      reason: "fixture_not_found",
      details: `Fixture ${fixtureId} introuvable dans les donnees OddsAPI`,
    };
  }

  // 2. Parser la selection LLM en intent structure
  const parsed = parseSelection(market, selection, homeTeam, awayTeam);

  if (parsed.kind === "unknown") {
    return {
      resolved: false,
      reason: "selection_not_found",
      details: `Selection "${selection}" pour market ${market} non parsable`,
    };
  }

  // 3. Resoudre selon le type de market
  if (parsed.kind === "h2h") {
    return resolveH2H(fixture, parsed.side);
  }

  if (parsed.kind === "totals") {
    return resolveTotals(fixture, parsed.point, parsed.side);
  }

  if (parsed.kind === "double_chance") {
    return resolveDoubleChance(fixture, parsed.combo);
  }

  if (parsed.kind === "btts") {
    return resolveBtts(fixture, parsed.yes);
  }

  return {
    resolved: false,
    reason: "market_not_supported",
    details: `Market ${market} non supporte`,
  };
};


/**
 * Helper : construit le marketCode normalise pour la DB.
 * Identique au value-bet-engine pour coherence.
 */
export const normalizeMarketCode = (market: string): string => {
  return market.toUpperCase();
};