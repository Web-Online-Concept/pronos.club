// src/lib/over-05-buts-equipes/team-mapping.ts
//
// Mapping des noms d'equipes entre :
//  - API-Football  (ex: "Olympique Marseille")
//  - DB o05_teams  (ex: "Marseille")
//  - Understat slug (ex: "Marseille")
//  - Excel Bertrand (ex: "Marseille")
//
// VERSION 2 — ajout Bundesliga + Serie A (38 equipes supplementaires).
// Total : 96 equipes mappees pour les 5 grands championnats Understat.
//
// Slugs Understat verifies depuis :
//   - https://understat.com/team/Bayern_Munich/2025
//   - https://understat.com/team/Napoli/2025
//   - liste officielle teams Bundesliga / Serie A sur Understat
//
// Convention Understat : nom de ville/club sans accents, espaces -> underscore.
// Quelques cas particuliers necessitent une table d'exceptions.

// ─── Mapping API-Football -> nom normalisé DB ──────────────────────

const API_FOOTBALL_TO_DB: Record<string, string> = {
  // ─── Ligue 1 ───
  "Paris Saint Germain": "psg",
  "PSG": "psg",
  "Olympique Marseille": "marseille",
  "Marseille": "marseille",
  "AS Monaco": "monaco",
  "Monaco": "monaco",
  "Lille OSC": "lille",
  "Lille": "lille",
  "Olympique Lyonnais": "lyon",
  "Lyon": "lyon",
  "OGC Nice": "nice",
  "Nice": "nice",
  "RC Lens": "lens",
  "Lens": "lens",
  "Stade Rennais": "rennes",
  "Rennes": "rennes",
  "Stade Brestois 29": "brest",
  "Brest": "brest",
  "Strasbourg": "strasbourg",
  "RC Strasbourg Alsace": "strasbourg",
  "Toulouse": "toulouse",
  "FC Nantes": "nantes",
  "Nantes": "nantes",
  "AJ Auxerre": "auxerre",
  "Auxerre": "auxerre",
  "Angers SCO": "angers",
  "Angers": "angers",
  "Le Havre AC": "le_havre",
  "Le Havre": "le_havre",
  "FC Lorient": "lorient",
  "Lorient": "lorient",
  "FC Metz": "metz",
  "Metz": "metz",
  "Paris FC": "paris_fc",

  // ─── Premier League ───
  "Liverpool": "liverpool",
  "Manchester City": "manchester_city",
  "Manchester Utd": "manchester_united",
  "Manchester United": "manchester_united",
  "Arsenal": "arsenal",
  "Chelsea": "chelsea",
  "Tottenham": "tottenham",
  "Newcastle": "newcastle",
  "Aston Villa": "aston_villa",
  "Brighton": "brighton",
  "West Ham": "west_ham",
  "Brentford": "brentford",
  "Crystal Palace": "crystal_palace",
  "Bournemouth": "bournemouth",
  "AFC Bournemouth": "bournemouth",
  "Fulham": "fulham",
  "Everton": "everton",
  "Wolves": "wolves",
  "Nottingham Forest": "nottingham_forest",
  "Burnley": "burnley",
  "Leeds": "leeds",
  "Leeds United": "leeds",
  "Sunderland": "sunderland",

  // ─── La Liga ───
  "Real Madrid": "real_madrid",
  "Barcelona": "barcelona",
  "Atletico Madrid": "atletico_madrid",
  "Athletic Club": "athletic_club",
  "Villarreal": "villarreal",
  "Real Betis": "real_betis",
  "Betis": "real_betis",
  "Real Sociedad": "real_sociedad",
  "Sevilla": "sevilla",
  "Valencia": "valencia",
  "Celta Vigo": "celta_vigo",
  "Rayo Vallecano": "rayo_vallecano",
  "Osasuna": "osasuna",
  "Mallorca": "mallorca",
  "Getafe": "getafe",
  "Girona": "girona",
  "Espanyol": "espanyol",
  "Alaves": "alaves",
  "Deportivo Alaves": "alaves",
  "Levante": "levante",
  "Elche": "elche",
  "Real Oviedo": "real_oviedo",
  "Oviedo": "real_oviedo",

  // ─── Bundesliga ───
  // Note: API-Football utilise des noms variés selon les saisons, on couvre les variantes.
  "Bayern München": "bayern_munchen",
  "Bayern Munich": "bayern_munchen",
  "FC Bayern München": "bayern_munchen",
  "Borussia Dortmund": "borussia_dortmund",
  "RB Leipzig": "rb_leipzig",
  "RasenBallsport Leipzig": "rb_leipzig",
  "VfB Stuttgart": "vfb_stuttgart",
  "Stuttgart": "vfb_stuttgart",
  "1899 Hoffenheim": "1899_hoffenheim",
  "TSG Hoffenheim": "1899_hoffenheim",
  "Hoffenheim": "1899_hoffenheim",
  "Bayer Leverkusen": "bayer_leverkusen",
  "Bayer 04 Leverkusen": "bayer_leverkusen",
  "Leverkusen": "bayer_leverkusen",
  "SC Freiburg": "sc_freiburg",
  "Freiburg": "sc_freiburg",
  "Eintracht Frankfurt": "eintracht_frankfurt",
  "FC Augsburg": "fc_augsburg",
  "Augsburg": "fc_augsburg",
  "FSV Mainz 05": "fsv_mainz_05",
  "FSV Mainz": "fsv_mainz_05",
  "Mainz 05": "fsv_mainz_05",
  "Mainz": "fsv_mainz_05",
  "Hamburger SV": "hamburger_sv",
  "Hamburg": "hamburger_sv",
  "Union Berlin": "union_berlin",
  "1. FC Union Berlin": "union_berlin",
  "Borussia Mönchengladbach": "borussia_monchengladbach",
  "Borussia M.Gladbach": "borussia_monchengladbach",
  "Mönchengladbach": "borussia_monchengladbach",
  "1. FC Köln": "1._fc_koln",
  "FC Köln": "1._fc_koln",
  "1. FC Koln": "1._fc_koln",
  "Köln": "1._fc_koln",
  "FC Cologne": "1._fc_koln",
  "Cologne": "1._fc_koln",
  "Werder Bremen": "werder_bremen",
  "SV Werder Bremen": "werder_bremen",
  "VfL Wolfsburg": "vfl_wolfsburg",
  "Wolfsburg": "vfl_wolfsburg",
  "1. FC Heidenheim": "1._fc_heidenheim",
  "FC Heidenheim": "1._fc_heidenheim",
  "1. FC Heidenheim 1846": "1._fc_heidenheim",
  "Heidenheim": "1._fc_heidenheim",
  "FC St. Pauli": "fc_st._pauli",
  "St. Pauli": "fc_st._pauli",
  "St Pauli": "fc_st._pauli",

  // ─── Serie A ───
  "Inter": "inter",
  "Inter Milan": "inter",
  "Internazionale": "inter",
  "FC Internazionale": "inter",
  "Napoli": "napoli",
  "SSC Napoli": "napoli",
  "Juventus": "juventus",
  "Juventus FC": "juventus",
  "AC Milan": "ac_milan",
  "Milan": "ac_milan",
  "AS Roma": "as_roma",
  "Roma": "as_roma",
  "Como": "como",
  "Como 1907": "como",
  "Atalanta": "atalanta",
  "Atalanta BC": "atalanta",
  "Bologna": "bologna",
  "Bologna FC": "bologna",
  "Lazio": "lazio",
  "SS Lazio": "lazio",
  "Udinese": "udinese",
  "Udinese Calcio": "udinese",
  "Sassuolo": "sassuolo",
  "US Sassuolo": "sassuolo",
  "Sassuolo Calcio": "sassuolo",
  "Torino": "torino",
  "Torino FC": "torino",
  "Parma": "parma",
  "Parma Calcio 1913": "parma",
  "Genoa": "genoa",
  "Genoa CFC": "genoa",
  "Fiorentina": "fiorentina",
  "ACF Fiorentina": "fiorentina",
  "Cagliari": "cagliari",
  "Cagliari Calcio": "cagliari",
  "Lecce": "lecce",
  "US Lecce": "lecce",
  "Cremonese": "cremonese",
  "US Cremonese": "cremonese",
  "Hellas Verona": "hellas_verona",
  "Verona": "hellas_verona",
  "Pisa": "pisa",
  "Pisa SC": "pisa",
};


// ─── Mapping DB -> slug Understat ──────────────────────────────────

/**
 * Slugs Understat pour les 96 equipes des 5 championnats PROJET.
 * URL pattern : https://understat.com/team/{slug}/{year}
 *
 * Pour les championnats hors Top 5 (Phase 5 a venir), ce mapping
 * retournera null et le code basculera sur API-Football.
 */
const DB_TO_UNDERSTAT: Record<string, string | null> = {
  // ─── Ligue 1 (Understat) ───
  "psg": "Paris_Saint_Germain",
  "marseille": "Marseille",
  "monaco": "Monaco",
  "lille": "Lille",
  "lyon": "Lyon",
  "nice": "Nice",
  "lens": "Lens",
  "rennes": "Rennes",
  "brest": "Brest",
  "strasbourg": "Strasbourg",
  "toulouse": "Toulouse",
  "nantes": "Nantes",
  "auxerre": "Auxerre",
  "angers": "Angers",
  "le_havre": "Le_Havre",
  "lorient": "Lorient",
  "metz": "Metz",
  "paris_fc": "Paris_FC",

  // ─── Premier League (Understat) ───
  "liverpool": "Liverpool",
  "manchester_city": "Manchester_City",
  "manchester_united": "Manchester_United",
  "arsenal": "Arsenal",
  "chelsea": "Chelsea",
  "tottenham": "Tottenham",
  "newcastle": "Newcastle_United",
  "aston_villa": "Aston_Villa",
  "brighton": "Brighton",
  "west_ham": "West_Ham",
  "brentford": "Brentford",
  "crystal_palace": "Crystal_Palace",
  "bournemouth": "Bournemouth",
  "fulham": "Fulham",
  "everton": "Everton",
  "wolves": "Wolverhampton_Wanderers",
  "nottingham_forest": "Nottingham_Forest",
  "burnley": "Burnley",
  "leeds": "Leeds",
  "sunderland": "Sunderland",

  // ─── La Liga (Understat) ───
  "real_madrid": "Real_Madrid",
  "barcelona": "Barcelona",
  "atletico_madrid": "Atletico_Madrid",
  "athletic_club": "Athletic_Club",
  "villarreal": "Villarreal",
  "real_betis": "Real_Betis",
  "real_sociedad": "Real_Sociedad",
  "sevilla": "Sevilla",
  "valencia": "Valencia",
  "celta_vigo": "Celta_Vigo",
  "rayo_vallecano": "Rayo_Vallecano",
  "osasuna": "Osasuna",
  "mallorca": "Mallorca",
  "getafe": "Getafe",
  "girona": "Girona",
  "espanyol": "Espanyol",
  "alaves": "Alaves",
  "levante": "Levante",
  "elche": "Elche",
  "real_oviedo": "Real_Oviedo",

  // ─── Bundesliga (Understat) ───
  // Slugs verifies depuis la liste teams Understat:
  // Bayer Leverkusen, Bayern Munich, Borussia Dortmund, Borussia M.Gladbach,
  // Eintracht Frankfurt, FC Cologne, FC Heidenheim, Freiburg, Hamburger SV,
  // Hoffenheim, Mainz 05, RasenBallsport Leipzig, etc.
  "bayern_munchen": "Bayern_Munich",
  "borussia_dortmund": "Borussia_Dortmund",
  "rb_leipzig": "RasenBallsport_Leipzig",
  "vfb_stuttgart": "VfB_Stuttgart",
  "1899_hoffenheim": "Hoffenheim",
  "bayer_leverkusen": "Bayer_Leverkusen",
  "sc_freiburg": "Freiburg",
  "eintracht_frankfurt": "Eintracht_Frankfurt",
  "fc_augsburg": "Augsburg",
  "fsv_mainz_05": "Mainz_05",
  "hamburger_sv": "Hamburger_SV",
  "union_berlin": "Union_Berlin",
  "borussia_monchengladbach": "Borussia_M.Gladbach",
  "1._fc_koln": "FC_Cologne",
  "werder_bremen": "Werder_Bremen",
  "vfl_wolfsburg": "VfL_Wolfsburg",
  "1._fc_heidenheim": "FC_Heidenheim",
  "fc_st._pauli": "St._Pauli",

  // ─── Serie A (Understat) ───
  // Slugs verifies depuis la liste teams Understat:
  // AC Milan, Atalanta, Bologna, Cagliari, Como, Cremonese, Fiorentina,
  // Genoa, Inter, Juventus, Lazio, Lecce, Napoli, Parma, Pisa, Roma,
  // Sassuolo, Torino, Udinese, Verona.
  "inter": "Internazionale",
  "napoli": "Napoli",
  "juventus": "Juventus",
  "ac_milan": "Milan",
  "as_roma": "Roma",
  "como": "Como",
  "atalanta": "Atalanta",
  "bologna": "Bologna",
  "lazio": "Lazio",
  "udinese": "Udinese",
  "sassuolo": "Sassuolo",
  "torino": "Torino",
  "parma": "Parma",
  "genoa": "Genoa",
  "fiorentina": "Fiorentina",
  "cagliari": "Cagliari",
  "lecce": "Lecce",
  "cremonese": "Cremonese",
  "hellas_verona": "Verona",
  "pisa": "Pisa",
};


// ─── Helpers publics ──────────────────────────────────────────────

/**
 * Normalise un nom (lowercase, sans accents, espaces -> underscore).
 */
export const normalizeTeamName = (name: string): string => {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, "_");
};


/**
 * Convertit un nom API-Football vers le name_normalized DB.
 * Si l'equipe n'est pas dans la table d'exceptions, on tente la
 * normalisation standard.
 */
export const apiFootballToDbName = (apiName: string): string => {
  if (apiName in API_FOOTBALL_TO_DB) {
    return API_FOOTBALL_TO_DB[apiName];
  }
  return normalizeTeamName(apiName);
};


/**
 * Retourne le slug Understat d'une equipe a partir de son name_normalized DB.
 * Retourne null si l'equipe n'est pas couverte par Understat.
 */
export const getUnderstatSlug = (dbNormalizedName: string): string | null => {
  return DB_TO_UNDERSTAT[dbNormalizedName] ?? null;
};