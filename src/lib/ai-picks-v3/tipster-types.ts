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
 *
 * Mise à jour 03/05/2026 : ajout stats avancées par sport
 *   - Football : stats équipe (buts moy, BTTS%, Over25%, clean sheets) + prédictions API-Football
 *   - Basketball : classement + H2H + moyennes points
 *   - Hockey : classement + H2H + moyennes buts
 *   - Baseball : classement + stats lanceurs partants (ERA, WHIP, K/9)
 *   - MMA : record V-D-N + méthodes de victoire (KO%, soumission%, décision%)
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

export type CotesBooks = Record<string, Record<string, number>>;

export type SupportedBookmaker = "PS3838" | "Winamax" | "Betclic" | "Unibet";

export const ARJEL_BOOKS: SupportedBookmaker[] = ["Winamax", "Betclic", "Unibet"];
export const HORS_ARJEL_BOOKS: SupportedBookmaker[] = ["PS3838"];

// ============================================================================
// TYPES STATS AVANCÉES PAR SPORT
// ============================================================================

/**
 * Stats d'une équipe de football (saison en cours).
 * Source : API-Football /teams/statistics
 */
export type FootballTeamStats = {
  /** Position au classement de la ligue */
  classement_position: number | null;
  /** Points au classement */
  classement_points: number | null;
  /** Moyenne de buts marqués par match (toutes compétitions) */
  buts_marques_par_match: string | null; // ex: "1.8"
  /** Moyenne de buts encaissés par match */
  buts_encaisses_par_match: string | null;
  /** Nombre de clean sheets (matchs sans but encaissé) */
  clean_sheets_total: number | null;
  /** Nombre de matchs sans marquer */
  matchs_sans_marquer: number | null;
  /** % des matchs où les deux équipes ont marqué (BTTS) */
  btts_pct: number | null;
  /** % des matchs avec Over 2.5 buts */
  over_25_pct: number | null;
  /** Série en cours (ex: "3 victoires consécutives", "2 défaites consécutives") */
  serie_en_cours: string | null;
  /** Nombre total de matchs joués cette saison */
  matchs_joues: number | null;
};

/**
 * Prédictions algorithmiques API-Football pour un match.
 * Source : API-Football /predictions
 */
export type FootballPrediction = {
  /** Équipe gagnante prédite */
  winner: string | null;
  /** Probabilité victoire domicile */
  percent_home: string | null; // ex: "65%"
  /** Probabilité match nul */
  percent_draw: string | null;
  /** Probabilité victoire extérieur */
  percent_away: string | null;
  /** Conseil textuel ("Lyon to win") */
  advice: string | null;
  /** Prédiction Over/Under ("Under 2.5") */
  under_over: string | null;
};

/**
 * Position et stats d'une équipe au classement.
 * Utilisé pour basket, hockey, baseball.
 */
export type TeamStanding = {
  /** Position au classement */
  position: number | null;
  /** Victoires */
  victoires: number | null;
  /** Défaites */
  defaites: number | null;
  /** Moyenne de points/buts/runs marqués par match */
  marques_par_match: number | null;
  /** Moyenne de points/buts/runs encaissés par match */
  encaisses_par_match: number | null;
  /** % de victoires */
  win_pct: number | null;
};

/**
 * H2H entre deux équipes (basket, hockey, baseball).
 * Format simplifié pour le prompt IA.
 */
export type TeamH2H = {
  /** Résumé textuel des 5 derniers H2H */
  resume: string; // ex: "3V équipe A, 2V équipe B sur les 5 derniers"
  /** Liste des 5 derniers matchs */
  derniers_matchs: string[]; // ex: ["2026-03-15: Lakers 112 - Celtics 108", ...]
};

/**
 * Stats d'un lanceur partant baseball.
 * Source : API-Sports /players/statistics
 * Le lanceur partant est LE facteur décisif en MLB.
 */
export type PitcherStats = {
  /** Nom du lanceur */
  nom: string | null;
  /** Earned Run Average — moyenne de points mérités par 9 innings (+ bas = meilleur) */
  era: number | null;
  /** Walks + Hits per Inning Pitched (+ bas = meilleur, < 1.20 = excellent) */
  whip: number | null;
  /** Strikeouts per 9 innings (+ haut = meilleur, > 9 = excellent) */
  k_per_9: number | null;
  /** Victoires cette saison */
  victoires: number | null;
  /** Défaites cette saison */
  defaites: number | null;
  /** Innings lancés cette saison */
  innings_lances: number | null;
};

/**
 * Record et méthodes de victoire d'un fighter MMA.
 * Source : API-Sports /fighters/statistics
 */
export type MMAFighterRecord = {
  /** Victoires totales */
  victoires: number | null;
  /** Défaites totales */
  defaites: number | null;
  /** Matchs nuls */
  nuls: number | null;
  /** Victoires par KO/TKO */
  ko_tko: number | null;
  /** Victoires par soumission */
  submissions: number | null;
  /** Victoires par décision */
  decisions: number | null;
  /** % des victoires par KO/TKO */
  ko_pct: number | null;
  /** % des victoires par soumission */
  submission_pct: number | null;
  /** % des victoires par décision */
  decision_pct: number | null;
};

// ============================================================================
// FIXTURE ENRICHIE (output du multi-sport-fetcher)
// ============================================================================

/** Forme par équipe : "VVDND" (V=victoire, D=défaite, N=nul) */
export type TeamForm = string;

/** Liste des blessures par équipe */
export type InjuriesList = string[];

export type TennisH2HPlayerStats = {
  matches_won: number;
  first_serve_pct: string;
  win_first_serve_pct: string;
  win_second_serve_pct: string;
  break_points_won_pct: string;
  tiebreaks_won: string;
};

export type TennisH2HStats =
  | "donnée non disponible"
  | ({
      matches_count: number;
    } & Record<string, TennisH2HPlayerStats | number>);

/**
 * Données d'un match enrichi avec stats.
 * Version v3.1 (03/05/2026) : ajout stats avancées par sport.
 */
export type EnrichedFixture = {
  // ── Identification ──────────────────────────────────────────────
  id: string;
  sport: SupportedSport;
  ligue: string;
  match: string;
  date_heure: string;
  commence_time_iso: string;

  // ── Équipes / joueurs ────────────────────────────────────────────
  home_team: string;
  away_team: string;

  // ── Cotes par bookmaker ──────────────────────────────────────────
  cotes_books: CotesBooks;

  // ── IDs externes ────────────────────────────────────────────────
  apifootball_fixture_id?: number | null;

  // ── Champs communs ───────────────────────────────────────────────
  forme_5_derniers: string | Record<string, string>;
  h2h_5_derniers: string;
  blessures: string | Record<string, InjuriesList>;

  // ── Football — stats avancées ─────────────────────────────────────
  /**
   * Stats de la saison en cours par équipe.
   * Permet à l'IA d'argumenter sur les paris BTTS, Over/Under, Double Chance.
   */
  stats_equipe?: {
    home: FootballTeamStats;
    away: FootballTeamStats;
  } | null;

  /**
   * Prédictions algorithmiques API-Football.
   * Apporte un signal externe indépendant de l'analyse IA.
   */
  predictions_api?: FootballPrediction | null;

  // ── Tennis — spécifique ───────────────────────────────────────────
  tournoi_info?: string;
  ranking?: Record<string, string>;
  surface_year_to_date?: Record<string, string>;
  h2h_stats_detaillees?: TennisH2HStats;
  h2h_derniers_matchs?: string | string[];

  // ── Basketball / Hockey — classement + H2H ────────────────────────
  /**
   * Position et stats au classement de chaque équipe.
   * Clé pour comparer les moyennes offensives/défensives.
   */
  classement?: {
    home: TeamStanding;
    away: TeamStanding;
  } | null;

  /**
   * H2H réels entre les deux équipes (basket, hockey).
   * Complète la forme individuelle.
   */
  h2h_reel?: TeamH2H | null;

  // ── Baseball — lanceurs partants ──────────────────────────────────
  /**
   * Stats des lanceurs partants prévus.
   * LE facteur décisif en MLB — ERA + WHIP permettent une analyse solide.
   */
  pitchers?: {
    home: PitcherStats | null;
    away: PitcherStats | null;
  } | null;

  // ── MMA — records fighters ────────────────────────────────────────
  /**
   * Record et méthodes de victoire par fighter.
   * Permet de comparer les styles et la dangerosité (KO vs décision).
   */
  records_fighters?: Record<string, MMAFighterRecord> | null;
};

// ============================================================================
// FETCH OUTPUT
// ============================================================================

export type FetchOutput = {
  date_du_jour: string;
  contexte_du_jour: string;
  books_disponibles: SupportedBookmaker[];
  note: string;
  matchs: EnrichedFixture[];
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
// OUTPUT TIPSTER
// ============================================================================

export type TipsterPickSimple = {
  id: number;
  sport: SupportedSport;
  type: "simple";
  match: string;
  ligue: string;
  selection: string;
  cote_arjel: number | null;
  cote_arjel_book: SupportedBookmaker | null;
  cote_hors_arjel: number | null;
  cote_hors_arjel_book: SupportedBookmaker | null;
  confiance: number;
  mise_unites: 1;
  arguments: string[];
};

export type TipsterPickCombine = {
  id: number;
  sport: "multi";
  type: "combine";
  selections: Array<{
    match: string;
    selection: string;
    cote: number;
    book: SupportedBookmaker;
    league?: string;
    sport?: SupportedSport;
    apifootball_fixture_id?: number | null;
  }>;
  cote_totale_arjel: number | null;
  cote_totale_hors_arjel: number | null;
  confiance: number;
  mise_unites: 1;
  arguments_globaux: string[];
};

export type TipsterPick = TipsterPickSimple | TipsterPickCombine;

export type TipsterOutput = {
  date: string;
  nb_pronos: number;
  pronostics: TipsterPick[];
};

export type TipsterCallMeta = {
  model: string;
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
  narrative_text?: string;
};

// ============================================================================
// VALIDATOR GPT-4o
// ============================================================================

export type ValidatorVerdict = {
  pick_id: number;
  decision: "approve" | "warning" | "veto";
  reason: string;
};

export type ValidatorResult = {
  verdicts: ValidatorVerdict[];
  meta: {
    model: string;
    tokens_input: number;
    tokens_output: number;
    cost_usd: number;
    duration_ms: number;
  };
  error?: string;
};

// ============================================================================
// PIPELINE OUTPUT
// ============================================================================

export type ValidatedPick = {
  pick: TipsterPick;
  verdict: ValidatorVerdict;
  effective_odds: number;
  effective_bookmaker: SupportedBookmaker;
  source_model: string;
  combine_fixtures?: Map<string, EnrichedFixture>;
};

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