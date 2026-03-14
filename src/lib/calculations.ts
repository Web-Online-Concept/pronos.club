import type { PickStatus } from "@/lib/supabase/types";

export function calculateProfit(
  status: PickStatus,
  odds: number,
  stake: number
): number {
  switch (status) {
    case "won":
      return parseFloat(((odds - 1) * stake).toFixed(2));
    case "lost":
      return -stake;
    case "void":
      return 0;
    case "half_won":
      return parseFloat((((odds - 1) * stake) / 2).toFixed(2));
    case "half_lost":
      return parseFloat((-stake / 2).toFixed(2));
    case "pending":
      return 0;
    default:
      return 0;
  }
}

export function calculateROI(totalProfit: number, totalStake: number): number {
  if (totalStake === 0) return 0;
  return parseFloat(((totalProfit / totalStake) * 100).toFixed(2));
}

export function calculateWinRate(wins: number, totalResolved: number): number {
  if (totalResolved === 0) return 0;
  return parseFloat(((wins / totalResolved) * 100).toFixed(1));
}

export function calculateDrawdown(snapshots: { bankroll: number }[]): number {
  let peak = 0;
  let maxDrawdown = 0;

  for (const snap of snapshots) {
    if (snap.bankroll > peak) peak = snap.bankroll;
    const drawdown = peak - snap.bankroll;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  return parseFloat(maxDrawdown.toFixed(2));
}
