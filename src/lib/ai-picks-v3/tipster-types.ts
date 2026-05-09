/**
 * PRONOS.CLUB — Types pour le pipeline Tipster IA v3.5
 *
 * Pipeline : 1 appel Claude tipster + GPT-4o validator + persist BDD.
 *
 * Architecture :
 *   1. multi-sport-fetcher → EnrichedFixture[]
 *   2. claude-tipster      → TipsterOutput (3-12 picks selon drop window)
 *   3. gpt-validator       → ValidatorVerdict[]
 *   4. persist-tipster-pick → BDD ai_picks
 *
 * Mise à jour 09/05/2026 (V3.5) :
 *   - Stats foot enrichies : sidelined, recent stats 5 derniers, splits dom/ext, top scorers, xG si dispo
 *   - Tennis enrichi : past matches with odds, tournament record, career stats, finals/titles
 *   - 3 nouveaux sports : Rugby, Handball, F1
 *   - Système de tier : Lock / Strong / Value / Coup de cœur
 *   - Drop window : morning / evening (cron 8h45 + 17h30 Paris)
 *   - CDM 2026 (league=1 API-Football) activée
 *   - Endpoint NBA dédié (v2.nba.api-sports.io)
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
  | "mma"
  | "rugby"
  | "handball"
  | "formula_1";

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
  | "TOTAL_GOALS"
  // Rugby
  | "TOTAL_TRIES"
  | "HANDICAP_RUGBY"
  // Handball
  | "TOTAL_HANDBALL_GOALS"
  | "HANDICAP_HANDBALL"
  // F1
  | "F1_WINNER"
  | "F1_PODIUM"
  | "F1_POINTS"
  | "F1_POLE"
  | "F1_DRIVER_MATCHUP";

// ============================================================================
// COTES PAR BOOK
// ============================================================================

export type CotesBooks = Record<string, Record<string, number>>;

export type SupportedBookmaker = "PS3838" | "Winamax" | "Betclic" | "Unibet";

export const ARJEL_BOOKS: SupportedBookmaker[] = ["Winamax", "Betclic", "Unibet"];
export const HORS_ARJEL_BOOKS: SupportedBookmaker[] = ["PS3838"];

// ============================================================================
// SYSTÈME DE TIER (V3.5)
// ============================================================================

/**
 * Tier de confiance/value du pick — affiché à l'abonné.
 *
 * - lock         : confiance ≥ 80 ET edge_pct ≥ 5% (top picks du jour)
 * - strong       : confiance 75-79
 * - value        : confiance 70-74 avec edge ≥ 3%
 * - coup_de_coeur: confiance 65-69 (opportunités plus risquées)
 */
export type PickTier = "lock" | "strong" | "value" | "coup_de_coeur";

/**
 * Fenêtre de génération du pick (V3.5 double drop).
 *
 * - morning : généré à 8h45 Paris (matchs avec kickoff < 20h00 Paris)
 * - evening : généré à 17h30 Paris (matchs avec kickoff >= 20h00 Paris,
 *             bénéficie des compositions confirmées)
 */
export type DropWindow = "morning" | "evening";

// ============================================================================
// TYPES STATS AVANCÉES — FOOTBALL
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
  buts_marques_par_match: string | null;
  /** Moyenne de buts encaissés par match */
  buts_encaisses_par_match: string | null;
  /** Nombre de clean sheets */
  clean_sheets_total: number | null;
  /** Nombre de matchs sans marquer */
  matchs_sans_marquer: number | null;
  /** % des matchs où les deux équipes ont marqué (BTTS) */
  btts_pct: number | null;
  /** % des matchs avec Over 2.5 buts */
  over_25_pct: number | null;
  /** Série en cours (ex: "3 victoires consécutives") */
  serie_en_cours: string | null;
  /** Nombre total de matchs joués cette saison */
  matchs_joues: number | null;
};

/**
 * Splits domicile/extérieur d'une équipe foot.
 * Permet d'argumenter "fort à domicile, faible à l'extérieur".
 * Source : API-Football /teams/statistics (champs home/away séparés).
 *
 * V3.5 : NOUVEAU — extraction conditionnelle dans fetchFootballTeamStats
 */
export type FootballSplitStats = {
  /** Matchs joués sur cette location (home ou away) */
  matchs_joues: number | null;
  /** Victoires sur cette location */
  victoires: number | null;
  /** Nuls */
  nuls: number | null;
  /** Défaites */
  defaites: number | null;
  /** Buts marqués total */
  buts_marques: number | null;
  /** Buts encaissés total */
  buts_encaisses: number | null;
  /** Moyenne buts marqués/match */
  buts_marques_avg: string | null;
  /** Moyenne buts encaissés/match */
  buts_encaisses_avg: string | null;
};

/**
 * Stats d'un match récent d'une équipe (5-10 derniers).
 * Permet à l'IA de raisonner sur la forme actuelle vs moyenne saison.
 * Source : API-Football /fixtures/statistics
 *
 * V3.5 : NOUVEAU — fetch sur les 5 derniers matchs avec cache 48h fixture_id
 */
export type FootballRecentMatchStats = {
  /** ID du match */
  fixture_id: number;
  /** Date du match */
  date: string;
  /** Adversaire */
  adversaire: string;
  /** Résultat (V/N/D) */
  resultat: "V" | "N" | "D" | null;
  /** Score final (ex: "2-1") */
  score: string | null;
  /** Possession (%) */
  possession: number | null;
  /** Tirs totaux */
  tirs_total: number | null;
  /** Tirs cadrés */
  tirs_cadres: number | null;
  /** Big chances créées (si dispo top 5 leagues) */
  big_chances: number | null;
  /** Corners */
  corners: number | null;
  /** Cartons jaunes */
  cartons_jaunes: number | null;
  /** Cartons rouges */
  cartons_rouges: number | null;
  /** xG (expected goals) si dispo top 5 leagues */
  xg: number | null;
  /** xGA (expected goals against) si dispo */
  xga: number | null;
};

/**
 * Liste des absents/suspendus d'une équipe.
 * Source : API-Football /sidelined
 *
 * V3.5 : NOUVEAU — surclasse /injuries car inclut suspensions cartons,
 * indisponibilités diverses, blessures longue durée.
 */
export type FootballSidelinedItem = {
  /** Nom du joueur */
  player_name: string;
  /** Type d'absence (ex: "Suspended", "Injured", "Calf Injury") */
  type: string | null;
  /** Date de début */
  start_date: string | null;
  /** Date de fin estimée */
  end_date: string | null;
};

/**
 * Top scorer d'une league (cache 24h).
 * Source : API-Football /players/topscorers
 *
 * V3.5 : NOUVEAU — pour argumenter forme offensive
 */
export type FootballTopScorer = {
  /** Nom joueur */
  player_name: string;
  /** Équipe */
  team_name: string;
  /** Buts saison */
  buts_saison: number;
  /** Apparitions */
  apparitions: number;
};

// ============================================================================
// PRÉDICTIONS FOOTBALL (existant)
// ============================================================================

export type FootballPrediction = {
  winner: string | null;
  percent_home: string | null;
  percent_draw: string | null;
  percent_away: string | null;
  advice: string | null;
  under_over: string | null;
};

// ============================================================================
// TYPES STATS AVANCÉES — BASKET / HOCKEY / BASEBALL (existant + maintenu)
// ============================================================================

export type TeamStanding = {
  position: number | null;
  victoires: number | null;
  defaites: number | null;
  marques_par_match: number | null;
  encaisses_par_match: number | null;
  win_pct: number | null;
};

export type TeamH2H = {
  resume: string;
  derniers_matchs: string[];
};

export type PitcherStats = {
  nom: string | null;
  era: number | null;
  whip: number | null;
  k_per_9: number | null;
  victoires: number | null;
  defaites: number | null;
  innings_lances: number | null;
};

export type MMAFighterRecord = {
  victoires: number | null;
  defaites: number | null;
  nuls: number | null;
  ko_tko: number | null;
  submissions: number | null;
  decisions: number | null;
  ko_pct: number | null;
  submission_pct: number | null;
  decision_pct: number | null;
};

// ============================================================================
// TYPES STATS AVANCÉES — TENNIS (V3.5 enrichi)
// ============================================================================

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
 * Match passé d'un joueur avec cote pré-match.
 * Source : Matchstat /player/past-matches/{id}
 *
 * V3.5 : NOUVEAU — permet de calculer le edge réel par tranche de cote
 * du joueur (favori sous 1.50 vs outsider 2.50, etc.)
 *
 * Filtré : uniquement Masters 1000+ et Grand Chelem pour économiser le quota.
 */
export type TennisPastMatchWithOdds = {
  date: string;
  tournament: string;
  surface: string | null;
  opponent: string;
  result: "W" | "L" | null;
  score: string | null;
  /** Cote pré-match du joueur (favori = bas, outsider = haut) */
  odd_player: number | null;
  /** Cote pré-match de l'adversaire */
  odd_opponent: number | null;
};

/**
 * Record d'un joueur sur un tournoi spécifique.
 * Source : Matchstat /player/tournament-record/{playerId}/{tournamentId}
 *
 * V3.5 : NOUVEAU — argument fort "X invaincu sur ce tournoi depuis Y années"
 */
export type TennisTournamentRecord = {
  tournament_name: string;
  /** Victoires totales sur ce tournoi (toutes années) */
  total_wins: number;
  /** Défaites totales */
  total_losses: number;
  /** Meilleur tour atteint (ex: "Final", "SF", "QF") */
  best_round_reached: string | null;
  /** Dernière année participation */
  last_year_played: number | null;
  /** Détail par année récente (5 dernières) */
  yearly_breakdown: Array<{
    year: number;
    wins: number;
    losses: number;
    round: string | null;
  }>;
};

/**
 * Stats serve/return de carrière du joueur.
 * Source : Matchstat /player/match-stats/{id}
 *
 * V3.5 : NOUVEAU — comparaison de profils techniques entre 2 joueurs
 */
export type TennisCareerStats = {
  /** Aces par match */
  aces_per_match: number | null;
  /** Doubles fautes par match */
  double_faults_per_match: number | null;
  /** % 1ère balle in */
  first_serve_in_pct: number | null;
  /** % gains 1ère balle */
  first_serve_won_pct: number | null;
  /** % gains 2ème balle */
  second_serve_won_pct: number | null;
  /** % balles de break sauvées */
  break_points_saved_pct: number | null;
  /** % balles de break converties */
  break_points_converted_pct: number | null;
};

/**
 * Finales et titres du joueur.
 * Source : Matchstat /player/finals/{id} + /player/titles/{id}
 *
 * V3.5 : NOUVEAU — argument psychologique en demi/finale
 * Activé uniquement si match en SF ou Final.
 */
export type TennisFinalsTitles = {
  /** Nb finales jouées en carrière */
  total_finals: number;
  /** Nb finales gagnées */
  finals_won: number;
  /** Nb finales perdues */
  finals_lost: number;
  /** % réussite en finale */
  finals_win_pct: number | null;
  /** Nb titres ATP/WTA */
  total_titles: number;
  /** Nb titres Grand Chelem */
  grand_slam_titles: number;
};

// ============================================================================
// TYPES STATS AVANCÉES — RUGBY (V3.5 NOUVEAU)
// ============================================================================

export type RugbyTeamStats = {
  /** Position au classement */
  classement_position: number | null;
  /** Victoires saison */
  victoires: number | null;
  /** Défaites saison */
  defaites: number | null;
  /** Nuls (rare en rugby) */
  nuls: number | null;
  /** Points marqués total */
  points_marques: number | null;
  /** Points encaissés total */
  points_encaisses: number | null;
  /** Moyenne points marqués/match */
  points_marques_avg: number | null;
  /** Moyenne points encaissés/match */
  points_encaisses_avg: number | null;
  /** Moyenne essais marqués/match */
  essais_marques_avg: number | null;
  /** Forme 5 derniers (V/N/D) */
  forme_5_derniers: string | null;
  /** Performance domicile (V-N-D) */
  domicile_record: string | null;
  /** Performance extérieur */
  exterieur_record: string | null;
};

// ============================================================================
// TYPES STATS AVANCÉES — HANDBALL (V3.5 NOUVEAU)
// ============================================================================

export type HandballTeamStats = {
  /** Position au classement */
  classement_position: number | null;
  /** Victoires saison */
  victoires: number | null;
  /** Défaites saison */
  defaites: number | null;
  /** Nuls */
  nuls: number | null;
  /** Buts marqués total */
  buts_marques: number | null;
  /** Buts encaissés total */
  buts_encaisses: number | null;
  /** Moyenne buts marqués/match */
  buts_marques_avg: number | null;
  /** Moyenne buts encaissés/match */
  buts_encaisses_avg: number | null;
  /** Différence de buts moyenne */
  diff_buts_avg: number | null;
  /** Forme 5 derniers (V/N/D) */
  forme_5_derniers: string | null;
  /** Top scorer du jour si dispo */
  top_scorer: string | null;
};

// ============================================================================
// TYPES STATS AVANCÉES — FORMULE 1 (V3.5 NOUVEAU)
// ============================================================================

/**
 * Données d'un Grand Prix F1 (structure différente : course, pas match).
 * Source : API-Sports /formula-1
 */
export type F1RaceData = {
  /** Nom du GP (ex: "Monaco Grand Prix") */
  race_name: string;
  /** Circuit (ex: "Circuit de Monaco") */
  circuit: string;
  /** Date de la course */
  race_date: string;
  /** Date des qualifications */
  qualifying_date: string | null;
  /** Numéro du GP dans la saison */
  round: number;
  /** Nb de tours */
  laps_total: number | null;
  /** Météo prévue */
  weather: string | null;
  /** Vainqueur historique récent du circuit */
  recent_winners: Array<{ year: number; driver: string }>;
};

/**
 * Stats d'un pilote F1 sur la saison + circuit en cours.
 * Source : API-Sports /formula-1/drivers
 */
export type F1DriverStats = {
  /** Nom complet pilote */
  driver_name: string;
  /** Écurie */
  constructor: string;
  /** Position championnat saison */
  championship_position: number | null;
  /** Points saison */
  championship_points: number | null;
  /** Victoires saison */
  wins_season: number | null;
  /** Podiums saison */
  podiums_season: number | null;
  /** Pole positions saison */
  poles_season: number | null;
  /** Position des 3 derniers GP */
  last_3_races_positions: number[];
  /** Position aux qualifications du GP en cours */
  qualifying_position: number | null;
  /** Meilleur résultat sur ce circuit (carrière) */
  best_result_at_circuit: string | null;
};

// ============================================================================
// FIXTURE ENRICHIE
// ============================================================================

/** Forme par équipe : "VVDND" (V=victoire, D=défaite, N=nul) */
export type TeamForm = string;

/** Liste des blessures par équipe */
export type InjuriesList = string[];

/**
 * Données d'un match enrichi avec stats.
 * V3.5 (09/05/2026) : ajout stats foot enrichies + tennis enrichi + 3 nouveaux sports.
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

  // ── Football — stats ─────────────────────────────────────────────
  stats_equipe?: {
    home: FootballTeamStats;
    away: FootballTeamStats;
  } | null;
  predictions_api?: FootballPrediction | null;

  // ── Football V3.5 — NOUVEAUX champs enrichis ─────────────────────
  /**
   * Splits domicile/extérieur des 2 équipes.
   * Permet d'argumenter "X fort à domicile, Y faible à l'extérieur".
   */
  splits_dom_ext?: {
    home_team_at_home: FootballSplitStats;
    away_team_at_away: FootballSplitStats;
  } | null;

  /**
   * Stats détaillées des 5 derniers matchs de chaque équipe.
   * Permet d'argumenter sur la forme actuelle réelle (pas juste V/N/D).
   */
  recent_matches_stats?: {
    home: FootballRecentMatchStats[];
    away: FootballRecentMatchStats[];
  } | null;

  /**
   * Liste des absents/suspendus (sidelined complet).
   * Plus complet que injuries (inclut suspensions cartons).
   */
  sidelined?: {
    home: FootballSidelinedItem[];
    away: FootballSidelinedItem[];
  } | null;

  /**
   * Top scorers de la league (cache 24h).
   * Permet d'argumenter sur la forme offensive des joueurs clés.
   */
  top_scorers_league?: FootballTopScorer[] | null;

  // ── Tennis — spécifique (existant) ───────────────────────────────
  tournoi_info?: string;
  ranking?: Record<string, string>;
  surface_year_to_date?: Record<string, string>;
  h2h_stats_detaillees?: TennisH2HStats;
  h2h_derniers_matchs?: string | string[];

  // ── Tennis V3.5 — NOUVEAUX champs enrichis ───────────────────────
  /**
   * Past matches avec cotes historiques par joueur.
   * Filtré : uniquement Masters 1000+ et Grand Chelem.
   */
  tennis_past_matches?: {
    player1: TennisPastMatchWithOdds[];
    player2: TennisPastMatchWithOdds[];
  } | null;

  /**
   * Record du joueur sur ce tournoi spécifique.
   * Filtré : uniquement Masters 1000+ et Grand Chelem.
   */
  tennis_tournament_record?: {
    player1: TennisTournamentRecord | null;
    player2: TennisTournamentRecord | null;
  } | null;

  /**
   * Stats serve/return de carrière des 2 joueurs.
   */
  tennis_career_stats?: {
    player1: TennisCareerStats | null;
    player2: TennisCareerStats | null;
  } | null;

  /**
   * Finales et titres (uniquement si match en SF ou Final).
   */
  tennis_finals_titles?: {
    player1: TennisFinalsTitles | null;
    player2: TennisFinalsTitles | null;
  } | null;

  // ── Basketball / Hockey — classement + H2H (existant) ────────────
  classement?: {
    home: TeamStanding;
    away: TeamStanding;
  } | null;
  h2h_reel?: TeamH2H | null;

  // ── Baseball — lanceurs partants (existant) ──────────────────────
  pitchers?: {
    home: PitcherStats | null;
    away: PitcherStats | null;
  } | null;

  // ── MMA — records fighters (existant) ────────────────────────────
  records_fighters?: Record<string, MMAFighterRecord> | null;

  // ── Rugby V3.5 — NOUVEAU ─────────────────────────────────────────
  rugby_stats?: {
    home: RugbyTeamStats;
    away: RugbyTeamStats;
  } | null;

  // ── Handball V3.5 — NOUVEAU ──────────────────────────────────────
  handball_stats?: {
    home: HandballTeamStats;
    away: HandballTeamStats;
  } | null;

  // ── F1 V3.5 — NOUVEAU (structure différente) ─────────────────────
  /**
   * Pour la F1, l'objet "fixture" représente une COURSE (race),
   * pas un match. Les "équipes" home/away sont alors les pilotes
   * de matchup ou null si marché vainqueur GP.
   */
  f1_race?: F1RaceData | null;
  f1_drivers?: F1DriverStats[] | null;
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
  /** V3.5 : indique si c'est le drop matin ou soir */
  drop_window: DropWindow;
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
  /** V3.5 : tier de classification du pick */
  tier: PickTier;
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
  /** V3.5 : tier de classification du combiné */
  tier: PickTier;
};

export type TipsterPick = TipsterPickSimple | TipsterPickCombine;

export type TipsterOutput = {
  date: string;
  nb_pronos: number;
  pronostics: TipsterPick[];
  /** V3.5 : drop window de la génération */
  drop_window: DropWindow;
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
  /**
   * V3.5 : suggestion de tier corrigé si le tier proposé par Claude
   * est incohérent avec confiance/edge_pct calculés.
   */
  suggested_tier?: PickTier | null;
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
  /** V3.5 : tier final après validation GPT (peut différer de pick.tier) */
  final_tier: PickTier;
  /** V3.5 : drop window de génération */
  drop_window: DropWindow;
};

export type GenerationStats = {
  date: string;
  duration_ms: number;
  drop_window: DropWindow;
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

// ============================================================================
// CONSTANTES MARKETS PAR SPORT (V3.5)
// ============================================================================

/**
 * Markets autorisés par sport (utilisé par tipster-prompt + validator).
 */
export const MARKETS_BY_SPORT: Record<SupportedSport, SupportedMarket[]> = {
  football: [
    "1N2",
    "DOUBLE_CHANCE",
    "OVER_UNDER_1_5",
    "OVER_UNDER_2_5",
    "OVER_UNDER_3_5",
    "BTTS",
  ],
  tennis: ["1N2", "HANDICAP_GAMES", "TOTAL_GAMES"],
  basketball: ["1N2", "HANDICAP_POINTS", "TOTAL_POINTS"],
  hockey: ["1N2", "TOTAL_GOALS"],
  baseball: ["1N2", "TOTAL_RUNS"],
  american_football: ["1N2", "HANDICAP_POINTS", "TOTAL_POINTS"],
  mma: ["1N2"],
  rugby: ["1N2", "HANDICAP_RUGBY", "TOTAL_POINTS", "TOTAL_TRIES"],
  handball: ["1N2", "HANDICAP_HANDBALL", "TOTAL_HANDBALL_GOALS"],
  formula_1: [
    "F1_WINNER",
    "F1_PODIUM",
    "F1_POINTS",
    "F1_POLE",
    "F1_DRIVER_MATCHUP",
  ],
};

/**
 * Markets autorisés en combiné (V3.5 : élargi à BTTS et Over/Under).
 */
export const COMBINE_ALLOWED_MARKETS: SupportedMarket[] = [
  "1N2",
  "DOUBLE_CHANCE",
  "BTTS",
  "OVER_UNDER_2_5",
  "OVER_UNDER_1_5",
];