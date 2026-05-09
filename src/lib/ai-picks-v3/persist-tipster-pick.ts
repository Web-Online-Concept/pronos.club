/**
 * PRONOS.CLUB — Persistence Tipster Pick v3
 *
 * Adapte le format TipsterPick (flat 1U, simple/combiné) au schéma existant
 * de la table `ai_picks` pour préserver la compatibilité avec :
 *   - L'admin actuel (filtres, listes, actions)
 *   - Le composant <LiveScore /> (slugs sport)
 *   - Les séquences ai_picks_classic_seq / ai_picks_scorer_seq
 *   - Le cron ai-picks-resolve (résolution V/D/N)
 *
 * Stratégie d'adaptation :
 *   - generation_version = "v3" (filtre l'admin si besoin)
 *   - pick_type = "classic" toujours (les combinés sont stockés comme classic
 *     avec un marker dans odds_comparison.combine_meta)
 *   - consensus_score = pick.confiance (pas de vrai consensus en v3)
 *   - consensus_tier = "tipster_v3_approved" | "tipster_v3_warning"
 *   - model_used = "claude-sonnet-4-6+gpt-4o-validator"
 *   - confidence_gpt = null (GPT n'est plus tipster, juste validator)
 *
 * Anti-doublon cross-run : si un pick "pending" existe déjà pour ce match
 * aujourd'hui, on skip pour éviter de poster 2 picks contradictoires.
 */

import { supabaseAdmin } from "@/lib/supabase/admin";
import { buildMatchSlug } from "@/lib/ai-picks-v2/slug-generator";
import type {
  TipsterPick,
  TipsterPickSimple,
  TipsterPickCombine,
  ValidatedPick,
  ValidatorVerdict,
  SupportedSport,
  SupportedBookmaker,
  EnrichedFixture,
  PickTier,
  DropWindow,
} from "./tipster-types";
import { TIPSTER_PROMPT_VERSION } from "./tipster-prompt";

// ============================================================================
// CONSTANTES
// ============================================================================

const GENERATION_VERSION = "v3";
const MODEL_USED = "claude-sonnet-4-6+gpt-4o-validator";
const SLUG_MAX_RETRIES = 5;

// ============================================================================
// TYPES
// ============================================================================

export type PersistTipsterInput = {
  /** Pick déjà validé par GPT (verdict !== "veto") */
  validated: ValidatedPick;
  /** Identifiant unique du run (ISO date YYYY-MM-DD ou run-id généré) */
  generationBatch: string;
  /**
   * Map des fixtures enrichies indexée par "match" (Team A vs Team B).
   * Sert à retrouver l'apifootball_fixture_id pour les simples foot.
   */
  fixturesByMatch: Map<string, EnrichedFixture>;
};

export type PersistTipsterResult = {
  success: boolean;
  pickId?: string;
  slug?: string;
  error?: string;
  /** Si "skipped", indique pourquoi (dedup, etc.) */
  skipReason?: string;
};

// ============================================================================
// HELPERS
// ============================================================================

const extractTeamsFromMatch = (
  match: string
): { home: string; away: string } => {
  const sep = match.includes(" vs ") ? " vs " : " - ";
  const parts = match.split(sep);
  return {
    home: parts[0]?.trim() ?? match,
    away: parts[1]?.trim() ?? "",
  };
};

/**
 * Slug attendu par <LiveScore /> selon le sport.
 * Aligné avec /lib/live-scores.ts.
 */
const inferSportSlug = (sport: SupportedSport, leagueFallback?: string): string => {
  // Normalise pour être robuste aux variations de casse de Claude
  const s = (sport as string).toLowerCase().trim();

  if (s === "football" || s === "soccer") return "football";
  if (s === "basketball") return "basketball";
  if (s === "american_football" || s === "americanfootball") return "football-americain";
  if (s === "hockey") return "hockey";
  if (s === "baseball") return "baseball";
  if (s === "tennis") return "tennis";
  if (s === "mma") return "mma";
  // V3.5 : nouveaux sports
  if (s === "rugby") return "rugby";
  if (s === "handball") return "handball";
  if (s === "formula_1" || s === "formula1" || s === "f1") return "formula-1";

  // Fallback : déduire depuis le nom de la ligue si sport inconnu
  if (leagueFallback) {
    const l = leagueFallback.toLowerCase();
    if (l.includes("mlb") || l.includes("baseball")) return "baseball";
    if (l.includes("nba") || l.includes("wnba") || l.includes("basketball")) return "basketball";
    if (l.includes("nhl") || l.includes("hockey")) return "hockey";
    if (l.includes("nfl") || l.includes("american football")) return "football-americain";
    if (l.includes("atp") || l.includes("wta") || l.includes("tennis")) return "tennis";
    if (l.includes("mma") || l.includes("ufc")) return "mma";
    // V3.5 : fallback rugby / handball / F1 par mot-clé league
    if (l.includes("top 14") || l.includes("six nations") || l.includes("6 nations") || l.includes("urc") || l.includes("rugby") || l.includes("champions cup")) return "rugby";
    if (l.includes("starligue") || l.includes("ehf") || l.includes("handball")) return "handball";
    if (l.includes("formula") || l.includes("grand prix") || l.includes("f1 ")) return "formula-1";
  }

  console.warn(`[persist-tipster-pick] sport inconnu "${sport}" (ligue: ${leagueFallback ?? "?"}) → fallback football`);
  return "football";
};

/**
 * Slug pour un combiné multi-matchs.
 * Format : "combo-{date}-{N}" où N = numéro de combiné du jour.
 * On ne peut pas faire un slug par match (combiné = 2 matchs).
 */
const buildCombineSlug = (
  combine: TipsterPickCombine,
  isoDate: string
): string => {
  const dateOnly = isoDate.slice(0, 10);
  const seed = combine.id.toString();
  return `combo-${dateOnly}-pick-${seed}`;
};

const generateUniqueSlug = async (baseSlug: string): Promise<string> => {
  let candidate = baseSlug;
  for (let attempt = 0; attempt < SLUG_MAX_RETRIES; attempt++) {
    const { data } = await supabaseAdmin
      .from("ai_picks")
      .select("id")
      .eq("slug", candidate)
      .eq("generation_version", GENERATION_VERSION)
      .maybeSingle();
    if (!data) return candidate;
    candidate = `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;
  }
  return `${baseSlug}-${Date.now().toString(36)}`;
};

/**
 * @deprecated V3.5 Lot 10 — Plus utilisée. Conservée pour la traçabilité.
 *
 * AVANT (V3) : on appelait nextval() sur une SEQUENCE Postgres avant
 * l'INSERT. Si l'INSERT foirait (rollback), le numéro tiré était perdu
 * définitivement → trous dans classic_number (cf. incident #26 du
 * 09/05/2026).
 *
 * APRÈS (V3.5 Lot 10) : on utilise la stored procedure `insert_ai_pick_atomic`
 * qui calcule MAX(classic_number)+1 ET insère en une seule transaction
 * atomique sous LOCK EXCLUSIVE. Si l'INSERT échoue → rollback complet
 * → AUCUN numéro consommé. Garantie 0 trou par design.
 *
 * NE PAS UTILISER cette fonction sous peine de réintroduire le bug.
 */
const getNextClassicNumber = async (): Promise<number> => {
  console.warn(
    "[persist-tipster-pick] ⚠️ getNextClassicNumber appelée — DEPRECATED depuis V3.5 Lot 10. Utiliser insert_ai_pick_atomic à la place."
  );

  const { data, error } = await supabaseAdmin.rpc("nextval_ai_seq", {
    seq_name: "ai_picks_classic_seq",
  });

  if (!error && data !== null && data !== undefined) {
    return Number(data);
  }

  // Fallback : MAX(classic_number) + 1
  const { data: maxRow } = await supabaseAdmin
    .from("ai_picks")
    .select("classic_number")
    .not("classic_number", "is", null)
    .order("classic_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const max =
    (maxRow as { classic_number: number | null } | null)?.classic_number ?? 0;
  return max + 1;
};

// ============================================================================
// CHOIX DE LA COTE EFFECTIVE (best of arjel + hors_arjel)
// ============================================================================

/**
 * Pour la BDD on ne stocke qu'UNE cote (champ `odds`). Choix :
 *   - Si une seule des deux dispo → on prend celle-là
 *   - Si les deux dispo → on prend la PLUS HAUTE (meilleure pour le parieur)
 *
 * Le book associé est stocké dans `odds_bookmaker`.
 * Les deux cotes (ARJEL + hors ARJEL) sont stockées dans `odds_comparison.both_odds`
 * pour affichage côté UI.
 */
const pickEffectiveOddsForSimple = (
  pick: TipsterPickSimple
): { odds: number; bookmaker: SupportedBookmaker } => {
  const arjelOdds = pick.cote_arjel;
  const arjelBook = pick.cote_arjel_book;
  const hoodsOdds = pick.cote_hors_arjel;
  const hoodsBook = pick.cote_hors_arjel_book;

  if (arjelOdds !== null && hoodsOdds !== null && arjelBook && hoodsBook) {
    return arjelOdds >= hoodsOdds
      ? { odds: arjelOdds, bookmaker: arjelBook }
      : { odds: hoodsOdds, bookmaker: hoodsBook };
  }
  if (arjelOdds !== null && arjelBook) {
    return { odds: arjelOdds, bookmaker: arjelBook };
  }
  if (hoodsOdds !== null && hoodsBook) {
    return { odds: hoodsOdds, bookmaker: hoodsBook };
  }
  // Cas extrême : ni arjel ni hors arjel — ne devrait pas arriver après validation Claude
  return { odds: 0, bookmaker: "PS3838" };
};

const pickEffectiveOddsForCombine = (
  pick: TipsterPickCombine
): { odds: number; bookmaker: SupportedBookmaker } => {
  const arjel = pick.cote_totale_arjel;
  const hors = pick.cote_totale_hors_arjel;
  // Pour un combiné le book est plus complexe (selections de books différents)
  // On stocke "Multi" comme bookmaker effectif
  const odds = arjel !== null && hors !== null ? Math.max(arjel, hors) : (arjel ?? hors ?? 0);
  return { odds, bookmaker: "PS3838" };
};

// ============================================================================
// CONSTRUCTION DE LA SELECTION + REASONING
// ============================================================================

/**
 * Format de la sélection à insérer (champ ai_picks.selection).
 * Pour un simple : "Victoire Arsenal" (raw)
 * Pour un combiné : "Combiné 2 sélections : Bayern Munich + Plus 2.5 buts (Atalanta vs Genoa)"
 */
const buildSelectionString = (pick: TipsterPick): string => {
  if (pick.type === "simple") {
    return pick.selection;
  }
  // Combiné
  const parts = pick.selections.map((s) => `${s.selection} (${s.match})`);
  return `Combiné : ${parts.join(" + ")}`;
};

/**
 * Reasoning concaténé (champ ai_picks.reasoning).
 * On reprend les arguments du pick.
 */
const buildReasoningString = (pick: TipsterPick): string => {
  if (pick.type === "simple") {
    return pick.arguments.join(" • ");
  }
  return pick.arguments_globaux.join(" • ");
};

/**
 * Détermine le market à insérer (champ ai_picks.market).
 * Inférence depuis la sélection.
 */
const inferMarket = (pick: TipsterPick): string => {
  if (pick.type === "combine") return "COMBINE";

  const sel = pick.selection.toLowerCase();
  if (sel.includes("double chance") || /^(1x|x2|12)\b/.test(sel))
    return "DOUBLE_CHANCE";
  if (sel.includes("plus de") || sel.includes("over") || /\+\d/.test(sel)) {
    if (sel.includes("1.5")) return "OVER_UNDER_1_5";
    if (sel.includes("2.5")) return "OVER_UNDER_2_5";
    if (sel.includes("3.5")) return "OVER_UNDER_3_5";
    if (sel.includes("jeux")) return "TOTAL_GAMES";
    if (sel.includes("points")) return "TOTAL_POINTS";
    if (sel.includes("runs")) return "TOTAL_RUNS";
    return "TOTAL_GOALS";
  }
  if (sel.includes("moins de") || sel.includes("under") || /-\d/.test(sel)) {
    if (sel.includes("1.5")) return "OVER_UNDER_1_5";
    if (sel.includes("2.5")) return "OVER_UNDER_2_5";
    if (sel.includes("3.5")) return "OVER_UNDER_3_5";
    if (sel.includes("jeux")) return "TOTAL_GAMES";
    if (sel.includes("points")) return "TOTAL_POINTS";
    return "TOTAL_GOALS";
  }
  if (sel.includes("handicap")) {
    if (sel.includes("jeu")) return "HANDICAP_GAMES";
    return "HANDICAP_POINTS";
  }
  if (sel.includes("les deux") || sel.includes("btts")) return "BTTS";
  return "1N2";
};

// ============================================================================
// odds_comparison : structure JSONB stockée pour traçabilité v3
// ============================================================================

/**
 * Structure JSONB enregistrée dans ai_picks.odds_comparison.
 * Contient TOUTES les méta-data spécifiques au système v3 :
 *   - tipster_version (v2.2)
 *   - mise_unites (toujours 1)
 *   - both_odds (ARJEL + hors ARJEL pour affichage)
 *   - validator_verdict (decision + reason GPT)
 *   - combine_meta (uniquement pour les combinés)
 */
const buildOddsComparison = (
  validated: ValidatedPick,
  fixture: EnrichedFixture | null
): Record<string, unknown> => {
  const { pick, verdict } = validated;

  const base: Record<string, unknown> = {
    tipster_version: TIPSTER_PROMPT_VERSION,
    mise_unites: 1,
    confiance: pick.confiance,
    validator_verdict: {
      decision: verdict.decision,
      reason: verdict.reason,
    },
  };

  if (pick.type === "simple") {
    base.both_odds = {
      arjel: {
        odds: pick.cote_arjel,
        bookmaker: pick.cote_arjel_book,
      },
      hors_arjel: {
        odds: pick.cote_hors_arjel,
        bookmaker: pick.cote_hors_arjel_book,
      },
    };
    base.effective_choice = {
      odds: validated.effective_odds,
      bookmaker: validated.effective_bookmaker,
    };

    // ── bookmakers_snapshot : alimente BooksComparator sur la page dossier ──
    const arjelBook = pick.cote_arjel_book as string | null;
    const horsArjelBook = pick.cote_hors_arjel_book as string | null;

    const BOOKS_V3 = [
      { key: "ps3838",      name: "PS3838"  },
      { key: "winamax_fr",  name: "Winamax" },
      { key: "betclic_fr",  name: "Betclic" },
      { key: "unibet_fr",   name: "Unibet"  },
    ];

    const bookNameToKey: Record<string, string> = {
      "PS3838":   "ps3838",
      "Winamax":  "winamax_fr",
      "Betclic":  "betclic_fr",
      "Unibet":   "unibet_fr",
    };

    const arjelKey     = arjelBook     ? (bookNameToKey[arjelBook]     ?? null) : null;
    const horsArjelKey = horsArjelBook ? (bookNameToKey[horsArjelBook] ?? "ps3838") : null;

    const booksSnapshot = BOOKS_V3.map(({ key, name }) => {
      let odds: number | null = null;
      if (key === horsArjelKey && pick.cote_hors_arjel != null) {
        odds = pick.cote_hors_arjel;
      } else if (key === arjelKey && pick.cote_arjel != null) {
        odds = pick.cote_arjel;
      }
      return { key, name, odds };
    });

    base.bookmakers_snapshot = { books: booksSnapshot };
    // best = book avec la cote la plus haute (PS3838 ou ARJEL)
    const arjelOdds    = pick.cote_arjel ?? 0;
    const horsArjelOdds = pick.cote_hors_arjel ?? 0;
    const bestBookName = horsArjelOdds > arjelOdds
      ? (horsArjelBook ?? null)
      : (arjelOdds > 0 ? (arjelBook ?? null) : (horsArjelBook ?? null));
    const bestOddsVal  = Math.max(arjelOdds, horsArjelOdds) || null;
    base.best_soft_book_name = bestBookName;
    base.best_soft_odds      = bestOddsVal;

    // ── Stats fixture pour la page détail (V3.5 enrichi) ──────────────────────
    // On stocke les stats de la fixture enrichie dans odds_comparison pour
    // pouvoir les afficher sur la page dossier sans re-fetcher les APIs.
    if (fixture) {
      // ── V3 (existant) — stats équipe foot, prédictions, classement, H2H, pitchers, MMA records
      if (fixture.stats_equipe)     base.fixture_stats_equipe    = fixture.stats_equipe;
      if (fixture.predictions_api)  base.fixture_predictions     = fixture.predictions_api;
      if (fixture.classement)       base.fixture_classement      = fixture.classement;
      if (fixture.h2h_reel)         base.fixture_h2h_reel        = fixture.h2h_reel;
      if (fixture.pitchers)         base.fixture_pitchers        = fixture.pitchers;
      if (fixture.records_fighters) base.fixture_records_fighters = fixture.records_fighters;

      // ── V3.5 — Football enrichi
      if (fixture.splits_dom_ext)        base.fixture_splits_dom_ext        = fixture.splits_dom_ext;
      if (fixture.recent_matches_stats)  base.fixture_recent_matches_stats  = fixture.recent_matches_stats;
      if (fixture.sidelined)             base.fixture_sidelined             = fixture.sidelined;
      if (fixture.top_scorers_league)    base.fixture_top_scorers_league    = fixture.top_scorers_league;

      // ── V3.5 — Tennis enrichi
      if (fixture.tennis_past_matches)      base.fixture_tennis_past_matches      = fixture.tennis_past_matches;
      if (fixture.tennis_tournament_record) base.fixture_tennis_tournament_record = fixture.tennis_tournament_record;
      if (fixture.tennis_career_stats)      base.fixture_tennis_career_stats      = fixture.tennis_career_stats;
      if (fixture.tennis_finals_titles)     base.fixture_tennis_finals_titles     = fixture.tennis_finals_titles;

      // ── V3.5 — Rugby
      if (fixture.rugby_stats)              base.fixture_rugby_stats              = fixture.rugby_stats;

      // ── V3.5 — Handball
      if (fixture.handball_stats)           base.fixture_handball_stats           = fixture.handball_stats;

      // ── V3.5 — F1
      if (fixture.f1_race)                  base.fixture_f1_race                  = fixture.f1_race;
      if (fixture.f1_drivers)               base.fixture_f1_drivers               = fixture.f1_drivers;

      // ── V3.5 — Métadonnées générales utiles à la page dossier
      if (fixture.home_team) base.fixture_home_team = fixture.home_team;
      if (fixture.away_team) base.fixture_away_team = fixture.away_team;
    }
  } else {
    // Combiné — v3.1 : enrichissement de chaque sélection avec les infos
    // nécessaires à la résolution (league, sport, fixture_id si dispo).
    // On retrouve les infos depuis la map de fixtures enrichies indexée par "match".
    base.combine_meta = {
      selections: pick.selections.map((s) => {
        const fixture = validated.combine_fixtures?.get(s.match);
        return {
          match: s.match,
          selection: s.selection,
          cote: s.cote,
          book: s.book,
          // Infos pour le resolver de combinés (ligue + sport + fixture_id)
          league: fixture?.ligue ?? null,
          sport: fixture?.sport ?? null,
          apifootball_fixture_id: fixture?.apifootball_fixture_id ?? null,
        };
      }),
      cote_totale_arjel: pick.cote_totale_arjel,
      cote_totale_hors_arjel: pick.cote_totale_hors_arjel,
    };
  }

  return base;
};

// ============================================================================
// CONSENSUS TIER (mappage v3 → champ existant)
// ============================================================================

const buildConsensusTier = (verdict: ValidatorVerdict): string => {
  switch (verdict.decision) {
    case "approve":
      return "tipster_v3_approved";
    case "warning":
      return "tipster_v3_warning";
    case "veto":
      // Ne devrait pas arriver (les vetos sont filtrés avant persist)
      return "tipster_v3_vetoed";
    default:
      return "tipster_v3_unknown";
  }
};

// ============================================================================
// PERSIST FONCTION PRINCIPALE
// ============================================================================

/**
 * Persiste un pick validé en BDD `ai_picks`.
 *
 * Workflow :
 *   1. Anti-doublon cross-run (skip si pick pending pour ce match aujourd'hui)
 *   2. Génération slug unique
 *   3. Inférence sport, market, fixture_id
 *   4. Construction insertData avec mapping v3 → schéma existant
 *   5. Insertion + retour pickId pour génération dossier asynchrone
 */
export const persistTipsterPick = async (
  input: PersistTipsterInput
): Promise<PersistTipsterResult> => {
  const { validated, generationBatch, fixturesByMatch } = input;
  const { pick, verdict } = validated;

  try {
    // ─── Cas combiné : event_name = "Combiné 2 sélections du JJ/MM"
    let eventName: string;
    let eventDateIso: string;
    let sportSlug: string;
    let apifootballFixtureId: number | null = null;

    if (pick.type === "simple") {
      eventName = pick.match;
      sportSlug = inferSportSlug(pick.sport, pick.ligue);

      // Trouver la fixture correspondante pour le fixture_id et la date
      const fixture = fixturesByMatch.get(pick.match);
      if (fixture) {
        eventDateIso = fixture.commence_time_iso;
        // v3.1 (02/05/2026) : on récupère le fixture_id api-football
        // stocké lors de l'enrichissement (multi-sport-fetcher.ts).
        // Permet la résolution directe via api-football pour les picks foot.
        apifootballFixtureId = fixture.apifootball_fixture_id ?? null;
      } else {
        eventDateIso = new Date().toISOString();
      }
    } else {
      // Combiné
      const dateOnly = generationBatch.slice(0, 10);
      const formatted = new Date(dateOnly).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
      });
      eventName = `Combiné ${pick.selections.length} sélections du ${formatted}`;
      eventDateIso = new Date(`${dateOnly}T20:00:00.000Z`).toISOString();
      sportSlug = "multi"; // sport custom pour combinés
    }

    const dateOnly = eventDateIso.slice(0, 10);
    const dateStart = `${dateOnly}T00:00:00.000Z`;
    const dateEnd = `${dateOnly}T23:59:59.999Z`;

    // ─── Anti-doublon : skip si pick pending existe déjà pour ce match aujourd'hui
    const { data: existingPicks, error: existingErr } = await supabaseAdmin
      .from("ai_picks")
      .select("id, selection")
      .eq("event_name", eventName)
      .eq("status", "pending")
      .is("deleted_at", null)
      .gte("event_date", dateStart)
      .lte("event_date", dateEnd)
      .limit(1);

    if (existingErr) {
      console.warn(
        `[persistTipsterPick] dedup query failed for ${eventName}:`,
        existingErr.message
      );
    } else if (existingPicks && existingPicks.length > 0) {
      console.log(
        `[persistTipsterPick] skip dedup: pick pending existe deja pour ${eventName}`
      );
      return {
        success: false,
        skipReason: "dedup",
        error: `Pick pending existe deja pour ${eventName}`,
      };
    }

    // ─── Génération slug
    let baseSlug: string;
    if (pick.type === "simple") {
      const { home, away } = extractTeamsFromMatch(pick.match);
      baseSlug = buildMatchSlug({
        homeTeam: home,
        awayTeam: away,
        league: pick.ligue,
        eventDate: eventDateIso,
      });
    } else {
      baseSlug = buildCombineSlug(pick, eventDateIso);
    }
    const slug = await generateUniqueSlug(baseSlug);

    // ─── Construction insertData (sans classic_number, qui sera tiré à chaque tentative)
    const fixtureForOdds = pick.type === "simple"
      ? (fixturesByMatch.get((pick as TipsterPickSimple).match) ?? null)
      : null;
    const oddsComparison = buildOddsComparison(validated, fixtureForOdds);
    const consensusTier = buildConsensusTier(verdict);
    const reasoning = buildReasoningString(pick);
    const market = inferMarket(pick);
    const selection = buildSelectionString(pick);

    const ligue = pick.type === "simple" ? pick.ligue : "Multi";

    const insertDataBase: Record<string, unknown> = {
      pick_type: "classic",
      sport: sportSlug,
      league: ligue,
      event_name: eventName,
      event_date: eventDateIso,
      espn_event_id: null,
      apifootball_fixture_id: apifootballFixtureId,
      selection,
      market,
      odds: validated.effective_odds,
      odds_bookmaker: validated.effective_bookmaker,
      odds_comparison: oddsComparison,
      reasoning,
      reasoning_claude: reasoning,
      reasoning_gpt: verdict.reason,
      ai_confidence: pick.confiance,
      confidence_claude: pick.confiance,
      confidence_gpt: null, // GPT n'est plus tipster en v3
      confidence_apifootball: null,
      consensus_score: pick.confiance,
      consensus_tier: consensusTier,
      status: "pending",
      generation_version: GENERATION_VERSION,
      generation_batch: generationBatch,
      model_used: MODEL_USED,
      slug,
      dossier_status: "queued",
      dossier_generated_at: null,
      resolution_source: null,
      resolved_by: null,
      resolved_at: null,
      deleted_at: null,
      scorer_number: null,
    };

    // ─── V3.5 LOT 10 — INSERT ATOMIQUE via stored procedure ────────────────
    //
    // Utilisation de la fonction Postgres `insert_ai_pick_atomic` qui
    // garantit l'atomicité tirage_numero + INSERT sous LOCK EXCLUSIVE :
    //   - Pas de SEQUENCE Postgres (qui consommait les numéros même en
    //     cas de rollback → trous historiques)
    //   - MAX(classic_number) + 1 calculé DANS la transaction de l'INSERT
    //   - Si l'INSERT échoue → rollback complet → AUCUN numéro consommé
    //
    // ⚠️ Garantie 0 trou par design.
    //
    // En cas d'échec d'appel RPC (rare : timeout réseau, fonction absente,
    // permissions) → on log dans ai_picks_failed pour audit + retry x3.
    //
    const MAX_ATTEMPTS = 3;
    const RETRY_DELAY_MS = 200;

    const failedAttempts: Array<{
      attempt: number;
      error: string;
      error_code: string | null;
      pg_code: string | null;
      pg_details: string | null;
      pg_hint: string | null;
    }> = [];

    let finalPickId: string | null = null;
    let finalClassicNumber: number | null = null;

    // Construire le payload JSONB pour la fonction RPC
    // (la fonction extrait chaque champ via p_pick_data->>'champ')
    const rpcPayload: Record<string, unknown> = { ...insertDataBase };

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc(
        "insert_ai_pick_atomic",
        { p_pick_data: rpcPayload }
      );

      // Cas succès : la fonction retourne TABLE(inserted_id UUID, assigned_classic_number INTEGER)
      // Supabase remappe en array d'1 élément
      if (!rpcError && rpcData && Array.isArray(rpcData) && rpcData.length > 0) {
        const row = rpcData[0] as {
          inserted_id: string;
          assigned_classic_number: number;
        };
        finalPickId = row.inserted_id;
        finalClassicNumber = row.assigned_classic_number;

        if (attempt > 1) {
          console.log(
            `[persistTipsterPick] ✅ INSERT atomique réussi tentative ${attempt}/${MAX_ATTEMPTS} pour ${eventName} (numéro=${finalClassicNumber})`
          );
        }
        break;
      }

      // Échec : logger + retry
      const errMsg = rpcError?.message ?? "RPC returned no data";
      const errCode = rpcError?.code ?? null;
      const pgDetails =
        (rpcError as { details?: string } | null)?.details ?? null;
      const pgHint = (rpcError as { hint?: string } | null)?.hint ?? null;

      console.error(
        `[persistTipsterPick] ❌ Tentative ${attempt}/${MAX_ATTEMPTS} échec RPC insert_ai_pick_atomic pour ${eventName}: ${errMsg}`,
        { code: errCode, details: pgDetails, hint: pgHint }
      );

      failedAttempts.push({
        attempt,
        error: errMsg,
        error_code: errCode,
        pg_code: errCode,
        pg_details: pgDetails,
        pg_hint: pgHint,
      });

      if (attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }

    // ─── Logging dans ai_picks_failed pour TOUTES les tentatives échouées ───
    // ⚠️ Avec la stored procedure atomique, AUCUN numéro classic_number n'est
    // consommé en cas d'échec. Donc classic_number = null dans ai_picks_failed
    // (= échec d'appel RPC, pas de numéro perdu).
    if (failedAttempts.length > 0) {
      try {
        const isFinalFailure = finalPickId === null;
        const rowsToInsert = failedAttempts.map((fa) => ({
          classic_number: null, // Aucun numéro consommé grâce à l'atomicité
          event_name: eventName,
          event_date: eventDateIso,
          sport: sportSlug,
          league: ligue,
          selection,
          pick_data: {
            pick,
            verdict: { decision: verdict.decision, reason: verdict.reason },
            slug,
            attempt_index: fa.attempt,
            total_attempts: MAX_ATTEMPTS,
            insert_method: "rpc_atomic",
          },
          error_message: fa.error,
          error_code: fa.error_code,
          postgres_code: fa.pg_code,
          postgres_details: fa.pg_details,
          postgres_hint: fa.pg_hint,
          attempt_number: fa.attempt,
          is_final_failure: isFinalFailure && fa.attempt === failedAttempts.length,
          retried_successfully: !isFinalFailure,
          final_pick_id: finalPickId,
          final_classic_number: finalClassicNumber,
          resolved_at: !isFinalFailure ? new Date().toISOString() : null,
        }));

        await supabaseAdmin.from("ai_picks_failed").insert(rowsToInsert);
      } catch (logErr) {
        // Si le logging foire on continue quand même — c'est juste de l'audit
        console.error(
          `[persistTipsterPick] ⚠️ Échec du logging ai_picks_failed pour ${eventName}: ${logErr instanceof Error ? logErr.message : String(logErr)}`
        );
      }
    }

    // ─── Retour final ────────────────────────────────────────────────────
    if (finalPickId === null) {
      const lastError =
        failedAttempts[failedAttempts.length - 1]?.error ??
        "Unknown insert error";

      console.error(
        `[persistTipsterPick] 🚨 ÉCHEC FINAL après ${MAX_ATTEMPTS} tentatives pour ${eventName}. Aucun numéro consommé (atomique). Dernière erreur : ${lastError}`
      );

      return {
        success: false,
        error: `INSERT atomic failed after ${MAX_ATTEMPTS} attempts. Last error: ${lastError}. No classic_number consumed.`,
      };
    }

    return {
      success: true,
      pickId: finalPickId,
      slug,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown persist error",
    };
  }
};

// ============================================================================
// HELPER : Sleep utility pour le retry backoff
// ============================================================================

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// ============================================================================
// HELPERS POUR LE CRON ROUTE
// ============================================================================

/**
 * Construit la map fixturesByMatch à partir de la liste enrichie.
 * Utilisé par le cron pour passer cette map à persistTipsterPick.
 */
export const buildFixturesByMatchMap = (
  fixtures: EnrichedFixture[]
): Map<string, EnrichedFixture> => {
  const map = new Map<string, EnrichedFixture>();
  for (const f of fixtures) {
    map.set(f.match, f);
  }
  return map;
};

/**
 * Construit un ValidatedPick à partir d'un TipsterPick + ValidatorVerdict.
 * Calcule la cote effective (best of arjel + hors_arjel).
 *
 * V3.5 : ajout obligatoire de dropWindow (matin/soir) pour traçabilité.
 *
 * Le final_tier est :
 *   - Le tier suggéré par le validator GPT s'il a fait un downgrade (suggested_tier)
 *   - Sinon le tier original du pick (pick.tier)
 *
 * @param pick Le pick Claude tipster
 * @param verdict Le verdict GPT validator (peut suggérer un tier downgrade)
 * @param dropWindow Drop window de génération ("morning" | "evening")
 * @param fixturesByMatch Map des fixtures du jour (utilisée pour enrichir
 *                        les sous-sélections de combinés avec league/sport/id)
 */
export const buildValidatedPick = (
  pick: TipsterPick,
  verdict: ValidatorVerdict,
  dropWindow: DropWindow,
  fixturesByMatch?: Map<string, EnrichedFixture>
): ValidatedPick => {
  const { odds, bookmaker } =
    pick.type === "simple"
      ? pickEffectiveOddsForSimple(pick)
      : pickEffectiveOddsForCombine(pick);

  // Pour les combinés : on construit une sous-map des fixtures concernées
  // par les sélections du combiné, pour que persistTipsterPick puisse
  // les retrouver lors de la construction du combine_meta.
  let combineFixtures: Map<string, EnrichedFixture> | undefined;
  if (pick.type === "combine" && fixturesByMatch) {
    combineFixtures = new Map();
    for (const sel of pick.selections) {
      const fixture = fixturesByMatch.get(sel.match);
      if (fixture) combineFixtures.set(sel.match, fixture);
    }
  }

  // V3.5 : final_tier = suggested_tier du GPT si downgrade, sinon tier original
  const suggestedTier = (verdict as ValidatorVerdict & { suggested_tier?: PickTier }).suggested_tier;
  const finalTier: PickTier = suggestedTier ?? pick.tier;

  return {
    pick,
    verdict,
    effective_odds: odds,
    effective_bookmaker: bookmaker,
    source_model: "claude-sonnet-4-6",
    combine_fixtures: combineFixtures,
    final_tier: finalTier,
    drop_window: dropWindow,
  };
};