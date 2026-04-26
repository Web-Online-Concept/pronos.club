/**
 * ═══════════════════════════════════════════════════════════════════
 * odds-validator.ts
 * ═══════════════════════════════════════════════════════════════════
 *
 * STRATEGIE C — "Best Odds + 10%"
 *
 * Quand le LLM (Claude/GPT) propose un pick avec une cote, on ne lui
 * fait PAS confiance. On va chercher la VRAIE cote dans les donnees
 * OddsAPI fraichement fetchees, parmi les 6 bookmakers Tipster.
 *
 * MATCHING DUAL :
 * - Etape 1 : match exact par externalId (cas pick deja OddsAPI)
 * - Etape 2 : fuzzy match par nom equipes + date (cas pick API-Football)
 *
 * MARKETS SUPPORTES :
 * - 1N2 (h2h)
 * - OVER_UNDER_X_5 (totals OU alternate_totals selon la ligne)
 *
 * Pour chaque pick :
 * 1. On retrouve l'event OddsAPI correspondant (exact OU fuzzy)
 * 2. On retrouve le market correspondant (h2h, totals, alternate_totals)
 * 3. On retrouve l'outcome correspondant (selection)
 * 4. On calcule la BEST ODDS parmi les 6 books
 * 5. On compare avec la cote IA :
 *    - ecart > 10% : REJET (status = 'rejected_by_validation')
 *    - ecart <= 10% : VALIDATION + on overwrite avec la best odds
 * 6. On enrichit avec un snapshot des 6 books (pour la page detail)
 *
 * Les buteurs (scorer) ne passent PAS par ce validateur (Q3=a) car
 * le market "anytime goalscorer" n'est pas dans les markets standards
 * fetches.
 * ═══════════════════════════════════════════════════════════════════
 */

import type { ConsensusCandidate } from "@/types/ai-picks-v2";
import type {
  OddsApiBookmaker,
  OddsApiOutcome,
  SimplifiedFixture,
} from "./odds-api-client";
import { BOOKMAKER_SLUG_TO_DISPLAY } from "./odds-api-client";


const MAX_ODDS_DIVERGENCE_PCT = 10;
const FUZZY_MATCH_DATE_HOURS = 6;


export type BookmakerOddsSnapshot = {
  key: string;
  name: string;
  odds: number | null;
};


export type BookmakersSnapshot = {
  market: string;
  selection: string;
  fetched_at: string;
  match_method: "exact" | "fuzzy";
  fuzzy_match_score?: number;
  books: BookmakerOddsSnapshot[];
  best: { key: string; name: string; odds: number } | null;
};


export type ValidationOk = {
  ok: true;
  bestOdds: number;
  bestBookmakerSlug: string;
  bestBookmakerName: string;
  llmOdds: number;
  divergencePct: number;
  snapshot: BookmakersSnapshot;
};


export type ValidationFail = {
  ok: false;
  reason:
    | "no_fixture_in_oddsapi"
    | "unsupported_market"
    | "no_match_found"
    | "no_books_have_odds"
    | "odds_diverge_too_much"
    | "missing_llm_odds";
  details: string;
  snapshot?: BookmakersSnapshot;
  llmOdds?: number;
};


export type ValidationResult = ValidationOk | ValidationFail;


// ─── Helpers de matching ──────────────────────────────────────────


const normalizeTeamName = (name: string): string => {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.,'']/g, "")
    .replace(/\b(fc|cf|ac|sc|ss|us|ud|sd|cd|rc|sk|fk|hk|ka|club|de|del|la|le|el|al)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
};


const teamNameMatches = (selection: string, teamName: string): boolean => {
  const sel = normalizeTeamName(selection);
  const team = normalizeTeamName(teamName);
  if (sel === team) return true;
  if (sel.length >= 4 && team.includes(sel)) return true;
  if (team.length >= 4 && sel.includes(team)) return true;
  return false;
};


const fuzzyTeamScore = (a: string, b: string): number => {
  const na = normalizeTeamName(a);
  const nb = normalizeTeamName(b);
  if (na === nb) return 100;
  if (na.length === 0 || nb.length === 0) return 0;

  const wordsA = new Set(na.split(" ").filter((w) => w.length >= 3));
  const wordsB = new Set(nb.split(" ").filter((w) => w.length >= 3));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  const intersection = new Set([...wordsA].filter((w) => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);
  const jaccard = intersection.size / union.size;

  return Math.round(jaccard * 100);
};


const extractTeamsFromEventName = (
  eventName: string
): { home: string | null; away: string | null } => {
  const sep = eventName.includes(" vs ")
    ? " vs "
    : eventName.includes(" - ")
    ? " - "
    : null;
  if (!sep) return { home: null, away: null };
  const parts = eventName.split(sep);
  return {
    home: parts[0]?.trim() ?? null,
    away: parts[1]?.trim() ?? null,
  };
};


type FixtureMatch =
  | { fixture: SimplifiedFixture; method: "exact"; score: 100 }
  | { fixture: SimplifiedFixture; method: "fuzzy"; score: number };

const findOddsApiFixture = (
  candidate: ConsensusCandidate,
  oddsApiFixtures: SimplifiedFixture[]
): FixtureMatch | null => {
  const exactMatch = oddsApiFixtures.find(
    (f) => f.externalId === candidate.fixtureRef
  );
  if (exactMatch) {
    return { fixture: exactMatch, method: "exact", score: 100 };
  }

  const { home, away } = extractTeamsFromEventName(candidate.eventName);
  if (!home || !away) return null;

  const candidateDate = new Date(candidate.eventDateIso);
  if (Number.isNaN(candidateDate.getTime())) return null;

  let bestMatch: FixtureMatch | null = null;
  let bestScore = 0;

  for (const f of oddsApiFixtures) {
    const fDate = new Date(f.commenceTime);
    const diffHours = Math.abs(fDate.getTime() - candidateDate.getTime()) / (1000 * 60 * 60);
    if (diffHours > FUZZY_MATCH_DATE_HOURS) continue;

    const homeScore = fuzzyTeamScore(home, f.homeTeam);
    const awayScore = fuzzyTeamScore(away, f.awayTeam);
    const combined = Math.round((homeScore + awayScore) / 2);

    if (combined > bestScore && combined >= 60) {
      bestScore = combined;
      bestMatch = { fixture: f, method: "fuzzy", score: combined };
    }

    const reverseHome = fuzzyTeamScore(home, f.awayTeam);
    const reverseAway = fuzzyTeamScore(away, f.homeTeam);
    const reverseCombined = Math.round((reverseHome + reverseAway) / 2);
    if (reverseCombined > bestScore && reverseCombined >= 60) {
      bestScore = reverseCombined;
      bestMatch = { fixture: f, method: "fuzzy", score: reverseCombined };
    }
  }

  return bestMatch;
};


// ─── Helpers market/outcome ───────────────────────────────────────


type ResolvedMarket =
  | { kind: "h2h" }
  | { kind: "totals"; point: number };

const resolveMarketFromLLM = (llmMarket: string): ResolvedMarket | null => {
  const m = llmMarket.toUpperCase();
  if (m === "1N2") return { kind: "h2h" };
  if (m === "OVER_UNDER_1_5") return { kind: "totals", point: 1.5 };
  if (m === "OVER_UNDER_2_5") return { kind: "totals", point: 2.5 };
  if (m === "OVER_UNDER_3_5") return { kind: "totals", point: 3.5 };
  return null;
};


const findOutcomeForBookmaker = (
  bookmaker: OddsApiBookmaker,
  resolvedMarket: ResolvedMarket,
  llmSelection: string,
  homeTeam: string,
  awayTeam: string
): OddsApiOutcome | null => {
  if (resolvedMarket.kind === "h2h") {
    const h2h = bookmaker.markets.find((m) => m.key === "h2h");
    if (!h2h) return null;

    const sel = llmSelection.trim().toLowerCase();

    if (sel === "match nul" || sel === "nul" || sel === "draw" || sel === "n") {
      return h2h.outcomes.find((o) => o.name === "Draw") ?? null;
    }

    if (teamNameMatches(llmSelection, homeTeam)) {
      return h2h.outcomes.find((o) => o.name === homeTeam) ?? null;
    }

    if (teamNameMatches(llmSelection, awayTeam)) {
      return h2h.outcomes.find((o) => o.name === awayTeam) ?? null;
    }

    return null;
  }

  if (resolvedMarket.kind === "totals") {
    // CRITIQUE : OddsAPI retourne 2 markets pour les Over/Under :
    // - "totals" : main line uniquement (ex: 3.5 pour ce match)
    // - "alternate_totals" : toutes les autres lignes (1.5, 2.5, 4.5, etc.)
    // On les concatene tous deux pour trouver le bon point.
    const totalsMain = bookmaker.markets.find((m) => m.key === "totals");
    const totalsAlt = bookmaker.markets.find((m) => m.key === "alternate_totals");

    const allOutcomes: OddsApiOutcome[] = [
      ...(totalsMain?.outcomes ?? []),
      ...(totalsAlt?.outcomes ?? []),
    ];
    if (allOutcomes.length === 0) return null;

    const sel = llmSelection.trim().toLowerCase();
    const isOver = sel.includes("plus de") || sel.includes("over") || sel.startsWith("+");
    const isUnder = sel.includes("moins de") || sel.includes("under") || sel.startsWith("-");

    if (!isOver && !isUnder) return null;

    const targetName = isOver ? "Over" : "Under";
    return (
      allOutcomes.find(
        (o) => o.name === targetName && o.point === resolvedMarket.point
      ) ?? null
    );
  }

  return null;
};


// ─── Fonction principale ──────────────────────────────────────────


export const validateClassicPickOdds = (
  candidate: ConsensusCandidate,
  oddsApiFixtures: SimplifiedFixture[]
): ValidationResult => {
  if (candidate.type !== "classic") {
    return {
      ok: false,
      reason: "unsupported_market",
      details: "validateClassicPickOdds called with non-classic candidate",
    };
  }

  if (candidate.odds === null || candidate.odds === undefined) {
    return {
      ok: false,
      reason: "missing_llm_odds",
      details: "Candidate has no odds value",
    };
  }

  const fixtureMatch = findOddsApiFixture(candidate, oddsApiFixtures);
  if (!fixtureMatch) {
    return {
      ok: false,
      reason: "no_fixture_in_oddsapi",
      details: `No OddsAPI fixture matched (exact OR fuzzy) for "${candidate.eventName}" at ${candidate.eventDateIso}.`,
      llmOdds: candidate.odds,
    };
  }

  const fixture = fixtureMatch.fixture;
  const matchMethod = fixtureMatch.method;
  const matchScore = fixtureMatch.score;

  if (!candidate.market) {
    return {
      ok: false,
      reason: "unsupported_market",
      details: "Candidate has no market specified",
      llmOdds: candidate.odds,
    };
  }
  const resolvedMarket = resolveMarketFromLLM(candidate.market);
  if (!resolvedMarket) {
    return {
      ok: false,
      reason: "unsupported_market",
      details: `Market "${candidate.market}" is not yet supported by validator (DOUBLE_CHANCE, BTTS not implemented).`,
      llmOdds: candidate.odds,
    };
  }

  const books: BookmakerOddsSnapshot[] = [];
  for (const [slug, displayName] of Object.entries(BOOKMAKER_SLUG_TO_DISPLAY)) {
    const bk = fixture.rawBookmakers.find((b) => b.key === slug);
    if (!bk) {
      books.push({ key: slug, name: displayName, odds: null });
      continue;
    }
    const outcome = findOutcomeForBookmaker(
      bk,
      resolvedMarket,
      candidate.selection,
      fixture.homeTeam,
      fixture.awayTeam
    );
    books.push({
      key: slug,
      name: displayName,
      odds: outcome?.price ?? null,
    });
  }

  const marketLabel =
    resolvedMarket.kind === "h2h"
      ? "h2h"
      : `totals_${resolvedMarket.point.toString().replace(".", "_")}`;

  const booksWithOdds = books.filter(
    (b): b is BookmakerOddsSnapshot & { odds: number } =>
      b.odds !== null && Number.isFinite(b.odds)
  );

  const snapshot: BookmakersSnapshot = {
    market: marketLabel,
    selection: candidate.selection,
    fetched_at: new Date().toISOString(),
    match_method: matchMethod,
    fuzzy_match_score: matchMethod === "fuzzy" ? matchScore : undefined,
    books,
    best: null,
  };

  if (booksWithOdds.length === 0) {
    return {
      ok: false,
      reason: "no_match_found",
      details: `No bookmaker has odds for selection "${candidate.selection}" on market "${candidate.market}" (matched fixture via ${matchMethod}, score ${matchScore}).`,
      snapshot,
      llmOdds: candidate.odds,
    };
  }

  const sorted = [...booksWithOdds].sort((a, b) => b.odds - a.odds);
  const best = sorted[0];
  snapshot.best = {
    key: best.key,
    name: best.name,
    odds: best.odds,
  };

  const llmOdds = candidate.odds;
  const divergencePct = Math.abs((llmOdds - best.odds) / best.odds) * 100;

  if (divergencePct > MAX_ODDS_DIVERGENCE_PCT) {
    return {
      ok: false,
      reason: "odds_diverge_too_much",
      details: `LLM proposed ${llmOdds.toFixed(3)} but best real odds is ${best.odds.toFixed(3)} on ${best.name} (divergence ${divergencePct.toFixed(1)}% > ${MAX_ODDS_DIVERGENCE_PCT}%). Match method: ${matchMethod} (score ${matchScore}).`,
      snapshot,
      llmOdds,
    };
  }

  return {
    ok: true,
    bestOdds: best.odds,
    bestBookmakerSlug: best.key,
    bestBookmakerName: best.name,
    llmOdds,
    divergencePct,
    snapshot,
  };
};