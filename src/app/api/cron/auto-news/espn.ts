// src/app/api/cron/auto-news/espn.ts
// Fetch ESPN News pour tous les sports configurés

export interface ESPNArticle {
  id: string;
  headline: string;
  description: string;
  published: string;
  linkText?: string;
  links?: { web?: { href?: string } };
  images?: { url: string; caption?: string; width?: number; height?: number }[];
  categories?: { description?: string; type?: string; sportId?: string; leagueId?: string }[];
}

export interface FetchedArticle {
  sourceId: string;
  title: string;
  description: string;
  sourceUrl: string;
  imageUrl: string | null;
  sport: string;
  league: string;
  publishedAt: string;
}

// Toutes les sources ESPN News
const ESPN_SOURCES: { sport: string; league: string; endpoint: string }[] = [
  // Football
  { sport: "football", league: "ligue-1", endpoint: "soccer/fra.1/news" },
  { sport: "football", league: "premier-league", endpoint: "soccer/eng.1/news" },
  { sport: "football", league: "la-liga", endpoint: "soccer/esp.1/news" },
  { sport: "football", league: "serie-a", endpoint: "soccer/ita.1/news" },
  { sport: "football", league: "bundesliga", endpoint: "soccer/ger.1/news" },
  { sport: "football", league: "champions-league", endpoint: "soccer/uefa.champions/news" },
  { sport: "football", league: "europa-league", endpoint: "soccer/uefa.europa/news" },
  // Basketball
  { sport: "basketball", league: "nba", endpoint: "basketball/nba/news" },
  { sport: "basketball", league: "euroleague", endpoint: "basketball/eur.euroliga/news" },
  // Tennis
  { sport: "tennis", league: "atp", endpoint: "tennis/news" },
  // Football américain
  { sport: "football-americain", league: "nfl", endpoint: "football/nfl/news" },
  // Baseball
  { sport: "baseball", league: "mlb", endpoint: "baseball/mlb/news" },
  // Hockey
  { sport: "hockey", league: "nhl", endpoint: "hockey/nhl/news" },
  // MMA
  { sport: "mma", league: "ufc", endpoint: "mma/news" },
  // Golf
  { sport: "golf", league: "pga", endpoint: "golf/news" },
];

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports";

export async function fetchESPNNews(maxPerSource: number = 3): Promise<FetchedArticle[]> {
  const allArticles: FetchedArticle[] = [];

  for (const source of ESPN_SOURCES) {
    try {
      const res = await fetch(`${ESPN_BASE}/${source.endpoint}?limit=${maxPerSource}`, {
        headers: { "User-Agent": "PRONOS.CLUB/1.0" },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) continue;

      const data = await res.json();
      const articles: ESPNArticle[] = data.articles || [];

      for (const article of articles.slice(0, maxPerSource)) {
        // Prendre la meilleure image disponible
        const image = article.images?.find((img) => img.width && img.width >= 600)
          || article.images?.[0]
          || null;

        allArticles.push({
          sourceId: `espn-${article.id}`,
          title: article.headline,
          description: article.description || "",
          sourceUrl: article.links?.web?.href || "",
          imageUrl: image?.url || null,
          sport: source.sport,
          league: source.league,
          publishedAt: article.published || new Date().toISOString(),
        });
      }
    } catch (err) {
      // Skip cette source si timeout ou erreur
      console.error(`[auto-news] ESPN fetch error for ${source.sport}/${source.league}:`, err);
    }
  }

  return allArticles;
}