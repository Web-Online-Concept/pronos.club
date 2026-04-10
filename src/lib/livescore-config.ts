// src/lib/livescore-config.ts
// Configuration complète de tous les sports et ligues ESPN

export interface LeagueConfig {
  slug: string;        // ESPN league slug
  name: string;        // Display name
  flag?: string;       // Country flag emoji
  country?: string;    // Country name for display
  priority: number;    // Sort order (lower = higher priority)
}

export interface SportConfig {
  key: string;
  name: string;
  icon: string;
  espnSport: string;   // ESPN sport path
  leagues: LeagueConfig[];
}

export const SPORTS_CONFIG: SportConfig[] = [
  {
    key: "football",
    name: "Football",
    icon: "⚽",
    espnSport: "soccer",
    leagues: [
      { slug: "fra.1", name: "Ligue 1", flag: "fr", country: "FRANCE", priority: 1 },
      { slug: "eng.1", name: "Premier League", flag: "gb-eng", country: "ANGLETERRE", priority: 2 },
      { slug: "esp.1", name: "La Liga", flag: "es", country: "ESPAGNE", priority: 3 },
      { slug: "ger.1", name: "Bundesliga", flag: "de", country: "ALLEMAGNE", priority: 4 },
      { slug: "ita.1", name: "Serie A", flag: "it", country: "ITALIE", priority: 5 },
      { slug: "uefa.champions", name: "Champions League", flag: "eu", country: "EUROPE", priority: 6 },
      { slug: "uefa.europa", name: "Europa League", flag: "eu", country: "EUROPE", priority: 7 },
      { slug: "uefa.europa.conf", name: "Conference League", flag: "eu", country: "EUROPE", priority: 8 },
      { slug: "fra.2", name: "Ligue 2", flag: "fr", country: "FRANCE", priority: 9 },
      { slug: "eng.2", name: "Championship", flag: "gb-eng", country: "ANGLETERRE", priority: 10 },
      { slug: "ned.1", name: "Eredivisie", flag: "nl", country: "PAYS-BAS", priority: 11 },
      { slug: "por.1", name: "Liga Portugal", flag: "pt", country: "PORTUGAL", priority: 12 },
      { slug: "tur.1", name: "Süper Lig", flag: "tr", country: "TURQUIE", priority: 13 },
      { slug: "bel.1", name: "Pro League", flag: "be", country: "BELGIQUE", priority: 14 },
      { slug: "sco.1", name: "Premiership", flag: "gb-sct", country: "ÉCOSSE", priority: 15 },
      { slug: "usa.1", name: "MLS", flag: "us", country: "USA", priority: 16 },
      { slug: "bra.1", name: "Brasileirão", flag: "br", country: "BRÉSIL", priority: 17 },
      { slug: "arg.1", name: "Liga Argentina", flag: "ar", country: "ARGENTINE", priority: 18 },
      { slug: "mex.1", name: "Liga MX", flag: "mx", country: "MEXIQUE", priority: 19 },
      { slug: "aus.1", name: "A-League", flag: "au", country: "AUSTRALIE", priority: 20 },
      { slug: "jpn.1", name: "J1 League", flag: "jp", country: "JAPON", priority: 21 },
      { slug: "sui.1", name: "Super League", flag: "ch", country: "SUISSE", priority: 22 },
      { slug: "aut.1", name: "Bundesliga AT", flag: "at", country: "AUTRICHE", priority: 23 },
      { slug: "gre.1", name: "Super League GR", flag: "gr", country: "GRÈCE", priority: 24 },
      { slug: "den.1", name: "Superliga", flag: "dk", country: "DANEMARK", priority: 25 },
      { slug: "nor.1", name: "Eliteserien", flag: "no", country: "NORVÈGE", priority: 26 },
      { slug: "swe.1", name: "Allsvenskan", flag: "se", country: "SUÈDE", priority: 27 },
      { slug: "pol.1", name: "Ekstraklasa", flag: "pl", country: "POLOGNE", priority: 28 },
      { slug: "fin.1", name: "Veikkausliiga", flag: "fi", country: "FINLANDE", priority: 29 },
      { slug: "rus.1", name: "Premier League RU", flag: "ru", country: "RUSSIE", priority: 30 },
      { slug: "cze.1", name: "Chance Liga", flag: "cz", country: "TCHÉQUIE", priority: 31 },
      { slug: "rou.1", name: "SuperLiga", flag: "ro", country: "ROUMANIE", priority: 32 },
      { slug: "isr.1", name: "Ligat Ha'Al", flag: "il", country: "ISRAËL", priority: 33 },
      { slug: "cyp.1", name: "First Division", flag: "cy", country: "CHYPRE", priority: 34 },
      { slug: "irl.1", name: "Premier Division", flag: "ie", country: "IRLANDE", priority: 35 },
      { slug: "col.1", name: "Liga BetPlay", flag: "co", country: "COLOMBIE", priority: 36 },
      { slug: "chi.1", name: "Primera División", flag: "cl", country: "CHILI", priority: 37 },
      { slug: "per.1", name: "Liga 1", flag: "pe", country: "PÉROU", priority: 38 },
      { slug: "ecu.1", name: "Liga Pro", flag: "ec", country: "ÉQUATEUR", priority: 39 },
      { slug: "uru.1", name: "Primera División", flag: "uy", country: "URUGUAY", priority: 40 },
      { slug: "par.1", name: "División de Honor", flag: "py", country: "PARAGUAY", priority: 41 },
      { slug: "chn.1", name: "Chinese Super League", flag: "cn", country: "CHINE", priority: 42 },
      { slug: "ind.1", name: "Indian Super League", flag: "in", country: "INDE", priority: 43 },
      { slug: "ksa.1", name: "Saudi Pro League", flag: "sa", country: "ARABIE SAOUDITE", priority: 44 },
      { slug: "rsa.1", name: "Betway Premiership", flag: "za", country: "AFRIQUE DU SUD", priority: 45 },
    ],
  },
  {
    key: "tennis",
    name: "Tennis",
    icon: "🎾",
    espnSport: "tennis",
    leagues: [
      { slug: "atp", name: "ATP", priority: 1 },
      { slug: "wta", name: "WTA", priority: 2 },
    ],
  },
  {
    key: "basketball",
    name: "Basketball",
    icon: "🏀",
    espnSport: "basketball",
    leagues: [
      { slug: "nba", name: "NBA", flag: "us", country: "USA", priority: 1 },
      { slug: "wnba", name: "WNBA", flag: "us", country: "USA", priority: 2 },
      { slug: "mens-college-basketball", name: "NCAA", flag: "us", country: "USA", priority: 3 },
    ],
  },
  {
    key: "hockey",
    name: "Hockey",
    icon: "🏒",
    espnSport: "hockey",
    leagues: [
      { slug: "nhl", name: "NHL", flag: "us", country: "USA", priority: 1 },
    ],
  },
  {
    key: "baseball",
    name: "Baseball",
    icon: "⚾",
    espnSport: "baseball",
    leagues: [
      { slug: "mlb", name: "MLB", flag: "us", country: "USA", priority: 1 },
    ],
  },
  {
    key: "football-us",
    name: "Football US",
    icon: "🏈",
    espnSport: "football",
    leagues: [
      { slug: "nfl", name: "NFL", flag: "us", country: "USA", priority: 1 },
      { slug: "college-football", name: "NCAA Football", flag: "us", country: "USA", priority: 2 },
    ],
  },
];

// Helper: build ESPN scoreboard URL
export function buildScoreboardUrl(espnSport: string, leagueSlug: string, date?: string): string {
  const base = `https://site.api.espn.com/apis/site/v2/sports/${espnSport}/${leagueSlug}/scoreboard`;
  if (date) return `${base}?dates=${date}`;
  return base;
}