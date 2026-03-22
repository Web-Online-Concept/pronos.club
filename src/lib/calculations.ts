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

/**
 * Calculate profit for a combined pick based on individual leg results.
 * Rules:
 * - Any leg lost = whole pick lost (-stake)
 * - All legs won = won at combined odds
 * - 1 won + 1 void = won at the won leg's odds only
 * - All void = void (0)
 * - half_won/half_lost treated as won/lost for simplicity in combines
 */
export function calculateCombinedResult(
  legs: { status: PickStatus; odds: number }[],
  stake: number
): { status: PickStatus; profit: number } {
  const statuses = legs.map((l) => l.status);

  // Any leg lost or half_lost = whole pick lost
  if (statuses.some((s) => s === "lost" || s === "half_lost")) {
    return { status: "lost", profit: -stake };
  }

  // All void = void
  if (statuses.every((s) => s === "void")) {
    return { status: "void", profit: 0 };
  }

  // All won (or half_won)
  if (statuses.every((s) => s === "won" || s === "half_won")) {
    const combinedOdds = legs.reduce((acc, l) => acc * l.odds, 1);
    const profit = parseFloat(((combinedOdds - 1) * stake).toFixed(2));
    return { status: "won", profit };
  }

  // Mix of won/half_won + void: use only the non-void legs' odds
  const activLegs = legs.filter((l) => l.status !== "void");
  if (activLegs.length === 0) {
    return { status: "void", profit: 0 };
  }
  const activeOdds = activLegs.reduce((acc, l) => acc * l.odds, 1);
  const profit = parseFloat(((activeOdds - 1) * stake).toFixed(2));
  return { status: "won", profit };

  // Any pending = still pending (shouldn't reach here normally)
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