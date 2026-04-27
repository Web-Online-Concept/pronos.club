/**
 * ═══════════════════════════════════════════════════════════════════
 * TYPES — ai_stats views
 * ═══════════════════════════════════════════════════════════════════
 *
 * Types partagés entre la page Stats et les composants.
 * Module Buteurs supprime — on ne conserve que ClassicStatsRow.
 * ═══════════════════════════════════════════════════════════════════
 */

export interface ClassicStatsRow {
  sport: string | null;
  league: string | null;
  wins: number;
  losses: number;
  voided: number;
  total_resolved: number;
  pending: number;
  win_rate_pct: number | null;
  avg_odds: number | null;
  avg_odds_won: number | null;
  avg_odds_lost: number | null;
  simulation_stake: number;
  simulation_return: number;
  simulation_profit: number;
  simulation_roi_pct: number | null;
  avg_confidence_won: number | null;
  avg_confidence_lost: number | null;
  avg_confidence_all: number | null;
}