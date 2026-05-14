// src/lib/over-05-buts-equipes/types.ts
//
// Types TypeScript partagés pour l'outil "Over 0.5 buts Equipes" (Bertrand).
// Méthode PROJETS — Phase 2.

// ─── DB Types (mirror des tables Supabase) ────────────────────────

export type O05League = {
  id: number;
  api_football_id: number;
  name: string;
  country: string;
  country_code: string;
  xg_source: "understat" | "sofascore";
  understat_slug: string | null;
  sofascore_id: number | null;
  is_top5: boolean;
  display_order: number;
};

export type O05Team = {
  id: number;
  league_id: number;
  name: string;
  name_normalized: string;
  api_football_id: number | null;
  understat_id: number | null;
  sofascore_id: number | null;
  logo_url: string | null;
};

export type O05Project = {
  id: number;
  team_id: number;
  rank_24_25: number | null;
  rank_23_24: number | null;
  rank_22_23: number | null;
  rank_21_22: number | null;
  rank_20_21: number | null;
  avg_rank_historical: number | null;
  category: "ELITE" | "EUROPE" | "AMBITIEUX" | "MILIEU" | "MAINTIEN" | null;
  current_rank: number | null;
  project_gap: number | null;
  project_bonus: number | null;
};

export type O05AnalysisStatus = "pending" | "running" | "completed" | "failed";

export type O05Analysis = {
  id: string;
  league_id: number;
  matchday_label: string | null;
  date_from: string;
  date_to: string;
  total_matches: number;
  matches_analyzed: number;
  matches_failed: number;
  status: O05AnalysisStatus;
  error_message: string | null;
  requested_by: string;
  created_at: string;
  completed_at: string | null;
};

export type O05Verdict = "TRÈS BON" | "BON" | "MOYEN" | "FAIBLE";
export type O05DataQuality = "complete" | "partial" | "missing";

export type O05MatchAnalysis = {
  id: string;
  analysis_id: string;
  api_football_fixture_id: number | null;
  match_date: string;
  home_team_id: number;
  away_team_id: number;
  target_team_id: number;
  target_role: "home" | "away";
  attack_xg_weighted: number | null;
  attack_tc_weighted: number | null;
  attack_go_weighted: number | null;
  attack_goals_weighted: number | null;
  attack_efficiency: number | null;
  attack_score: number | null;
  attack_bonus_projet: number | null;
  defense_xgc_weighted: number | null;
  defense_tc_subis_weighted: number | null;
  defense_go_conceded_weighted: number | null;
  defense_goals_conceded_weighted: number | null;
  defense_clean_sheets: number | null;
  defense_score: number | null;
  defense_bonus_projet: number | null;
  matchup_bonus: number | null;
  home_bonus: number | null;
  closed_match_malus: number | null;
  total_score: number | null;
  note_10: number | null;
  verdict: O05Verdict | null;
  data_source: string | null;
  data_quality: O05DataQuality | null;
  raw_data: unknown | null;
  error_message: string | null;
  created_at: string;
};

// ─── API Payloads ─────────────────────────────────────────────────

export type AnalyzeRequestBody = {
  league_id: number;
  matchday_label?: string;
  date_from: string;  // YYYY-MM-DD
  date_to: string;    // YYYY-MM-DD
};

export type AnalyzeResponse = {
  analysis_id: string;
  status: O05AnalysisStatus;
};

export type MatchdayOption = {
  matchday_label: string;       // "Journée 32"
  round_value: string;          // raw "Regular Season - 32" pour reuse API-Football
  date_from: string;            // YYYY-MM-DD
  date_to: string;              // YYYY-MM-DD
  match_count: number;          // nombre de matchs
  first_match_iso: string;      // ISO date du 1er match
};

export type MatchdaysResponse = {
  league_id: number;
  league_name: string;
  current_season: number;
  matchdays: MatchdayOption[];
};

// ─── Internal compute types ───────────────────────────────────────

export type MatchStats = {
  // Stats d'une équipe sur les 3 derniers matchs
  xg_weighted: number;       // pondéré par récence × niveau adversaire
  tc_weighted: number;       // tirs cadrés
  go_weighted: number;       // grosses occasions
  goals_weighted: number;    // buts marqués
  matches_count: number;     // 1, 2 ou 3 (selon ce qu'on a pu récupérer)
};

export type MatchDefenseStats = {
  xgc_weighted: number;
  tc_subis_weighted: number;
  go_conceded_weighted: number;
  goals_conceded_weighted: number;
  clean_sheets: number;
  matches_count: number;
};