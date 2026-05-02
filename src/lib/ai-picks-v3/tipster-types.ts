/**
 * PRONOS.CLUB — Types pour le pipeline Tipster IA v3
 *
 * Pipeline simplifié : 1 seul appel Claude tipster (vs ancien consensus Claude+GPT).
 * GPT-4o reste comme validator avocat du diable (veto seulement si problème grave).
 *
 * Architecture :
 *   1. multi-sport-fetcher → EnrichedFixture[]
 *   2. claude-tipster      → TipsterOutput (1-10 picks)
 *   3. gpt-validator       → ValidatorVerdict[] (1 verdict par pick)
 *   4. persist-tipster-pick → BDD ai_picks
 */

// ============================================================================
// SPORTS & MARCHÉS
// ============================================================================

export type SupportedSport =
  | "football"
  | "tennis"
  | "basketball"
  | "hockey"
  | "baseball"
  | "american_football"
  | "mma";

export type SupportedMarket =
  // Tous sports
  | "1N2"
  | "DOUBLE_CHANCE"
  // Football
  | "OVER_UNDER_1_5"
  | "OVER_UNDER_2_5"
  | "OVER_UNDER_3_5"
  | "BTTS"
  // Tennis / Basket
  | "HANDICAP_GAMES"
  | "HANDICAP_POINTS"
  | "TOTAL_GAMES"
  | "TOTAL_POINTS"
  | "TOTAL_RUNS"
  | "TOTAL_GOALS";

// ============================================================================
// COTES PAR BOOK
// ============================================================================

/**
 * Mapping book → odds par marché.
 * Format des keys : "1" | "X" | "2" | "+2.5" | "-2.5" | "spread_home_-1.5" | etc.
 */
export type CotesBooks = Record<string, Record<string, number>>;

export type SupportedBookmaker = "PS3838" | "Winamax" | "Betclic" | "Unibet";

/**
 * PS3838 = Pinnacle rebrandé (hors ARJEL France).
 * Winamax / Betclic / Unibet = ARJEL France.
 */
export const ARJEL_BOOKS: SupportedBookmaker[] = ["Winamax", "Betclic", "Unibet"];
export const HORS_ARJEL_BOOKS: SupportedBookmaker[] = ["PS3838"];

// ============================================================================
// FIXTURE ENRICHIE (output du multi-sport-fetcher)
// ============================================================================

/** Forme par équipe : "VVDND" (V=victoire, D=défaite, N=nul) */
export type TeamForm = string;

/** Liste des blessures par équipe */
export type InjuriesList = string[];

/**
 * Stats H2H détaillées tennis (par joueur).
 * Tous les pourcentages sont des strings "47%" pour respect de l'API Matchstat.
 */
export type TennisH2HPlayerStats = {
  matches_won: number;
  first_serve_pct: string;
  win_first_serve_pct: string;
  win_second_serve_pct: string;
  break_points_won_pct: string;
  tiebreaks_won: string; // "8/12"
};

/**
 * Stats H2H détaillées tennis (combinées).
 * Les keys sont des noms de joueurs (string) — typage Record<string, ...> obligatoire.
 */
export type TennisH2HStats =
  | "donnée non disponible"
  | ({
      matches_count: number;
    } & Record<string, TennisH2HPlayerStats | number>);

/**
 * Données d'un match enrichi avec stats.
 * Schéma proche du JSON v7 produit par le script Node.js.
 */
export type EnrichedFixture = {
  // Identification
  id: string; // ex: "soccer_epl_abc123"
  sport: SupportedSport;
  ligue: string; // libellé tel que retourné par odds-api (ex: "EPL", "Bundesliga - Germany")
  match: string; // "Team A vs Team B" ou "Player1 vs Player2"
  date_heure: string; // "02/05/2026 16:00" (format Paris)
  commence_time_iso: string; // ISO 8601

  // Équipes / joueurs
  home_team: string;
  away_team: string;

  // Cotes par bookmaker
  cotes_books: CotesBooks;

  // === IDs externes pour résolution ===
  /**
   * ID de la fixture côté api-football (foot uniquement).
   * Stocké pendant l'enrichissement, utilisé par le resolver pour
   * appeler /fixtures?id={fixture_id} sans avoir à refaire le lookup.
   * null si :
   *   - pas un match foot
   *   - fixture pas trouvée côté api-football
   */
  apifootball_fixture_id?: number | null;

  // === Champs communs forme / H2H ===

  /**
   * Forme :
   *  - Si enrichi : { "Team A": "VVDND", "Team B": "DDDDV" }
   *  - Si pas enrichi : "donnée non disponible (...)" (string)
   *  - Tennis MMA : objet avec strings différentes
   */
  forme_5_derniers:
    | string
    | Record<string, string>;

  /** "3V dom - 1V ext - 1N sur les 5 derniers H2H" ou "donnée non disponible" */
  h2h_5_derniers: string;

  /** Blessures par équipe ou string si non disponible */
  blessures: string | Record<string, InjuriesList>;

  // === Champs spécifiques tennis ===

  tournoi_info?: string;
  ranking?: Record<string, string>;
  surface_year_to_date?: Record<string, string>;
  h2h_stats_detaillees?: TennisH2HStats;
  h2h_derniers_matchs?: string | string[];
};

/** Output complet du multi-sport-fetcher */
export type FetchOutput = {
  date_du_jour: string; // YYYY-MM-DD
  contexte_du_jour: string;
  books_disponibles: SupportedBookmaker[];
  note: string;
  matchs: EnrichedFixture[];
  /** Stats du fetch (utile pour logs/debug) */
  stats: FetchStats;
};

export type FetchStats = {
  total_matchs: number;
  matchs_par_sport: Record<string, { ok: number; ko: number }>;
  api_football_quota_remaining: number | null;
  api_football_quota_limit: number | null;
  unresolved_leagues: string[];
};

// ============================================================================
// OUTPUT TIPSTER (Claude Sonnet 4.6 avec prompt v2.2)
// ============================================================================

/**
 * Pick simple sorti par Claude tipster.
 * Toutes les mises sont à 1u (flat bet), garantie côté prompt v2.2.
 */
export type TipsterPickSimple = {
  id: number;
  sport: SupportedSport;
  type: "simple";
  match: string;
  ligue: string;
  selection: string; // "Victoire Arsenal" | "+2.5 buts" | "-3.5 jeux" | etc.
  cote_arjel: number | null;
  cote_arjel_book: SupportedBookmaker | null;
  cote_hors_arjel: number | null;
  cote_hors_arjel_book: SupportedBookmaker | null;
  confiance: number; // 65-100
  mise_unites: 1; // TOUJOURS 1 (flat bet)
  arguments: string[];
};

/**
 * Combiné 2 sélections (max 1 par jour).
 */
export type TipsterPickCombine = {
  id: number;
  sport: "multi";
  type: "combine";
  selections: Array<{
    match: string;
    selection: string;
    cote: number;
    book: SupportedBookmaker;
    /**
     * Ligue/compétition de la sélection (ex: "EPL", "WTA Madrid Open").
     * Stockée pour le resolver de combinés. Optionnelle (fallback OK).
     */
    league?: string;
    /**
     * Sport de la sélection (ex: "football", "tennis").
     * Stocké pour le resolver de combinés.
     */
    sport?: SupportedSport;
    /**
     * fixture_id api-football si dispo (foot uniquement).
     * Permet une résolution directe sans nouvelle recherche.
     */
    apifootball_fixture_id?: number | null;
  }>;
  cote_totale_arjel: number | null;
  cote_totale_hors_arjel: number | null;
  confiance: number; // 70-100
  mise_unites: 1;
  arguments_globaux: string[];
};

export type TipsterPick = TipsterPickSimple | TipsterPickCombine;

/** Output JSON complet du tipster Claude */
export type TipsterOutput = {
  date: string; // YYYY-MM-DD
  nb_pronos: number;
  pronostics: TipsterPick[];
};

/** Méta-données de l'appel Claude */
export type TipsterCallMeta = {
  model: string; // "claude-sonnet-4-6"
  tokens_input: number;
  tokens_output: number;
  tokens_cached: number;
  cost_usd: number;
  duration_ms: number;
};

export type TipsterResult = {
  output: TipsterOutput | null;
  meta: TipsterCallMeta;
  error?: string;
  /** Texte brut narratif retourné par Claude (Bloc 1 — Analyse en français) */
  narrative_text?: string;
};

// ============================================================================
// VALIDATOR GPT-4o (avocat du diable indulgent)
// ============================================================================

/**
 * Verdict du validator GPT-4o pour un pick.
 *
 * - "approve"  : pick OK, on garde tel quel
 * - "warning"  : pick discutable mais on garde (juste un warning loggé)
 * - "veto"     : problème grave (cote inventée, blessure ignorée, etc.) → on retire
 */
export type ValidatorVerdict = {
  pick_id: number; // référence au TipsterPick.id
  decision: "approve" | "warning" | "veto";
  reason: string; // Explication courte (1-2 phrases)
};

export type ValidatorResult = {
  verdicts: ValidatorVerdict[];
  meta: {
    model: string; // "gpt-4o"
    tokens_input: number;
    tokens_output: number;
    cost_usd: number;
    duration_ms: number;
  };
  error?: string;
};

// ============================================================================
// PIPELINE OUTPUT (résultat de la génération complète)
// ============================================================================

/**
 * Pick après validation (combiné claude + verdict gpt).
 * C'est ce qui sera persisté en BDD.
 */
export type ValidatedPick = {
  pick: TipsterPick;
  verdict: ValidatorVerdict;
  /** Cote effective utilisée (best of arjel + hors_arjel) */
  effective_odds: number;
  /** Bookmaker effectif utilisé */
  effective_bookmaker: SupportedBookmaker;
  /** Source du pick (Claude only puisqu'il est seul) */
  source_model: string;
  /**
   * Pour les combinés : map indexée par "match string" vers la fixture enrichie.
   * Permet de retrouver league/sport/fixture_id de chaque sous-sélection
   * pour le persist (et plus tard le resolve combinés).
   * Vide pour les picks simples.
   */
  combine_fixtures?: Map<string, EnrichedFixture>;
};

/** Stats de la génération complète, retournées par la route POST */
export type GenerationStats = {
  date: string;
  duration_ms: number;
  fetch: FetchStats;
  tipster: {
    picks_generated: number;
    cost_usd: number;
    error: string | null;
  };
  validator: {
    approved: number;
    warnings: number;
    vetoed: number;
    cost_usd: number;
    error: string | null;
  };
  persisted: {
    success: number;
    errors: Array<{ pick_id: number; error: string }>;
  };
};