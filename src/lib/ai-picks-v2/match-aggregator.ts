import type {
  AggregatedMatchData,
  Fixture,
  Injury,
  Lineup,
  Odds,
  Prediction,
  TeamStatistics,
} from "@/types/apifootball";
import { apiFootball, ApiFootballClient } from "./apifootball-client";

const computeCompleteness = (
  odds: Odds[] | null,
  homeStats: TeamStatistics | null,
  awayStats: TeamStatistics | null,
  lineups: Lineup[] | null,
  injuries: Injury[] | null,
  h2h: Fixture[] | null,
  predictions: Prediction | null
): AggregatedMatchData["dataCompleteness"] => {
  const hasOdds = Array.isArray(odds) && odds.length > 0;
  const hasHomeStats = homeStats !== null;
  const hasAwayStats = awayStats !== null;
  const hasLineups = Array.isArray(lineups) && lineups.length > 0;
  const hasInjuries = Array.isArray(injuries);
  const hasH2H = Array.isArray(h2h) && h2h.length > 0;
  const hasPredictions = predictions !== null;

  const flags = [
    hasOdds,
    hasHomeStats,
    hasAwayStats,
    hasLineups,
    hasInjuries,
    hasH2H,
    hasPredictions,
  ];
  const score = Math.round((flags.filter(Boolean).length / flags.length) * 100);

  return {
    hasOdds,
    hasHomeStats,
    hasAwayStats,
    hasLineups,
    hasInjuries,
    hasH2H,
    hasPredictions,
    score,
  };
};

const safeSettled = async <T>(promise: Promise<T>): Promise<T | null> => {
  try {
    return await promise;
  } catch (err) {
    console.warn("[match-aggregator] safeSettled caught error:", err);
    return null;
  }
};

const settleToValue = <T>(result: PromiseSettledResult<T | null>): T | null => {
  if (result.status === "fulfilled") return result.value;
  console.warn("[match-aggregator] settled rejected:", result.reason);
  return null;
};

export type AggregateOptions = {
  pickId?: string | null;
  h2hLast?: number;
  skipLineups?: boolean;
  skipInjuries?: boolean;
  skipPredictions?: boolean;
  client?: ApiFootballClient;
};

export const aggregateMatchData = async (
  fixtureId: number,
  options: AggregateOptions = {}
): Promise<AggregatedMatchData> => {
  const client = options.client ?? apiFootball;
  const pickId = options.pickId ?? null;
  const h2hLast = options.h2hLast ?? 10;

  const fixture = await client.getFixtureById(fixtureId, pickId);

  if (!fixture) {
    throw new Error(`Fixture ${fixtureId} not found in API-Football`);
  }

  const homeTeamId = fixture.teams.home.id;
  const awayTeamId = fixture.teams.away.id;
  const leagueId = fixture.league.id;
  const season = fixture.league.season;

  const wave1 = await Promise.allSettled([
    safeSettled(client.getOdds(fixtureId, pickId)),
    options.skipLineups
      ? Promise.resolve(null)
      : safeSettled(client.getLineups(fixtureId, pickId)),
    options.skipInjuries
      ? Promise.resolve(null)
      : safeSettled(client.getInjuries(fixtureId, pickId)),
    safeSettled(client.getH2H(homeTeamId, awayTeamId, h2hLast, pickId)),
    options.skipPredictions
      ? Promise.resolve(null)
      : safeSettled(client.getPredictions(fixtureId, pickId)),
  ]);

  const [oddsResult, lineupsResult, injuriesResult, h2hResult, predictionsResult] =
    wave1;

  const wave2 = await Promise.allSettled([
    safeSettled(client.getTeamStatistics(homeTeamId, leagueId, season, pickId)),
    safeSettled(client.getTeamStatistics(awayTeamId, leagueId, season, pickId)),
  ]);

  const [homeStatsResult, awayStatsResult] = wave2;

  const odds = settleToValue<Odds[]>(oddsResult);
  const lineups = settleToValue<Lineup[]>(lineupsResult);
  const injuries = settleToValue<Injury[]>(injuriesResult);
  const h2h = settleToValue<Fixture[]>(h2hResult);
  const predictions = settleToValue<Prediction>(predictionsResult);
  const homeStats = settleToValue<TeamStatistics>(homeStatsResult);
  const awayStats = settleToValue<TeamStatistics>(awayStatsResult);

  const dataCompleteness = computeCompleteness(
    odds,
    homeStats,
    awayStats,
    lineups,
    injuries,
    h2h,
    predictions
  );

  return {
    fixtureId,
    fixture,
    odds,
    homeStats,
    awayStats,
    lineups,
    injuries,
    h2h,
    predictions,
    aggregatedAt: new Date().toISOString(),
    dataCompleteness,
  };
};

export type ConsensusFixtureFilter = {
  date: string;
  leagueIds: number[];
};

export const fetchFixturesForGeneration = async (
  filter: ConsensusFixtureFilter,
  client?: ApiFootballClient
): Promise<Fixture[]> => {
  const c = client ?? apiFootball;
  return c.getFixturesByDate(filter.date, filter.leagueIds);
};