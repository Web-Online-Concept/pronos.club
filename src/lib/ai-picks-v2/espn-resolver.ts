// src/lib/ai-picks-v2/espn-resolver.ts
//
// Resolveur ESPN pour les pronostics non-foot (NHL, NBA, NFL, MLB, tennis,
// MMA, rugby, etc.) qui ne sont pas couverts par API-Football.
//
// Strategie :
//   1. Recuperer le slug ESPN de la competition (via getEspnSlugs de live-scores.ts)
//   2. Fetch le scoreboard ESPN sur la date du match (et eventuellement +/- 1 jour)
//   3. Parser via parseEspnScoreboard (deja existant)
//   4. Matcher l'event_name du pick a un game ESPN via teamsMatch (fuzzy)
//   5. Resoudre selon le market (1N2, OVER_UNDER, etc.)

import {
  getEspnSlugs,
  parseEspnScoreboard,
  teamsMatch,
  extractTeams,
  type ParsedGame,
} from "@/lib/live-scores";

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports";


// ─── Types ─────────────────────────────────────────────────────────


export type EspnPick = {
  id: string;
  pick_type: string;
  sport: string;
  league: string;
  event_name: string;
  event_date: string;
  selection: string;
  market: string | null;
  espn_event_id: string | null;
};


export type EspnResolveResult = {
  status: "won" | "lost" | "void" | "still_pending";
  note?: string;
};


// ─── Helpers ───────────────────────────────────────────────────────


/**
 * Format YYYYMMDD pour l'API ESPN scoreboard.
 */
const formatEspnDate = (date: Date): string => {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
};


/**
 * Fetch le scoreboard ESPN pour un slug donne et une date.
 * Retourne la liste des games parses, ou [] en cas d'erreur.
 */
const fetchEspnScoreboard = async (
  slug: string,
  yyyymmdd?: string
): Promise<ParsedGame[]> => {
  try {
    const url = yyyymmdd
      ? `${ESPN_BASE}/${slug}/scoreboard?dates=${yyyymmdd}`
      : `${ESPN_BASE}/${slug}/scoreboard`;

    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      console.warn(
        `[espn-resolver] Scoreboard ${slug} returned ${res.status}`
      );
      return [];
    }

    const data = await res.json();
    return parseEspnScoreboard(data);
  } catch (err) {
    console.warn(
      `[espn-resolver] Failed to fetch ${slug}:`,
      err instanceof Error ? err.message : err
    );
    return [];
  }
};


/**
 * Trouve le game ESPN correspondant a un pick :
 *   - D'abord par espn_event_id si dispo (match exact)
 *   - Sinon par fuzzy match sur les noms d'equipes
 */
const findGameForPick = async (
  pick: EspnPick
): Promise<ParsedGame | null> => {
  const slugs = getEspnSlugs(pick.sport, pick.league);
  if (slugs.length === 0) {
    return null;
  }

  // Preparer 3 dates a interroger (J-1, J, J+1) pour couvrir les fuseaux
  // horaires US et les matchs qui finissent apres minuit
  const matchDate = new Date(pick.event_date);
  const dayBefore = new Date(matchDate.getTime() - 24 * 60 * 60 * 1000);
  const dayAfter = new Date(matchDate.getTime() + 24 * 60 * 60 * 1000);
  const datesToCheck = [
    formatEspnDate(dayBefore),
    formatEspnDate(matchDate),
    formatEspnDate(dayAfter),
  ];

  // Equipes du pick (pour fuzzy match)
  const pickTeams = extractTeams(pick.event_name);
  const pickHome = pickTeams[0] ?? "";
  const pickAway = pickTeams[1] ?? "";

  // Iterer sur slugs * dates, prendre le premier match
  for (const slug of slugs) {
    for (const dateStr of datesToCheck) {
      const games = await fetchEspnScoreboard(slug, dateStr);

      // 1. Match exact par espn_event_id si dispo
      if (pick.espn_event_id) {
        const exactMatch = games.find(
          (g) => g.fixtureId === pick.espn_event_id
        );
        if (exactMatch) return exactMatch;
      }

      // 2. Fuzzy match par equipes
      if (pickHome && pickAway) {
        const fuzzyMatch = games.find(
          (g) =>
            (teamsMatch(g.homeTeam, pickHome) && teamsMatch(g.awayTeam, pickAway)) ||
            (teamsMatch(g.homeTeam, pickAway) && teamsMatch(g.awayTeam, pickHome))
        );
        if (fuzzyMatch) return fuzzyMatch;
      }
    }
  }

  return null;
};


// ─── Resolveurs par marche ─────────────────────────────────────────


const resolve1N2Espn = (
  game: ParsedGame,
  selection: string,
  pickHome: string,
  pickAway: string
): "won" | "lost" | "void" => {
  const sel = selection.toLowerCase().trim();

  // Match nul (rare en hockey/basket apres prolongations)
  if (sel.includes("nul") || sel === "draw" || sel === "n") {
    return game.homeScore === game.awayScore ? "won" : "lost";
  }

  // Selection sur l'equipe domicile ou exterieur
  // On compare au home/away du PICK car ESPN peut avoir invers\u00e9 home/away
  const isPickHomeWinning =
    teamsMatch(game.homeTeam, pickHome)
      ? game.homeScore > game.awayScore
      : game.awayScore > game.homeScore;

  const isPickAwayWinning =
    teamsMatch(game.homeTeam, pickAway)
      ? game.homeScore > game.awayScore
      : game.awayScore > game.homeScore;

  // Detecter si la selection cible le home ou away du pick
  const selOnPickHome =
    sel.includes(pickHome.toLowerCase()) ||
    pickHome.toLowerCase().includes(sel) ||
    sel === "1" ||
    sel === "home";
  const selOnPickAway =
    sel.includes(pickAway.toLowerCase()) ||
    pickAway.toLowerCase().includes(sel) ||
    sel === "2" ||
    sel === "away";

  if (selOnPickHome) return isPickHomeWinning ? "won" : "lost";
  if (selOnPickAway) return isPickAwayWinning ? "won" : "lost";

  return "void";
};


const resolveOverUnderEspn = (
  game: ParsedGame,
  selection: string,
  threshold: number
): "won" | "lost" | "void" => {
  const total = game.homeScore + game.awayScore;
  const sel = selection.toLowerCase();
  const isOver = sel.includes("plus") || sel.includes("over");
  const isUnder = sel.includes("moins") || sel.includes("under");
  if (isOver) {
    if (total === threshold) return "void";
    return total > threshold ? "won" : "lost";
  }
  if (isUnder) {
    if (total === threshold) return "void";
    return total < threshold ? "won" : "lost";
  }
  return "void";
};


const resolveDoubleChanceEspn = (
  game: ParsedGame,
  selection: string,
  pickHome: string,
  pickAway: string
): "won" | "lost" | "void" => {
  const sel = selection.toLowerCase().replace(/\s+/g, "");
  const homeWon = game.homeScore > game.awayScore;
  const awayWon = game.awayScore > game.homeScore;
  const isDraw = game.homeScore === game.awayScore;

  // Recuperer si home/away du game = home/away du pick
  const espnHomeIsPickHome = teamsMatch(game.homeTeam, pickHome);

  if (sel.includes("1x")) {
    // 1X = pick home wins or draws
    if (espnHomeIsPickHome) return (homeWon || isDraw) ? "won" : "lost";
    return (awayWon || isDraw) ? "won" : "lost";
  }
  if (sel.includes("x2")) {
    // X2 = pick away wins or draws
    if (espnHomeIsPickHome) return (awayWon || isDraw) ? "won" : "lost";
    return (homeWon || isDraw) ? "won" : "lost";
  }
  if (sel.includes("12")) {
    return !isDraw ? "won" : "lost";
  }
  return "void";
};


// ─── Fonction principale ──────────────────────────────────────────


export const resolvePickFromEspn = async (
  pick: EspnPick
): Promise<EspnResolveResult> => {
  const slugs = getEspnSlugs(pick.sport, pick.league);
  if (slugs.length === 0) {
    return {
      status: "still_pending",
      note: `No ESPN slug for sport=${pick.sport} league=${pick.league}`,
    };
  }

  const game = await findGameForPick(pick);
  if (!game) {
    return {
      status: "still_pending",
      note: "Game not found on ESPN scoreboard",
    };
  }

  // Match repousse / annule -> void (rembourse) - testEr AVANT le filtre final
  if (game.status === "postponed") {
    return { status: "void", note: "Match postponed/canceled" };
  }

  // Match doit etre termine (statut "final")
  if (game.status !== "final") {
    return {
      status: "still_pending",
      note: `ESPN status: ${game.status}`,
    };
  }

  // Equipes du pick pour la resolution
  const pickTeams = extractTeams(pick.event_name);
  const pickHome = pickTeams[0] ?? "";
  const pickAway = pickTeams[1] ?? "";

  switch (pick.market) {
    case "1N2":
      return { status: resolve1N2Espn(game, pick.selection, pickHome, pickAway) };
    case "DOUBLE_CHANCE":
      return { status: resolveDoubleChanceEspn(game, pick.selection, pickHome, pickAway) };
    case "OVER_UNDER_1_5":
      return { status: resolveOverUnderEspn(game, pick.selection, 1.5) };
    case "OVER_UNDER_2_5":
      return { status: resolveOverUnderEspn(game, pick.selection, 2.5) };
    case "OVER_UNDER_3_5":
      return { status: resolveOverUnderEspn(game, pick.selection, 3.5) };
    case "OVER_UNDER_4_5":
      return { status: resolveOverUnderEspn(game, pick.selection, 4.5) };
    case "OVER_UNDER_5_5":
      return { status: resolveOverUnderEspn(game, pick.selection, 5.5) };
    case "OVER_UNDER_6_5":
      return { status: resolveOverUnderEspn(game, pick.selection, 6.5) };
    default:
      return { status: "void", note: `Unknown ESPN market: ${pick.market}` };
  }
};