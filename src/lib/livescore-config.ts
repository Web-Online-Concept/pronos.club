// src/lib/livescore-config.ts
// Configuration complète de tous les sports et ligues ESPN

export interface LeagueConfig {
  slug: string;        // ESPN league slug
  name: string;        // Display name
  flag?: string;       // Country flag emoji
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
      { slug: "fra.1", name: "Ligue 1", flag: "🇫🇷", priority: 1 },
      { slug: "eng.1", name: "Premier League", flag: "🏴", priority: 2 },
      { slug: "esp.1", name: "La Liga", flag: "🇪🇸", priority: 3 },
      { slug: "ger.1", name: "Bundesliga", flag: "🇩🇪", priority: 4 },
      { slug: "ita.1", name: "Serie A", flag: "🇮🇹", priority: 5 },
      { slug: "uefa.champions", name: "Champions League", flag: "🏆", priority: 6 },
      { slug: "uefa.europa", name: "Europa League", flag: "🏆", priority: 7 },
      { slug: "uefa.europa.conf", name: "Conference League", flag: "🏆", priority: 8 },
      { slug: "fra.2", name: "Ligue 2", flag: "🇫🇷", priority: 9 },
      { slug: "eng.2", name: "Championship", flag: "🏴", priority: 10 },
      { slug: "ned.1", name: "Eredivisie", flag: "🇳🇱", priority: 11 },
      { slug: "por.1", name: "Liga Portugal", flag: "🇵🇹", priority: 12 },
      { slug: "tur.1", name: "Süper Lig", flag: "🇹🇷", priority: 13 },
      { slug: "bel.1", name: "Pro League", flag: "🇧🇪", priority: 14 },
      { slug: "sco.1", name: "Premiership", flag: "🏴", priority: 15 },
      { slug: "usa.1", name: "MLS", flag: "🇺🇸", priority: 16 },
      { slug: "bra.1", name: "Brasileirão", flag: "🇧🇷", priority: 17 },
      { slug: "arg.1", name: "Liga Argentina", flag: "🇦🇷", priority: 18 },
      { slug: "mex.1", name: "Liga MX", flag: "🇲🇽", priority: 19 },
      { slug: "aus.1", name: "A-League", flag: "🇦🇺", priority: 20 },
      { slug: "jpn.1", name: "J1 League", flag: "🇯🇵", priority: 21 },
      { slug: "chn.1", name: "Chinese Super League", flag: "🇨🇳", priority: 22 },
      { slug: "rus.1", name: "Russian Premier", flag: "🇷🇺", priority: 23 },
      { slug: "sui.1", name: "Super League", flag: "🇨🇭", priority: 24 },
      { slug: "aut.1", name: "Bundesliga AT", flag: "🇦🇹", priority: 25 },
      { slug: "gre.1", name: "Super League GR", flag: "🇬🇷", priority: 26 },
      { slug: "den.1", name: "Superliga", flag: "🇩🇰", priority: 27 },
      { slug: "nor.1", name: "Eliteserien", flag: "🇳🇴", priority: 28 },
      { slug: "swe.1", name: "Allsvenskan", flag: "🇸🇪", priority: 29 },
      { slug: "pol.1", name: "Ekstraklasa", flag: "🇵🇱", priority: 30 },
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
      { slug: "nba", name: "NBA", flag: "🇺🇸", priority: 1 },
      { slug: "wnba", name: "WNBA", flag: "🇺🇸", priority: 2 },
      { slug: "mens-college-basketball", name: "NCAA", flag: "🇺🇸", priority: 3 },
    ],
  },
  {
    key: "hockey",
    name: "Hockey",
    icon: "🏒",
    espnSport: "hockey",
    leagues: [
      { slug: "nhl", name: "NHL", flag: "🇺🇸", priority: 1 },
    ],
  },
  {
    key: "baseball",
    name: "Baseball",
    icon: "⚾",
    espnSport: "baseball",
    leagues: [
      { slug: "mlb", name: "MLB", flag: "🇺🇸", priority: 1 },
    ],
  },
  {
    key: "football-us",
    name: "Football US",
    icon: "🏈",
    espnSport: "football",
    leagues: [
      { slug: "nfl", name: "NFL", flag: "🇺🇸", priority: 1 },
      { slug: "college-football", name: "NCAA Football", flag: "🇺🇸", priority: 2 },
    ],
  },
  {
    key: "mma",
    name: "MMA",
    icon: "🥊",
    espnSport: "mma",
    leagues: [
      { slug: "ufc", name: "UFC", priority: 1 },
    ],
  },
];

// Helper: build ESPN scoreboard URL
export function buildScoreboardUrl(espnSport: string, leagueSlug: string, date?: string): string {
  const base = `https://site.api.espn.com/apis/site/v2/sports/${espnSport}/${leagueSlug}/scoreboard`;
  if (date) return `${base}?dates=${date}`;
  return base;
}