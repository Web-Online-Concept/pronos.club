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
    return null;
  }
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

  const [
    oddsResult,
    homeStatsResult,
    awayStatsResult,
    lineupsResult,
    injuriesResult,
    h2hResult,
    predictionsResult,
  ] = await Promise.allSettled([
    safeSettled(client.getOdds(fixtureId, pickId)),
    safeSettled(client.getTeamStatistics(homeTeamId, leagueId, season, pickId)),
    safeSettled(client.getTeamStatistics(awayTeamId, leagueId, season, pickId)),
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

  const extract = <T>(result: PromiseSettledResult<T | null>): T | null => {
    if (result.status === "fulfilled") return result.value;
    return null;
  };

  const odds = extract(oddsResult);
  const homeStats = extract(homeStatsResult);
  const awayStats = extract(awayStatsResult);
  const lineups = extract(lineupsResult);
  const injuries = extract(injuriesResult);
  const h2h = extract(h2hResult);
  const predictions = extract(predictionsResult);

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