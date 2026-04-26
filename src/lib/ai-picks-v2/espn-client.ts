/**
 * ═══════════════════════════════════════════════════════════════════
 * espn-client.ts
 * ═══════════════════════════════════════════════════════════════════
 *
 * Lib pour l'API publique non-officielle d'ESPN.
 * Aucune cle, aucune limite documentee, gratuit.
 *
 * Couverture : 17 sports / 139 ligues
 * - NHL, NBA, MLB, NFL, WNBA
 * - EPL, Liga, Serie A, Bundesliga, Ligue 1, Champions League
 * - Tennis ATP/WTA, MMA UFC, Golf PGA
 *
 * Endpoints utilises :
 * - /scoreboard : matchs du jour
 * - /summary?event=ID : box score complet d'un match
 * - /teams/:id : info equipe
 * - /teams/:id/schedule : 5 derniers + prochains matchs
 *
 * IMPORTANT : ESPN utilise des IDs internes, pas les memes que OddsAPI.
 * On doit donc faire un FUZZY MATCH par noms d'equipe + date pour
 * trouver le bon match ESPN a partir d'un pick OddsAPI.
 * ═══════════════════════════════════════════════════════════════════
 */


const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports";


// ─── Mapping sport OddsAPI -> sport ESPN ──────────────────────────


type EspnSport = {
  espnSport: string; // "hockey", "basketball", etc.
  espnLeague: string; // "nhl", "nba", "eng.1", etc.
};


/**
 * Convertit un sportKey OddsAPI en couple (sport, league) ESPN.
 * Retourne null si pas de mapping (sport non couvert ESPN).
 */
export const oddsApiSportToEspn = (sportKey: string): EspnSport | null => {
  // US sports
  if (sportKey === "icehockey_nhl") return { espnSport: "hockey", espnLeague: "nhl" };
  if (sportKey === "basketball_nba") return { espnSport: "basketball", espnLeague: "nba" };
  if (sportKey === "basketball_wnba") return { espnSport: "basketball", espnLeague: "wnba" };
  if (sportKey === "baseball_mlb") return { espnSport: "baseball", espnLeague: "mlb" };
  if (sportKey === "americanfootball_nfl") return { espnSport: "football", espnLeague: "nfl" };
  if (sportKey === "americanfootball_ncaaf") return { espnSport: "football", espnLeague: "college-football" };
  if (sportKey === "basketball_ncaab") return { espnSport: "basketball", espnLeague: "mens-college-basketball" };

  // Soccer (mapping vers slugs ESPN ".1" = D1)
  const soccerMap: Record<string, string> = {
    soccer_epl: "eng.1",
    soccer_efl_champ: "eng.2",
    soccer_spain_la_liga: "esp.1",
    soccer_spain_segunda_division: "esp.2",
    soccer_italy_serie_a: "ita.1",
    soccer_italy_serie_b: "ita.2",
    soccer_germany_bundesliga: "ger.1",
    soccer_germany_bundesliga2: "ger.2",
    soccer_france_ligue_one: "fra.1",
    soccer_france_ligue_two: "fra.2",
    soccer_netherlands_eredivisie: "ned.1",
    soccer_portugal_primeira_liga: "por.1",
    soccer_belgium_first_div: "bel.1",
    soccer_turkey_super_league: "tur.1",
    soccer_brazil_campeonato: "bra.1",
    soccer_usa_mls: "usa.1",
    soccer_mexico_ligamx: "mex.1",
    soccer_argentina_primera_division: "arg.1",
    soccer_japan_j_league: "jpn.1",
    soccer_korea_kleague1: "kor.1",
    soccer_uefa_champs_league: "uefa.champions",
    soccer_uefa_europa_league: "uefa.europa",
    soccer_uefa_europa_conference_league: "uefa.europa.conf",
  };
  if (soccerMap[sportKey]) {
    return { espnSport: "soccer", espnLeague: soccerMap[sportKey] };
  }

  // Tennis / MMA / autres
  if (sportKey === "tennis_atp" || sportKey.startsWith("tennis_atp"))
    return { espnSport: "tennis", espnLeague: "atp" };
  if (sportKey === "tennis_wta" || sportKey.startsWith("tennis_wta"))
    return { espnSport: "tennis", espnLeague: "wta" };
  if (sportKey === "mma_mixed_martial_arts")
    return { espnSport: "mma", espnLeague: "ufc" };

  return null;
};


// ─── Types ESPN simplifies ────────────────────────────────────────


export type EspnTeamInfo = {
  id: string;
  abbreviation: string;
  displayName: string;
  shortDisplayName: string;
  logo: string | null;
  color: string | null; // hex sans #
  alternateColor: string | null;
  record: string | null; // "27-19-3"
};


export type EspnEventSummary = {
  eventId: string;
  date: string; // ISO
  status: string; // "STATUS_SCHEDULED", "STATUS_FINAL", etc.
  homeTeam: EspnTeamInfo;
  awayTeam: EspnTeamInfo;
  homeScore: number | null;
  awayScore: number | null;
  /** Boxscore stats agreges par equipe (cles depend du sport) */
  boxscore: {
    home: Array<{ name: string; label: string; value: string }>;
    away: Array<{ name: string; label: string; value: string }>;
  };
  /** Linescores par periode/quart-temps */
  linescores: {
    home: number[];
    away: number[];
  };
  /** Articles d'analyse, ITK, predictions ESPN */
  predictor?: {
    homeWinPct: number;
    awayWinPct: number;
  } | null;
  /** Records de la saison */
  records?: {
    home: string;
    away: string;
  } | null;
  /** Lieu */
  venue: string | null;
  attendance: number | null;
};


export type EspnTeamForm = {
  teamId: string;
  teamName: string;
  /** 5 derniers matchs (du plus recent au plus ancien) */
  recentGames: Array<{
    eventId: string;
    date: string;
    opponent: string;
    isHome: boolean;
    score: { team: number; opponent: number } | null;
    result: "W" | "L" | "D" | "P" | null; // P = pending
  }>;
  /** Prochains matchs */
  upcomingGames: Array<{
    eventId: string;
    date: string;
    opponent: string;
    isHome: boolean;
  }>;
  record: string | null;
};


// ─── Helpers fuzzy match ──────────────────────────────────────────


/**
 * Normalise un nom d'equipe pour matching cross-API.
 * Rapproche les versions OddsAPI ("Boston Bruins") et ESPN ("Boston Bruins")
 * meme si une variante ajoute des suffixes ("FC", "United", etc.).
 */
const normalizeTeam = (name: string): string => {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(fc|cf|ac|sc|club|de|del|la|le|el|al)\b/g, "")
    .replace(/[.,'']/g, "")
    .replace(/\s+/g, " ")
    .trim();
};


const teamsMatch = (a: string, b: string): boolean => {
  const na = normalizeTeam(a);
  const nb = normalizeTeam(b);
  if (na === nb) return true;
  if (na.length >= 4 && nb.includes(na)) return true;
  if (nb.length >= 4 && na.includes(nb)) return true;
  // Match dernier mot (ex: "Boston Bruins" matche "Bruins")
  const lastA = na.split(" ").pop() ?? "";
  const lastB = nb.split(" ").pop() ?? "";
  if (lastA.length >= 4 && lastA === lastB) return true;
  return false;
};


// ─── Fetch helpers ────────────────────────────────────────────────


type FetchEspnOptions = {
  cache?: RequestCache;
  revalidateSeconds?: number;
};


const fetchEspn = async <T = unknown>(
  url: string,
  options: FetchEspnOptions = {}
): Promise<T | null> => {
  try {
    const res = await fetch(url, {
      cache: options.cache ?? "no-store",
      next: options.revalidateSeconds
        ? { revalidate: options.revalidateSeconds }
        : undefined,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.warn(`[espn-client] ${url} returned ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.warn(
      `[espn-client] fetch failed for ${url}:`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
};


// ─── API publique : trouver l'event ESPN qui correspond ───────────


type EspnScoreboardEvent = {
  id: string;
  date: string;
  status: { type: { name: string } };
  competitions: Array<{
    competitors: Array<{
      id: string;
      homeAway: "home" | "away";
      score: string;
      team: {
        id: string;
        abbreviation: string;
        displayName: string;
        shortDisplayName: string;
        logo?: string;
        color?: string;
        alternateColor?: string;
      };
      records?: Array<{ summary: string }>;
    }>;
    venue?: { fullName?: string };
    attendance?: number;
  }>;
};

type EspnScoreboard = {
  events?: EspnScoreboardEvent[];
};


/**
 * Cherche dans le scoreboard ESPN un event qui matche les noms d'equipe
 * et la date donnees. Retourne l'event ID ESPN ou null.
 *
 * Strategy :
 * 1. Fetch le scoreboard du jour (et du jour d'apres si match en soiree UTC tardif)
 * 2. Fuzzy match sur homeTeam + awayTeam
 */
export const findEspnEventId = async (
  espnSport: string,
  espnLeague: string,
  homeTeamName: string,
  awayTeamName: string,
  matchDateIso: string
): Promise<string | null> => {
  const matchDate = new Date(matchDateIso);
  if (Number.isNaN(matchDate.getTime())) return null;

  // ESPN attend YYYYMMDD
  const formatYmd = (d: Date) => {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}${m}${day}`;
  };

  // On essaie le jour J et J-1 (matchs nocturnes USA decale)
  const datesToTry = [
    formatYmd(matchDate),
    formatYmd(new Date(matchDate.getTime() - 24 * 60 * 60 * 1000)),
    formatYmd(new Date(matchDate.getTime() + 24 * 60 * 60 * 1000)),
  ];

  for (const ymd of datesToTry) {
    const url = `${ESPN_BASE}/${espnSport}/${espnLeague}/scoreboard?dates=${ymd}`;
    const data = await fetchEspn<EspnScoreboard>(url, { revalidateSeconds: 600 });
    if (!data || !data.events) continue;

    for (const evt of data.events) {
      const comp = evt.competitions[0];
      if (!comp) continue;
      const home = comp.competitors.find((c) => c.homeAway === "home");
      const away = comp.competitors.find((c) => c.homeAway === "away");
      if (!home || !away) continue;

      const homeMatches =
        teamsMatch(homeTeamName, home.team.displayName) ||
        teamsMatch(homeTeamName, home.team.shortDisplayName);
      const awayMatches =
        teamsMatch(awayTeamName, away.team.displayName) ||
        teamsMatch(awayTeamName, away.team.shortDisplayName);

      if (homeMatches && awayMatches) {
        return evt.id;
      }
      // Cas inverse (rare)
      const reverseHome =
        teamsMatch(homeTeamName, away.team.displayName) ||
        teamsMatch(homeTeamName, away.team.shortDisplayName);
      const reverseAway =
        teamsMatch(awayTeamName, home.team.displayName) ||
        teamsMatch(awayTeamName, home.team.shortDisplayName);
      if (reverseHome && reverseAway) return evt.id;
    }
  }

  return null;
};


// ─── API publique : recuperer le summary complet d'un event ──────


type EspnSummaryResponse = {
  boxscore?: {
    teams?: Array<{
      team: {
        id: string;
        abbreviation: string;
        displayName: string;
        shortDisplayName: string;
        logo?: string;
        color?: string;
        alternateColor?: string;
      };
      statistics: Array<{
        name: string;
        displayValue: string;
        label: string;
      }>;
    }>;
  };
  header?: {
    competitions?: Array<{
      competitors: Array<{
        id: string;
        homeAway: "home" | "away";
        score: string;
        linescores?: Array<{ value: number; displayValue: string }>;
        record?: Array<{ displayValue: string; type: string }>;
        team: {
          id: string;
          abbreviation: string;
          displayName: string;
          shortDisplayName: string;
          logos?: Array<{ href: string }>;
          color?: string;
          alternateColor?: string;
        };
      }>;
      status: { type: { name: string } };
      date: string;
      venue?: { fullName?: string };
      attendance?: number;
    }>;
  };
  predictor?: {
    homeTeam?: { gameProjection?: string };
    awayTeam?: { gameProjection?: string };
  };
};


export const getEspnEventSummary = async (
  espnSport: string,
  espnLeague: string,
  eventId: string
): Promise<EspnEventSummary | null> => {
  const url = `${ESPN_BASE}/${espnSport}/${espnLeague}/summary?event=${eventId}`;
  const data = await fetchEspn<EspnSummaryResponse>(url, {
    revalidateSeconds: 600,
  });
  if (!data) return null;

  const comp = data.header?.competitions?.[0];
  if (!comp) return null;

  const home = comp.competitors.find((c) => c.homeAway === "home");
  const away = comp.competitors.find((c) => c.homeAway === "away");
  if (!home || !away) return null;

  const buildTeamInfo = (
    c: NonNullable<typeof home>
  ): EspnTeamInfo => {
    let recordStr: string | null = null;
    if (c.record && c.record.length > 0) {
      const overall = c.record.find((r) => r.type === "total") ?? c.record[0];
      recordStr = overall?.displayValue ?? null;
    }
    return {
      id: c.team.id,
      abbreviation: c.team.abbreviation,
      displayName: c.team.displayName,
      shortDisplayName: c.team.shortDisplayName,
      logo: c.team.logos?.[0]?.href ?? null,
      color: c.team.color ?? null,
      alternateColor: c.team.alternateColor ?? null,
      record: recordStr,
    };
  };

  const boxTeams = data.boxscore?.teams ?? [];
  const homeBox = boxTeams.find((t) => t.team.id === home.team.id);
  const awayBox = boxTeams.find((t) => t.team.id === away.team.id);

  const homePredict = data.predictor?.homeTeam?.gameProjection;
  const awayPredict = data.predictor?.awayTeam?.gameProjection;
  const predictor =
    homePredict && awayPredict
      ? {
          homeWinPct: parseFloat(homePredict),
          awayWinPct: parseFloat(awayPredict),
        }
      : null;

  return {
    eventId,
    date: comp.date,
    status: comp.status.type.name,
    homeTeam: buildTeamInfo(home),
    awayTeam: buildTeamInfo(away),
    homeScore: home.score ? parseInt(home.score, 10) : null,
    awayScore: away.score ? parseInt(away.score, 10) : null,
    boxscore: {
      home: (homeBox?.statistics ?? []).map((s) => ({
        name: s.name,
        label: s.label,
        value: s.displayValue,
      })),
      away: (awayBox?.statistics ?? []).map((s) => ({
        name: s.name,
        label: s.label,
        value: s.displayValue,
      })),
    },
    linescores: {
      home: (home.linescores ?? []).map((l) => l.value),
      away: (away.linescores ?? []).map((l) => l.value),
    },
    predictor,
    records: {
      home: home.record?.find((r) => r.type === "total")?.displayValue ?? "",
      away: away.record?.find((r) => r.type === "total")?.displayValue ?? "",
    },
    venue: comp.venue?.fullName ?? null,
    attendance: comp.attendance ?? null,
  };
};


// ─── API publique : forme equipe (5 derniers + prochains) ─────────


type EspnTeamScheduleResponse = {
  team?: {
    id: string;
    displayName: string;
    record?: { items?: Array<{ summary: string; type: string }> };
  };
  events?: Array<{
    id: string;
    date: string;
    competitions: Array<{
      competitors: Array<{
        id: string;
        homeAway: "home" | "away";
        score?: { value?: number; displayValue?: string };
        winner?: boolean;
        team: { id: string; displayName: string };
      }>;
      status: { type: { name: string; completed?: boolean } };
    }>;
  }>;
};


export const getEspnTeamForm = async (
  espnSport: string,
  espnLeague: string,
  teamId: string
): Promise<EspnTeamForm | null> => {
  const url = `${ESPN_BASE}/${espnSport}/${espnLeague}/teams/${teamId}/schedule`;
  const data = await fetchEspn<EspnTeamScheduleResponse>(url, {
    revalidateSeconds: 1800,
  });
  if (!data || !data.team) return null;

  const recentGames: EspnTeamForm["recentGames"] = [];
  const upcomingGames: EspnTeamForm["upcomingGames"] = [];

  const events = data.events ?? [];
  for (const evt of events) {
    const comp = evt.competitions[0];
    if (!comp) continue;
    const me = comp.competitors.find((c) => c.team.id === teamId);
    const opp = comp.competitors.find((c) => c.team.id !== teamId);
    if (!me || !opp) continue;

    const isCompleted = !!comp.status.type.completed;

    if (isCompleted) {
      const myScore = me.score?.value ?? 0;
      const oppScore = opp.score?.value ?? 0;
      const result: "W" | "L" | "D" =
        me.winner === true
          ? "W"
          : me.winner === false
          ? "L"
          : myScore === oppScore
          ? "D"
          : myScore > oppScore
          ? "W"
          : "L";

      recentGames.push({
        eventId: evt.id,
        date: evt.date,
        opponent: opp.team.displayName,
        isHome: me.homeAway === "home",
        score: { team: myScore, opponent: oppScore },
        result,
      });
    } else {
      upcomingGames.push({
        eventId: evt.id,
        date: evt.date,
        opponent: opp.team.displayName,
        isHome: me.homeAway === "home",
      });
    }
  }

  // Tri : recents = du plus recent au plus ancien (5 max)
  recentGames.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  upcomingGames.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const record =
    data.team.record?.items?.find((r) => r.type === "total")?.summary ?? null;

  return {
    teamId,
    teamName: data.team.displayName,
    recentGames: recentGames.slice(0, 5),
    upcomingGames: upcomingGames.slice(0, 3),
    record,
  };
};


// ─── API publique : helper "tout en un" ───────────────────────────


export type EspnPickContext = {
  eventSummary: EspnEventSummary | null;
  homeForm: EspnTeamForm | null;
  awayForm: EspnTeamForm | null;
};


/**
 * Fonction principale : a partir d'un pick (sportKey OddsAPI + noms equipes
 * + date), recupere TOUTES les data ESPN dispos.
 *
 * Retourne null si le sport n'est pas couvert ESPN ou si aucun match
 * n'a ete trouve.
 */
export const getEspnContextForPick = async (
  sportKey: string,
  homeTeam: string,
  awayTeam: string,
  matchDateIso: string
): Promise<EspnPickContext | null> => {
  const espnMapping = oddsApiSportToEspn(sportKey);
  if (!espnMapping) return null;

  const { espnSport, espnLeague } = espnMapping;

  const eventId = await findEspnEventId(
    espnSport,
    espnLeague,
    homeTeam,
    awayTeam,
    matchDateIso
  );
  if (!eventId) return null;

  const eventSummary = await getEspnEventSummary(espnSport, espnLeague, eventId);
  if (!eventSummary) {
    return { eventSummary: null, homeForm: null, awayForm: null };
  }

  // Fetch en parallele les 2 formes d'equipe
  const [homeForm, awayForm] = await Promise.all([
    getEspnTeamForm(espnSport, espnLeague, eventSummary.homeTeam.id),
    getEspnTeamForm(espnSport, espnLeague, eventSummary.awayTeam.id),
  ]);

  return {
    eventSummary,
    homeForm,
    awayForm,
  };
};