/**
 * PRONOS.CLUB — Mapping ligues odds-api → api-football
 *
 * Quand the-odds-api retourne une ligue, on a besoin de la résoudre vers son
 * équivalent api-football pour fetcher fixtures + forme + H2H + blessures.
 *
 * La résolution se fait en plusieurs étapes :
 *   1. Lookup direct dans LEAGUE_RESOLUTION (mapping explicite)
 *   2. Fallback : split sur " - " si format "Nom - Pays"
 *   3. Fallback : recherche par nom normalisé dans le cache /leagues?current=true
 *
 * Pour ajouter une nouvelle ligue :
 *   1. Vérifier le nom exact dans `getStringList /v4/sports` de the-odds-api
 *   2. Vérifier le nom officiel + pays dans /leagues?current=true d'api-football
 *   3. Ajouter une entrée dans LEAGUE_RESOLUTION
 */

export type LeagueMapping = {
  /** Nom exact de la ligue dans api-football */
  name: string;
  /** Pays exact tel que retourné par api-football */
  country: string;
};

export const LEAGUE_RESOLUTION: Record<string, LeagueMapping> = {
  // ──────────── ANGLETERRE ────────────
  "EPL": { name: "Premier League", country: "England" },
  "Championship": { name: "Championship", country: "England" },
  "League 1": { name: "League One", country: "England" },
  "League 2": { name: "League Two", country: "England" },

  // ──────────── ALLEMAGNE ────────────
  "Bundesliga - Germany": { name: "Bundesliga", country: "Germany" },
  "Bundesliga 2 - Germany": { name: "2. Bundesliga", country: "Germany" },
  "3. Liga - Germany": { name: "3. Liga", country: "Germany" },
  "Frauen-Bundesliga": { name: "Frauen Bundesliga", country: "Germany" },

  // ──────────── ITALIE ────────────
  "Serie A - Italy": { name: "Serie A", country: "Italy" },

  // ──────────── ESPAGNE ────────────
  "La Liga - Spain": { name: "La Liga", country: "Spain" },
  "La Liga 2 - Spain": { name: "Segunda División", country: "Spain" },

  // ──────────── FRANCE ────────────
  "Ligue 1 - France": { name: "Ligue 1", country: "France" },
  "Ligue 2 - France": { name: "Ligue 2", country: "France" },

  // ──────────── PAYS-BAS ────────────
  "Dutch Eredivisie": { name: "Eredivisie", country: "Netherlands" },
  "Eredivisie": { name: "Eredivisie", country: "Netherlands" },

  // ──────────── PORTUGAL ────────────
  "Primeira Liga - Portugal": { name: "Primeira Liga", country: "Portugal" },

  // ──────────── RUSSIE ────────────
  "Premier League - Russia": { name: "Premier League", country: "Russia" },

  // ──────────── AMÉRIQUE DU SUD ────────────
  "Primera División - Argentina": {
    name: "Liga Profesional Argentina",
    country: "Argentina",
  },
  "Brazil Série A": { name: "Serie A", country: "Brazil" },
  "Brazil Série B": { name: "Serie B", country: "Brazil" },

  // ──────────── MOYEN-ORIENT ────────────
  "Saudi Pro League": { name: "Pro League", country: "Saudi-Arabia" },

  // ──────────── BENELUX ────────────
  "Belgium First Div": { name: "Jupiler Pro League", country: "Belgium" },

  // ──────────── EUROPE CENTRALE ────────────
  "Austrian Football Bundesliga": { name: "Bundesliga", country: "Austria" },
  "Swiss Superleague": { name: "Super League", country: "Switzerland" },

  // ──────────── SCANDINAVIE ────────────
  "Allsvenskan - Sweden": { name: "Allsvenskan", country: "Sweden" },
  "Superettan - Sweden": { name: "Superettan", country: "Sweden" },
  "Veikkausliiga - Finland": { name: "Veikkausliiga", country: "Finland" },
  "Eliteserien - Norway": { name: "Eliteserien", country: "Norway" },

  // ──────────── EUROPE DE L'EST ────────────
  "Ekstraklasa - Poland": { name: "Ekstraklasa", country: "Poland" },

  // ──────────── ROYAUME-UNI ────────────
  "Premiership - Scotland": { name: "Premiership", country: "Scotland" },

  // ──────────── TURQUIE ────────────
  "Turkey Super League": { name: "Süper Lig", country: "Turkey" },

  // ──────────── ASIE ────────────
  "Super League - China": { name: "Super League", country: "China" },
  "K League 1": { name: "K League 1", country: "South-Korea" },

  // ──────────── GRÈCE ────────────
  "Super League - Greece": { name: "Super League 1", country: "Greece" },

  // ──────────── OCÉANIE ────────────
  "A-League": { name: "A-League", country: "Australia" },

  // ──────────── AMÉRIQUE DU NORD ────────────
  "MLS": { name: "Major League Soccer", country: "USA" },

  // ──────────── COMPÉTITIONS UEFA ────────────
  "UEFA Champions League": {
    name: "UEFA Champions League",
    country: "World",
  },
  "UEFA Europa League": {
    name: "UEFA Europa League",
    country: "World",
  },
  "UEFA Europa Conference League": {
    name: "UEFA Europa Conference League",
    country: "World",
  },
  "UEFA Champions League Women": {
    name: "UEFA Champions League Women",
    country: "World",
  },
};