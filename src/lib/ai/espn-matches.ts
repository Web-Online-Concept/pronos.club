/**
 * ═══════════════════════════════════════════════════════════════════
 * ESPN CLIENT — Pronos IA
 * ═══════════════════════════════════════════════════════════════════
 *
 * Récupère les matchs du jour depuis ESPN pour alimenter l'IA.
 *
 * Sports couverts :
 *  - Foot : Premier League, Ligue 1, La Liga, Bundesliga, Serie A,
 *    UEFA Champions League
 *  - Tennis : ATP, WTA
 *  - Basket : NBA
 *
 * Source : API publique ESPN (sans clé, undocumented)
 *
 * Usage :
 *   const matches = await getAllTodayMatches();
 * ═══════════════════════════════════════════════════════════════════
 */


// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export type Sport = "soccer" | "tennis" | "basketball";

export interface ESPNLeagueConfig {
  /** Clé interne utilisée dans nos tables (ex: "soccer_epl") */
  league: string;
  /** Path ESPN (ex: "soccer/eng.1") */
  espnPath: string;
  sport: Sport;
  /** Nom lisible pour logs */
  displayName: string;
}

export interface NormalizedMatch {
  /** ID ESPN unique du match (utilisé pour résolution auto) */
  espnEventId: string;
  /** Clé de ligue interne */
  league: string;
  sport: Sport;
  /** Nom de l'événement (ex: "PSG vs Lens") */
  eventName: string;
  /** Date/heure de début (ISO 8601 UTC) */
  eventDate: string;
  /** Équipe ou joueur à domicile */
  homeTeam: string;
  /** Équipe ou joueur à l'extérieur */
  awayTeam: string;
  /** Abréviations pour matching cotes (ex: "PSG", "RCL") */
  homeAbbr?: string;
  awayAbbr?: string;
  /** Forme récente si dispo (5 derniers matchs, ex: "WWLDW") */
  homeForm?: string;
  awayForm?: string;
  /** Infos contextuelles optionnelles */
  venue?: string;
  status: "scheduled" | "in_progress" | "completed" | "postponed" | "other";
}


// ═══════════════════════════════════════════════════════════════════
// LIGUES COUVERTES
// ═══════════════════════════════════════════════════════════════════

export const LEAGUES: ESPNLeagueConfig[] = [
  // FOOT — 5 Big + C1
  { league: "soccer_epl", espnPath: "soccer/eng.1", sport: "soccer", displayName: "Premier League" },
  { league: "soccer_france_ligue_one", espnPath: "soccer/fra.1", sport: "soccer", displayName: "Ligue 1" },
  { league: "soccer_spain_la_liga", espnPath: "soccer/esp.1", sport: "soccer", displayName: "La Liga" },
  { league: "soccer_germany_bundesliga", espnPath: "soccer/ger.1", sport: "soccer", displayName: "Bundesliga" },
  { league: "soccer_italy_serie_a", espnPath: "soccer/ita.1", sport: "soccer", displayName: "Serie A" },
  { league: "soccer_uefa_champs_league", espnPath: "soccer/uefa.champions", sport: "soccer", displayName: "Champions League" },
  // TENNIS (ATP + WTA sous même endpoint ESPN)
  { league: "tennis_atp", espnPath: "tennis/atp", sport: "tennis", displayName: "ATP" },
  { league: "tennis_wta", espnPath: "tennis/wta", sport: "tennis", displayName: "WTA" },
  // BASKET
  { league: "basketball_nba", espnPath: "basketball/nba", sport: "basketball", displayName: "NBA" },
];


// ═══════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports";
const FETCH_TIMEOUT_MS = 10000;

/** Nombre d'heures avant kick-off à partir desquelles un match est "éligible" */
const MIN_HOURS_BEFORE_KICKOFF = 1;
/** Nombre d'heures max avant kick-off (on ne prend pas un match à J+2) */
const MAX_HOURS_BEFORE_KICKOFF = 30;


// ═══════════════════════════════════════════════════════════════════
// FETCH HELPER
// ═══════════════════════════════════════════════════════════════════

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "PronosClub-AI/1.0" },
      cache: "no-store",
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}


// ═══════════════════════════════════════════════════════════════════
// MAP ESPN STATUS → normalized
// ═══════════════════════════════════════════════════════════════════

function mapStatus(espnStatus: string | undefined): NormalizedMatch["status"] {
  if (!espnStatus) return "other";
  const s = espnStatus.toLowerCase();
  if (s.includes("pre") || s.includes("scheduled")) return "scheduled";
  if (s.includes("in") || s.includes("live")) return "in_progress";
  if (s.includes("post") && s.includes("pone")) return "postponed";
  if (s.includes("final") || s.includes("completed") || s.includes("full")) return "completed";
  return "other";
}


// ═══════════════════════════════════════════════════════════════════
// FETCH SCOREBOARD D'UNE LIGUE
// ═══════════════════════════════════════════════════════════════════

export async function fetchLeagueMatches(
  config: ESPNLeagueConfig,
): Promise<NormalizedMatch[]> {
  const url = `${ESPN_BASE}/${config.espnPath}/scoreboard`;

  try {
    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      console.warn(`[ESPN] ${config.displayName}: HTTP ${response.status}`);
      return [];
    }

    const data = await response.json();
    const events = Array.isArray(data?.events) ? data.events : [];

    return events
      .map((event: unknown): NormalizedMatch | null => parseEspnEvent(event, config))
      .filter((m: NormalizedMatch | null): m is NormalizedMatch => m !== null);
  } catch (err) {
    console.error(`[ESPN] Error fetching ${config.displayName}:`, err);
    return [];
  }
}


// ═══════════════════════════════════════════════════════════════════
// PARSE UN ÉVÉNEMENT ESPN
// ═══════════════════════════════════════════════════════════════════

interface EspnEvent {
  id?: string;
  date?: string;
  name?: string;
  shortName?: string;
  status?: { type?: { name?: string } };
  competitions?: Array<{
    venue?: { fullName?: string };
    competitors?: Array<{
      homeAway?: "home" | "away";
      team?: { displayName?: string; abbreviation?: string; name?: string };
      athlete?: { displayName?: string };
      form?: string;
    }>;
  }>;
}

function parseEspnEvent(
  rawEvent: unknown,
  config: ESPNLeagueConfig,
): NormalizedMatch | null {
  const event = rawEvent as EspnEvent;

  if (!event?.id || !event?.date) return null;

  const competition = event.competitions?.[0];
  if (!competition) return null;

  const competitors = competition.competitors ?? [];
  const home = competitors.find((c) => c.homeAway === "home") ?? competitors[0];
  const away = competitors.find((c) => c.homeAway === "away") ?? competitors[1];

  if (!home || !away) return null;

  // Pour les sports d'équipe : team.displayName
  // Pour le tennis (individuel) : athlete.displayName, sinon team.displayName
  const homeTeam =
    home.team?.displayName ??
    home.athlete?.displayName ??
    home.team?.name ??
    "Unknown";
  const awayTeam =
    away.team?.displayName ??
    away.athlete?.displayName ??
    away.team?.name ??
    "Unknown";

  return {
    espnEventId: event.id,
    league: config.league,
    sport: config.sport,
    eventName: event.shortName ?? event.name ?? `${homeTeam} vs ${awayTeam}`,
    eventDate: event.date,
    homeTeam,
    awayTeam,
    homeAbbr: home.team?.abbreviation,
    awayAbbr: away.team?.abbreviation,
    homeForm: home.form,
    awayForm: away.form,
    venue: competition.venue?.fullName,
    status: mapStatus(event.status?.type?.name),
  };
}


// ═══════════════════════════════════════════════════════════════════
// FILTRE MATCHS "ÉLIGIBLES" (pas trop tôt, pas trop tard)
// ═══════════════════════════════════════════════════════════════════

function isMatchEligible(match: NormalizedMatch, now: Date): boolean {
  if (match.status !== "scheduled") return false;

  const kickoff = new Date(match.eventDate);
  const diffMs = kickoff.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  return diffHours >= MIN_HOURS_BEFORE_KICKOFF && diffHours <= MAX_HOURS_BEFORE_KICKOFF;
}


// ═══════════════════════════════════════════════════════════════════
// FONCTION PRINCIPALE : récupère tous les matchs éligibles du jour
// ═══════════════════════════════════════════════════════════════════

export async function getAllTodayMatches(): Promise<NormalizedMatch[]> {
  const now = new Date();

  // Fetch toutes les ligues en parallèle pour aller vite
  const results = await Promise.all(
    LEAGUES.map((config) => fetchLeagueMatches(config)),
  );

  const allMatches = results.flat();
  const eligible = allMatches.filter((m) => isMatchEligible(m, now));

  // Log pour debug
  console.log(
    `[ESPN] Matches fetched: ${allMatches.length} total, ${eligible.length} eligible (next ${MAX_HOURS_BEFORE_KICKOFF}h)`,
  );

  return eligible;
}


// ═══════════════════════════════════════════════════════════════════
// HELPER : Récupère un match spécifique par son ID ESPN
// (utilisé par le résolveur pour retrouver le match après coup)
// ═══════════════════════════════════════════════════════════════════

export async function fetchMatchById(
  espnEventId: string,
  config: ESPNLeagueConfig,
): Promise<NormalizedMatch | null> {
  const url = `${ESPN_BASE}/${config.espnPath}/summary?event=${espnEventId}`;

  try {
    const response = await fetchWithTimeout(url);
    if (!response.ok) return null;

    const data = await response.json();
    const event = data?.header?.competitions?.[0]
      ? { id: espnEventId, date: data.header.competitions[0].date, ...data.header }
      : null;

    if (!event) return null;
    return parseEspnEvent(event, config);
  } catch (err) {
    console.error(`[ESPN] fetchMatchById error for ${espnEventId}:`, err);
    return null;
  }
}