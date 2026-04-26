import { fetchAllSportsForToday } from "./odds-api-client";
import { fetchFixturesForGeneration } from "./match-aggregator";
import type { SimplifiedFixture } from "./odds-api-client";
import type { Fixture } from "@/types/apifootball";
import { MAJOR_LEAGUE_LIST } from "@/types/apifootball";

export type EnrichedFixturesData = {
  apiFootballFixtures: Fixture[];
  /** Fixtures OddsAPI dedupliquees vs API-Football (pour le prompt LLM) */
  oddsApiFixtures: SimplifiedFixture[];
  /**
   * TOUTES les fixtures OddsAPI du jour, non dedupliquees.
   * Sert au value-bet-engine qui doit voir tous les matchs (Tier 1 inclus).
   */
  oddsApiAllFixtures: SimplifiedFixture[];
  promptUserText: string;
};

const formatApiFootballFixture = (f: Fixture): string => {
  const date = f.fixture.date;
  const home = f.teams.home.name;
  const away = f.teams.away.name;
  const league = `${f.league.country} - ${f.league.name}`;
  const round = f.league.round ?? "n/a";
  return `- fixture_id_or_event_id="${f.fixture.id}", source=apifootball, sport=soccer, league="${league}", round="${round}", event_name="${home} vs ${away}", event_date_iso="${date}"`;
};

const formatOddsApiFixture = (f: SimplifiedFixture): string => {
  const odds = f.oddsSummary;
  let oddsLine = "no odds available";
  if (odds) {
    const parts: string[] = [];
    if (odds.h2hHome !== undefined && odds.h2hAway !== undefined) {
      const drawPart =
        odds.h2hDraw !== undefined ? ` / N: ${odds.h2hDraw}` : "";
      parts.push(`1: ${odds.h2hHome}${drawPart} / 2: ${odds.h2hAway}`);
    }
    if (odds.over25 !== undefined && odds.under25 !== undefined) {
      parts.push(`Over 2.5: ${odds.over25} / Under 2.5: ${odds.under25}`);
    }
    if (parts.length > 0) {
      oddsLine = `${odds.bookmaker} | ${parts.join(" | ")}`;
    }
  }
  return `- fixture_id_or_event_id="${f.externalId}", source=oddsapi, sport=${
    f.isFootball ? "soccer" : f.sportKey
  }, league="${f.league}", event_name="${f.homeTeam} vs ${f.awayTeam}", event_date_iso="${
    f.commenceTime
  }", odds: ${oddsLine}`;
};

const dedupOddsApiAgainstApiFootball = (
  apiFootballFixtures: Fixture[],
  oddsApiFixtures: SimplifiedFixture[]
): SimplifiedFixture[] => {
  const apifKeys = new Set<string>();
  for (const f of apiFootballFixtures) {
    const home = f.teams.home.name.toLowerCase();
    const away = f.teams.away.name.toLowerCase();
    const datePart = f.fixture.date.slice(0, 10);
    apifKeys.add(`${home}|${away}|${datePart}`);
    apifKeys.add(`${away}|${home}|${datePart}`);
  }
  return oddsApiFixtures.filter((f) => {
    const home = f.homeTeam.toLowerCase();
    const away = f.awayTeam.toLowerCase();
    const datePart = f.commenceTime.slice(0, 10);
    return !apifKeys.has(`${home}|${away}|${datePart}`);
  });
};

export const buildEnrichedFixturesData = async (
  date: string
): Promise<EnrichedFixturesData> => {
  const [apifResult, oddsApiResult] = await Promise.allSettled([
    fetchFixturesForGeneration({
      date,
      leagueIds: [...MAJOR_LEAGUE_LIST],
    }),
    fetchAllSportsForToday(),
  ]);

  const apiFootballFixtures =
    apifResult.status === "fulfilled" ? apifResult.value : [];
  const allOddsApiFixtures =
    oddsApiResult.status === "fulfilled" ? oddsApiResult.value : [];

  const targetDate = date.slice(0, 10);
  const oddsApiTodayOnly = allOddsApiFixtures.filter((f) =>
    f.commenceTime.startsWith(targetDate)
  );

  const oddsApiFiltered = dedupOddsApiAgainstApiFootball(
    apiFootballFixtures,
    oddsApiTodayOnly
  );

  const apifBlock =
    apiFootballFixtures.length > 0
      ? `## Footballs tier 1 (data API-Football enrichie disponible)
${apiFootballFixtures.map(formatApiFootballFixture).join("\n")}`
      : "## Footballs tier 1\n(aucune fixture sur les ligues majeures aujourd'hui)";

  const oddsBlock =
    oddsApiFiltered.length > 0
      ? `## Autres sports et compétitions (cotes The Odds API)
${oddsApiFiltered.map(formatOddsApiFixture).join("\n")}`
      : "## Autres sports\n(aucune fixture remontée par The Odds API aujourd'hui)";

  const promptUserText = `# DATE ANALYSÉE
${date}

# FIXTURES DU JOUR

${apifBlock}

${oddsBlock}

# CONSIGNES POUR L'ANALYSE

Pour les fixtures Tier 1 foot, tu disposes de toute la richesse API-Football (forme, H2H, predictions, etc.) — utilise au mieux ta connaissance des équipes européennes pour évaluer.

Pour les autres sports et compétitions, tu as les cotes du marché et tu peux t'appuyer sur ta connaissance générale des équipes/joueurs/championnats pour évaluer la qualité des picks.

# RAPPELS CRITIQUES

- Cote classique entre 1.50 et 3.00 (strict)
- Cote buteur entre 1.80 et 4.00 (strict)
- 1 seul pick par match maximum
- 5 picks classiques max + 3 buteurs max
- Buteurs football uniquement
- Si la conviction est < 45, ne propose PAS le pick (mieux vaut moins de picks que des picks médiocres)
- Si tu as une conviction réelle même sans toutes les données, propose le pick avec un confidence modéré (50-65)

# TÂCHE

Fournis ta sélection au format JSON strict comme indiqué dans le system prompt.`;

  return {
    apiFootballFixtures,
    oddsApiFixtures: oddsApiFiltered,
    oddsApiAllFixtures: oddsApiTodayOnly,
    promptUserText,
  };
};