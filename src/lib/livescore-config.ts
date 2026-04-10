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
      { slug: "fra.1", name: "Ligue 1", flag: "🇫🇷", country: "FRANCE", priority: 1 },
      { slug: "eng.1", name: "Premier League", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", country: "ANGLETERRE", priority: 2 },
      { slug: "esp.1", name: "La Liga", flag: "🇪🇸", country: "ESPAGNE", priority: 3 },
      { slug: "ger.1", name: "Bundesliga", flag: "🇩🇪", country: "ALLEMAGNE", priority: 4 },
      { slug: "ita.1", name: "Serie A", flag: "🇮🇹", country: "ITALIE", priority: 5 },
      { slug: "uefa.champions", name: "Champions League", flag: "🏆", country: "EUROPE", priority: 6 },
      { slug: "uefa.europa", name: "Europa League", flag: "🏆", country: "EUROPE", priority: 7 },
      { slug: "uefa.europa.conf", name: "Conference League", flag: "🏆", country: "EUROPE", priority: 8 },
      { slug: "fra.2", name: "Ligue 2", flag: "🇫🇷", country: "FRANCE", priority: 9 },
      { slug: "eng.2", name: "Championship", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", country: "ANGLETERRE", priority: 10 },
      { slug: "ned.1", name: "Eredivisie", flag: "🇳🇱", country: "PAYS-BAS", priority: 11 },
      { slug: "por.1", name: "Liga Portugal", flag: "🇵🇹", country: "PORTUGAL", priority: 12 },
      { slug: "tur.1", name: "Süper Lig", flag: "🇹🇷", country: "TURQUIE", priority: 13 },
      { slug: "bel.1", name: "Pro League", flag: "🇧🇪", country: "BELGIQUE", priority: 14 },
      { slug: "sco.1", name: "Premiership", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", country: "ÉCOSSE", priority: 15 },
      { slug: "usa.1", name: "MLS", flag: "🇺🇸", country: "USA", priority: 16 },
      { slug: "bra.1", name: "Brasileirão", flag: "🇧🇷", country: "BRÉSIL", priority: 17 },
      { slug: "arg.1", name: "Liga Argentina", flag: "🇦🇷", country: "ARGENTINE", priority: 18 },
      { slug: "mex.1", name: "Liga MX", flag: "🇲🇽", country: "MEXIQUE", priority: 19 },
      { slug: "aus.1", name: "A-League", flag: "🇦🇺", country: "AUSTRALIE", priority: 20 },
      { slug: "jpn.1", name: "J1 League", flag: "🇯🇵", country: "JAPON", priority: 21 },
      { slug: "sui.1", name: "Super League", flag: "🇨🇭", country: "SUISSE", priority: 22 },
      { slug: "aut.1", name: "Bundesliga AT", flag: "🇦🇹", country: "AUTRICHE", priority: 23 },
      { slug: "gre.1", name: "Super League GR", flag: "🇬🇷", country: "GRÈCE", priority: 24 },
      { slug: "den.1", name: "Superliga", flag: "🇩🇰", country: "DANEMARK", priority: 25 },
      { slug: "nor.1", name: "Eliteserien", flag: "🇳🇴", country: "NORVÈGE", priority: 26 },
      { slug: "swe.1", name: "Allsvenskan", flag: "🇸🇪", country: "SUÈDE", priority: 27 },
      { slug: "pol.1", name: "Ekstraklasa", flag: "🇵🇱", country: "POLOGNE", priority: 28 },
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
      { slug: "nba", name: "NBA", flag: "🇺🇸", country: "USA", priority: 1 },
      { slug: "wnba", name: "WNBA", flag: "🇺🇸", country: "USA", priority: 2 },
      { slug: "mens-college-basketball", name: "NCAA", flag: "🇺🇸", country: "USA", priority: 3 },
    ],
  },
  {
    key: "hockey",
    name: "Hockey",
    icon: "🏒",
    espnSport: "hockey",
    leagues: [
      { slug: "nhl", name: "NHL", flag: "🇺🇸", country: "USA", priority: 1 },
    ],
  },
  {
    key: "baseball",
    name: "Baseball",
    icon: "⚾",
    espnSport: "baseball",
    leagues: [
      { slug: "mlb", name: "MLB", flag: "🇺🇸", country: "USA", priority: 1 },
    ],
  },
  {
    key: "football-us",
    name: "Football US",
    icon: "🏈",
    espnSport: "football",
    leagues: [
      { slug: "nfl", name: "NFL", flag: "🇺🇸", country: "USA", priority: 1 },
      { slug: "college-football", name: "NCAA Football", flag: "🇺🇸", country: "USA", priority: 2 },
    ],
  },
];

// Helper: build ESPN scoreboard URL
export function buildScoreboardUrl(espnSport: string, leagueSlug: string, date?: string): string {
  const base = `https://site.api.espn.com/apis/site/v2/sports/${espnSport}/${leagueSlug}/scoreboard`;
  if (date) return `${base}?dates=${date}`;
  return base;
}