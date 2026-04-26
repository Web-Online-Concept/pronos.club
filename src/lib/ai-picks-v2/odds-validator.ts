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
 * Pour chaque pick :
 * 1. On retrouve l'event OddsAPI correspondant
 * 2. On retrouve le market correspondant (h2h ou totals)
 * 3. On retrouve l'outcome correspondant (selection)
 * 4. On calcule la BEST ODDS parmi les 6 books
 * 5. On compare avec la cote IA :
 *    - ecart > 10% : REJET (status = 'rejected_by_validation')
 *    - ecart <= 10% : VALIDATION + on overwrite avec la best odds
 * 6. On enrichit avec un snapshot des 6 books (pour la page detail)
 *
 * Les buteurs (scorer) ne passent PAS par ce validateur (Q3=a) car
 * le market "anytime goalscorer" n'est pas dans les markets standards
 * fetches (h2h, totals).
 * ═══════════════════════════════════════════════════════════════════
 */

import type { ConsensusCandidate } from "@/types/ai-picks-v2";
import type {
  OddsApiBookmaker,
  OddsApiOutcome,
  SimplifiedFixture,
} from "./odds-api-client";
import { BOOKMAKER_SLUG_TO_DISPLAY } from "./odds-api-client";


// Tolerance d'ecart entre la cote LLM et la best odds reelle
const MAX_ODDS_DIVERGENCE_PCT = 10;


/**
 * Snapshot d'une cote pour un bookmaker donne, sur le market+selection
 * d'un pick. Stocke dans odds_comparison.bookmakers_snapshot pour
 * alimenter le tableau comparateur de la page detail dossier.
 */
export type BookmakerOddsSnapshot = {
  key: string;        // slug OddsAPI : "pinnacle", "onexbet", etc.
  name: string;       // nom affichage : "PS3838", "1xbet", etc.
  odds: number | null; // null si ce book n'a pas cote pour cette selection
};


export type BookmakersSnapshot = {
  market: string;          // "h2h" / "totals_2.5" / etc.
  selection: string;       // valeur normalisee
  fetched_at: string;      // ISO date
  books: BookmakerOddsSnapshot[];
  best: { key: string; name: string; odds: number } | null;
};


export type ValidationOk = {
  ok: true;
  bestOdds: number;
  bestBookmakerSlug: string;     // ex: "pinnacle"
  bestBookmakerName: string;     // ex: "PS3838"
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
  snapshot?: BookmakersSnapshot; // disponible si on a quand meme trouve l'event
  llmOdds?: number;
};


export type ValidationResult = ValidationOk | ValidationFail;


// ─── Helpers ──────────────────────────────────────────────────────


/**
 * Match insensible a la casse + match en includes() bidirectionnel
 * pour tolerer les variations de nom d'equipe :
 * - "Real Madrid" matche "Real Madrid CF"
 * - "PSG" matche "Paris Saint-Germain" via includes() ? Non, trop tolerant.
 *   On fait juste une egalite case-insensitive et un includes() prudent.
 */
const teamNameMatches = (selection: string, teamName: string): boolean => {
  const sel = selection.trim().toLowerCase();
  const team = teamName.trim().toLowerCase();
  if (sel === team) return true;
  if (team.includes(sel) && sel.length >= 4) return true;
  if (sel.includes(team) && team.length >= 4) return true;
  return false;
};


/**
 * Determine quel market OddsAPI on doit chercher selon le market LLM.
 * Retourne null si le market LLM n'est pas supporte par notre validation
 * (le pick sera rejete avec reason "unsupported_market").
 *
 * Markets OddsAPI standard : "h2h", "totals", "spreads"
 * Markets LLM (cf prompts.ts):
 *   - 1N2 -> h2h
 *   - DOUBLE_CHANCE -> non supporte (a faire plus tard)
 *   - OVER_UNDER_X_5 -> totals avec point=X.5
 *   - BTTS -> non supporte (a faire plus tard)
 */
type ResolvedMarket =
  | { kind: "h2h" }
  | { kind: "totals"; point: number };

const resolveMarketFromLLM = (llmMarket: string): ResolvedMarket | null => {
  const m = llmMarket.toUpperCase();
  if (m === "1N2") return { kind: "h2h" };
  if (m === "OVER_UNDER_1_5") return { kind: "totals", point: 1.5 };
  if (m === "OVER_UNDER_2_5") return { kind: "totals", point: 2.5 };
  if (m === "OVER_UNDER_3_5") return { kind: "totals", point: 3.5 };
  // Non supportes pour l'instant (rejet) :
  // - DOUBLE_CHANCE (1X, X2, 12)
  // - BTTS (les deux equipes marquent)
  return null;
};


/**
 * Trouve l'outcome (cote) correspondant au market+selection LLM dans
 * les markets d'un bookmaker donne. Retourne null si pas trouve.
 */
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

    // Cas "nul" / "draw"
    if (sel === "match nul" || sel === "nul" || sel === "draw" || sel === "n") {
      return h2h.outcomes.find((o) => o.name === "Draw") ?? null;
    }

    // Cas equipe/joueur home
    if (teamNameMatches(llmSelection, homeTeam)) {
      return h2h.outcomes.find((o) => o.name === homeTeam) ?? null;
    }

    // Cas equipe/joueur away
    if (teamNameMatches(llmSelection, awayTeam)) {
      return h2h.outcomes.find((o) => o.name === awayTeam) ?? null;
    }

    return null;
  }

  if (resolvedMarket.kind === "totals") {
    const totals = bookmaker.markets.find((m) => m.key === "totals");
    if (!totals) return null;

    const sel = llmSelection.trim().toLowerCase();
    const isOver = sel.includes("plus de") || sel.includes("over") || sel.startsWith("+");
    const isUnder = sel.includes("moins de") || sel.includes("under") || sel.startsWith("-");

    if (!isOver && !isUnder) return null;

    const targetName = isOver ? "Over" : "Under";
    return (
      totals.outcomes.find(
        (o) => o.name === targetName && o.point === resolvedMarket.point
      ) ?? null
    );
  }

  return null;
};


// ─── Fonction principale ──────────────────────────────────────────


/**
 * Valide la cote d'un pick IA contre les vraies cotes des 6 bookmakers.
 * Retourne soit une validation OK (avec best odds + snapshot), soit
 * un echec avec une raison precise.
 *
 * BUTEURS : on ne valide PAS les picks scorer (Q3=a). Cette fonction
 * ne doit etre appelee QUE pour candidate.type === "classic".
 */
export const validateClassicPickOdds = (
  candidate: ConsensusCandidate,
  oddsApiFixtures: SimplifiedFixture[]
): ValidationResult => {
  // Garde-fou : on ne traite que les classics
  if (candidate.type !== "classic") {
    return {
      ok: false,
      reason: "unsupported_market",
      details: "validateClassicPickOdds called with non-classic candidate",
    };
  }

  // Garde-fou : il faut une cote LLM
  if (candidate.odds === null || candidate.odds === undefined) {
    return {
      ok: false,
      reason: "missing_llm_odds",
      details: "Candidate has no odds value",
    };
  }

  // 1) Retrouver le fixture dans OddsAPI
  const fixture = oddsApiFixtures.find(
    (f) => f.externalId === candidate.fixtureRef
  );
  if (!fixture) {
    return {
      ok: false,
      reason: "no_fixture_in_oddsapi",
      details: `No OddsAPI fixture matched fixtureRef="${candidate.fixtureRef}". Source may be apifootball-only.`,
      llmOdds: candidate.odds,
    };
  }

  // 2) Resoudre le market
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

  // 3) Pour chaque bookmaker, retrouver l'outcome (cote pour cette selection)
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

  // 4) Construire le snapshot
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
    books,
    best: null,
  };

  if (booksWithOdds.length === 0) {
    return {
      ok: false,
      reason: "no_match_found",
      details: `No bookmaker has odds for selection "${candidate.selection}" on market "${candidate.market}". Selection may not match team/outcome name.`,
      snapshot,
      llmOdds: candidate.odds,
    };
  }

  // 5) Calculer la best odds (la plus haute = meilleur ROI pour les abonnes)
  const sorted = [...booksWithOdds].sort((a, b) => b.odds - a.odds);
  const best = sorted[0];
  snapshot.best = {
    key: best.key,
    name: best.name,
    odds: best.odds,
  };

  // 6) Comparer la cote LLM a la best odds
  const llmOdds = candidate.odds;
  const divergencePct = Math.abs((llmOdds - best.odds) / best.odds) * 100;

  if (divergencePct > MAX_ODDS_DIVERGENCE_PCT) {
    return {
      ok: false,
      reason: "odds_diverge_too_much",
      details: `LLM proposed ${llmOdds.toFixed(3)} but best real odds is ${best.odds.toFixed(3)} on ${best.name} (divergence ${divergencePct.toFixed(1)}% > ${MAX_ODDS_DIVERGENCE_PCT}%).`,
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