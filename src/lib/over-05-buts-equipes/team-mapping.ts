// src/lib/over-05-buts-equipes/team-mapping.ts
//
// Mapping des noms d'equipes entre :
//  - API-Football  (ex: "Olympique Marseille")
//  - DB o05_teams  (ex: "Marseille")
//  - Understat slug (ex: "Marseille")
//  - Excel Bertrand (ex: "Marseille")
//
// Pour la Phase 3, on se concentre sur les 58 equipes des 3 championnats
// PROJET (L1, PL, La Liga). Le mapping Understat slug est essentiel car
// l'URL de scraping en depend.
//
// Convention Understat : nom de ville/club sans accents, espaces -> underscore.
// Quelques cas particuliers necessitent une table d'exceptions.

// ─── Mapping API-Football -> nom normalisé DB ──────────────────────

/**
 * Table de correspondance des noms API-Football vers nos noms DB.
 * API-Football utilise souvent des noms longs ("Olympique Marseille")
 * alors qu'on stocke des noms courts ("Marseille").
 *
 * Si une equipe n'est pas dans cette table, on tente la normalisation
 * standard (lowercase + sans accents + espaces -> underscore).
 */
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
};


// ─── Mapping DB -> slug Understat ──────────────────────────────────

/**
 * Slugs Understat pour les 58 equipes des 3 championnats PROJET.
 * URL pattern : https://understat.com/team/{slug}/{year}
 *
 * Pour rappel : Understat couvre les 5 grands championnats europeens.
 * Pour les championnats hors Top 5, ce mapping retournera null.
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