/**
 * ═══════════════════════════════════════════════════════════════════
 * understat-client.ts
 * ═══════════════════════════════════════════════════════════════════
 *
 * Recupere les donnees xG joueurs depuis Understat.com.
 *
 * Sources publiques :
 * - https://understat.com/league/{league}/{year}  (data dans <script>)
 * - https://understat.com/team/{team}/{year}      (data dans <script>)
 *
 * Couverture : EPL, La Liga, Bundesliga, Serie A, Ligue 1, RFPL.
 *
 * Methode : Understat encode ses tables JSON en escape sequences
 * dans des balises <script> du HTML. On extrait, on decode, on parse.
 *
 * Cle du value-bet engine buteur : pour chaque joueur on calcule
 *   xG_per_90 = xG_total / minutes_jouees * 90
 * et on retire les penaltys (npxG) car contexte different.
 *
 * Cache disque : 24h (les xG bougent peu en cours de saison).
 * ═══════════════════════════════════════════════════════════════════
 */


const UNDERSTAT_BASE = "https://understat.com";


// ─── Mapping ligue API-Football -> Understat ──────────────────────


export type UnderstatLeague =
  | "EPL"
  | "La_liga"
  | "Bundesliga"
  | "Serie_A"
  | "Ligue_1"
  | "RFPL";


/**
 * Mappe un league.id API-Football vers le slug Understat correspondant.
 * Retourne null si la ligue n'est pas couverte.
 */
export const apiFootballLeagueToUnderstat = (
  apiFootballLeagueId: number
): UnderstatLeague | null => {
  const map: Record<number, UnderstatLeague> = {
    39: "EPL", // Premier League
    140: "La_liga", // La Liga
    78: "Bundesliga",
    135: "Serie_A",
    61: "Ligue_1",
    235: "RFPL", // Russie Premier League
  };
  return map[apiFootballLeagueId] ?? null;
};


/**
 * Saison Understat : on prend l'annee de debut.
 * Ex: saison 2025/26 -> "2025"
 */
export const getCurrentUnderstatSeason = (): string => {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const year = now.getFullYear();
  // Saison europeenne demarre en aout/septembre
  return month >= 7 ? String(year) : String(year - 1);
};


// ─── Types Understat simplifies ───────────────────────────────────


export type UnderstatPlayer = {
  id: string;
  player_name: string;
  team_title: string;
  position: string; // "F", "F M S", "M", "D", "GK", etc.
  games: number;
  time: number; // minutes totales
  goals: number;
  assists: number;
  shots: number;
  key_passes: number;
  xG: number; // expected goals
  xA: number; // expected assists
  npg: number; // non-penalty goals
  npxG: number; // non-penalty xG
  /** xG cumule de toutes les chaines / passes amenant aux tirs */
  xGChain?: number;
  /** xG buildup */
  xGBuildup?: number;
};


export type UnderstatPlayerStats = UnderstatPlayer & {
  /**
   * xG buts (non-penalty) par 90 minutes joueés.
   * C'est LA metrique de reference pour le value bet buteur.
   */
  npxG_per_90: number;
};


export type UnderstatTeamStats = {
  id: string;
  title: string;
  matches: number;
  /** xG total marque par l'equipe */
  xG: number;
  /** xGA = xG concede par l'equipe (= force defensive inverse) */
  xGA: number;
  pts: number;
  scored: number;
  missed: number;
  /** xGA par match (utile pour ajustement defense adverse) */
  xGA_per_match: number;
};


// ─── Scraper helpers ──────────────────────────────────────────────


type FetchOptions = {
  /** Pour Next.js : duree de cache en secondes. */
  revalidateSeconds?: number;
};


const fetchUnderstatHtml = async (
  url: string,
  options: FetchOptions = {}
): Promise<string | null> => {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; PronosClubBot/1.0; +https://www.pronos.club)",
        Accept: "text/html,application/xhtml+xml",
      },
      next: options.revalidateSeconds
        ? { revalidate: options.revalidateSeconds }
        : { revalidate: 86400 }, // default 24h
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.warn(`[understat] ${url} returned ${res.status}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.warn(
      `[understat] fetch failed for ${url}:`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
};


/**
 * Understat encode ses payloads JSON dans le HTML sous la forme :
 *   var <varName>	= JSON.parse('<urlencoded-escaped-string>');
 *
 * Cette fonction extrait et decode la variable demandee.
 */
const extractUnderstatJson = <T = unknown>(
  html: string,
  varName: string
): T | null => {
  // Pattern : varName = JSON.parse('....')
  const pattern = new RegExp(
    `var\\s+${varName}\\s*=\\s*JSON\\.parse\\s*\\(\\s*['"]([^'"]*)['"]\\s*\\)`,
    "i"
  );
  const match = pattern.exec(html);
  if (!match || !match[1]) return null;

  // Decoder les escape sequences \\xNN -> caractere
  const escaped = match[1];
  let decoded = "";
  for (let i = 0; i < escaped.length; i++) {
    if (
      escaped[i] === "\\" &&
      escaped[i + 1] === "x" &&
      i + 3 < escaped.length
    ) {
      const hex = escaped.substring(i + 2, i + 4);
      decoded += String.fromCharCode(parseInt(hex, 16));
      i += 3;
    } else {
      decoded += escaped[i];
    }
  }

  try {
    return JSON.parse(decoded) as T;
  } catch (err) {
    console.warn(
      `[understat] JSON.parse failed for ${varName}:`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
};


// ─── Normalize team name pour matching API-Football <-> Understat ─


/**
 * Understat utilise des noms parfois differents d'API-Football.
 * Ex: "Manchester United" vs "Manchester Utd", "Paris Saint Germain" vs "PSG".
 * Cette fonction normalise pour le matching.
 */
const normalizeTeamName = (name: string): string => {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .toLowerCase()
    .replace(/\b(fc|cf|ac|sc|club|de|del|la|le|el|al|the)\b/g, "")
    .replace(/\b(saint|st)\b/g, "")
    .replace(/[.,'']/g, "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};


export const teamsMatchUnderstat = (a: string, b: string): boolean => {
  const na = normalizeTeamName(a);
  const nb = normalizeTeamName(b);
  if (na === nb) return true;
  if (na.length >= 4 && nb.includes(na)) return true;
  if (nb.length >= 4 && na.includes(nb)) return true;
  // Match sur dernier mot significatif (>= 4 chars)
  const wordsA = na.split(" ").filter((w) => w.length >= 4);
  const wordsB = nb.split(" ").filter((w) => w.length >= 4);
  for (const wa of wordsA) {
    for (const wb of wordsB) {
      if (wa === wb) return true;
    }
  }
  return false;
};


// ─── API publique ──────────────────────────────────────────────────


/**
 * Recupere les stats de tous les joueurs d'une ligue pour la saison
 * en cours.
 *
 * Methode : POST sur l'endpoint /main/getPlayersStats/ qui retourne du
 * JSON propre {success, players: [...]}. Plus fiable et rapide que le
 * scraping du HTML (que Understat a deprecie en 2025).
 */
export const getUnderstatLeaguePlayers = async (
  league: UnderstatLeague,
  season: string = getCurrentUnderstatSeason()
): Promise<UnderstatPlayerStats[]> => {
  const url = `${UNDERSTAT_BASE}/main/getPlayersStats/`;
  const body = `league=${encodeURIComponent(league)}&season=${encodeURIComponent(season)}`;

  let json: { success?: boolean; players?: UnderstatPlayer[] } | null = null;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; PronosClubBot/1.0; +https://www.pronos.club)",
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
      },
      body,
      next: { revalidate: 86400 }, // 24h cache
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.warn(`[understat] POST players returned ${res.status} for ${league}/${season}`);
      return [];
    }
    json = await res.json();
  } catch (err) {
    console.warn(
      `[understat] POST players failed for ${league}/${season}:`,
      err instanceof Error ? err.message : err
    );
    return [];
  }

  const players = json?.players;
  if (!players || !Array.isArray(players)) {
    console.warn(`[understat] no players in response for ${league}/${season}`);
    return [];
  }

  // Cast et calcul de npxG_per_90
  return players.map((p) => {
    const games = Number(p.games) || 0;
    const time = Number(p.time) || 0;
    const xG = Number(p.xG) || 0;
    const npxG = Number(p.npxG) || 0;
    const npg = Number(p.npg) || 0;
    const goals = Number(p.goals) || 0;
    const assists = Number(p.assists) || 0;
    const shots = Number(p.shots) || 0;
    const key_passes = Number(p.key_passes) || 0;
    const xA = Number(p.xA) || 0;

    return {
      id: String(p.id),
      player_name: String(p.player_name),
      team_title: String(p.team_title),
      position: String(p.position ?? ""),
      games,
      time,
      goals,
      assists,
      shots,
      key_passes,
      xG,
      xA,
      npg,
      npxG,
      xGChain: Number(p.xGChain) || 0,
      xGBuildup: Number(p.xGBuildup) || 0,
      npxG_per_90: time > 0 ? (npxG * 90) / time : 0,
    };
  });
};


/**
 * Recupere les stats d'equipes d'une ligue (pour calcul ajustement
 * defense adverse).
 *
 * Methode : POST /main/getTeamsStats/ qui retourne du JSON contenant
 * les statistiques agregees par equipe avec history des matchs.
 *
 * En cas d'echec (endpoint indisponible), retourne tableau vide.
 * Le moteur utilisera alors le fallback "ligue moyenne" (xGA = 1.4).
 */
export const getUnderstatLeagueTeams = async (
  league: UnderstatLeague,
  season: string = getCurrentUnderstatSeason()
): Promise<UnderstatTeamStats[]> => {
  const url = `${UNDERSTAT_BASE}/main/getTeamsStats/`;
  const body = `league=${encodeURIComponent(league)}&season=${encodeURIComponent(season)}`;

  let json: { success?: boolean; teamsData?: Record<string, unknown> } | null = null;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; PronosClubBot/1.0; +https://www.pronos.club)",
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
      },
      body,
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.warn(`[understat] POST teams returned ${res.status} for ${league}/${season}`);
      return [];
    }
    json = await res.json();
  } catch (err) {
    console.warn(
      `[understat] POST teams failed for ${league}/${season}:`,
      err instanceof Error ? err.message : err
    );
    return [];
  }

  // L'endpoint peut renvoyer differents formats selon la version
  // d'Understat. On tente les 2 plus probables.
  const teams =
    (json && typeof json === "object" && "teamsData" in json
      ? (json as { teamsData?: Record<string, unknown> }).teamsData
      : null) ??
    (json && typeof json === "object" && "teams" in json
      ? (json as { teams?: Record<string, unknown> }).teams
      : null);

  if (!teams || typeof teams !== "object") {
    console.warn(`[understat] no teamsData found for ${league}/${season}`);
    return [];
  }

  const results: UnderstatTeamStats[] = [];
  for (const [id, raw] of Object.entries(teams)) {
    const t = raw as Record<string, unknown>;
    const history = Array.isArray(t.history) ? t.history : [];
    let totalXG = 0;
    let totalXGA = 0;
    const matchCount = history.length;
    let pts = 0;
    let scored = 0;
    let missed = 0;

    for (const h of history) {
      const hist = h as Record<string, unknown>;
      totalXG += Number(hist.xG) || 0;
      totalXGA += Number(hist.xGA) || 0;
      pts += Number(hist.pts) || 0;
      scored += Number(hist.scored) || 0;
      missed += Number(hist.missed) || 0;
    }

    if (matchCount === 0) continue;

    results.push({
      id,
      title: String(t.title ?? ""),
      matches: matchCount,
      xG: totalXG,
      xGA: totalXGA,
      pts,
      scored,
      missed,
      xGA_per_match: matchCount > 0 ? totalXGA / matchCount : 0,
    });
  }

  return results;
};


/**
 * Helper "tout en un" : retourne la xGA moyenne de la ligue
 * (pour calculer le multiplicateur defense adverse).
 */
export const getLeagueAverageXGAPerMatch = (
  teams: UnderstatTeamStats[]
): number => {
  if (teams.length === 0) return 1.4; // fallback ligue moyenne
  const total = teams.reduce((acc, t) => acc + t.xGA_per_match, 0);
  return total / teams.length;
};


/**
 * Filtre les joueurs ayant assez de minutes joueés pour avoir une
 * estimation xG/90 fiable.
 *
 * Standard pro : minimum 450 minutes joueés (~5 matchs entiers).
 * En dessous, le ratio xG/90 est trop bruite pour etre fiable.
 *
 * On exclut aussi automatiquement les gardiens et defenseurs centraux
 * dont la position contient "GK" ou est purement "D".
 */
export const filterEligibleScorers = (
  players: UnderstatPlayerStats[],
  minMinutes: number = 450
): UnderstatPlayerStats[] => {
  return players.filter((p) => {
    if (p.time < minMinutes) return false;

    // Filtre positionnel : exclure gardiens et defenseurs purs
    const pos = p.position.toUpperCase();
    if (pos === "GK" || pos === "G") return false;
    if (pos === "D" || pos === "D S") return false; // pure defenseur

    // Garder si position contient "F" (forward), "M" (midfielder), "S" (sub)
    // Note : Understat utilise codes comme "F M S" = forward + midfielder + sub
    // On garde tout ce qui n'est pas pur defenseur ou gardien
    return true;
  });
};


/**
 * Trouve un joueur par nom (fuzzy match) parmi une liste fournie.
 * Utile pour matcher les noms Bet365 (parfois abreges) avec Understat.
 */
export const findUnderstatPlayerByName = (
  players: UnderstatPlayerStats[],
  searchName: string,
  teamHint?: string
): UnderstatPlayerStats | null => {
  if (!searchName) return null;

  const normalizedSearch = normalizeTeamName(searchName);

  // 1. Exact match
  for (const p of players) {
    if (normalizeTeamName(p.player_name) === normalizedSearch) {
      // Si teamHint fourni, on verifie aussi
      if (teamHint && !teamsMatchUnderstat(p.team_title, teamHint)) continue;
      return p;
    }
  }

  // 2. Fuzzy : nom de famille partage
  const searchTokens = normalizedSearch.split(" ").filter((t) => t.length >= 3);
  if (searchTokens.length === 0) return null;

  for (const p of players) {
    const playerTokens = normalizeTeamName(p.player_name)
      .split(" ")
      .filter((t) => t.length >= 3);
    // Toutes les tokens du search doivent etre dans le player
    const allMatch = searchTokens.every((st) => playerTokens.includes(st));
    if (allMatch) {
      if (teamHint && !teamsMatchUnderstat(p.team_title, teamHint)) continue;
      return p;
    }
  }

  // 3. Fuzzy plus permissif : au moins 1 token >= 4 chars en commun
  for (const p of players) {
    const playerTokens = normalizeTeamName(p.player_name)
      .split(" ")
      .filter((t) => t.length >= 4);
    const someMatch = searchTokens.some(
      (st) => st.length >= 4 && playerTokens.includes(st)
    );
    if (someMatch) {
      if (teamHint && !teamsMatchUnderstat(p.team_title, teamHint)) continue;
      return p;
    }
  }

  return null;
};