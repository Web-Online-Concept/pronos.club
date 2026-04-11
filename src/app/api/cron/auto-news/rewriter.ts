// src/app/api/cron/auto-news/rewriter.ts
// Réécriture IA via Claude Haiku — angle betting/pronostics + traduction FR/EN/ES

import { FetchedArticle } from "./espn";

export interface RewrittenArticle {
  title: string;
  title_en: string;
  title_es: string;
  excerpt: string;
  excerpt_en: string;
  excerpt_es: string;
  content: string;
  content_en: string;
  content_es: string;
  tags: string[];
  meta_title: string;
  meta_description: string;
}

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

async function callHaiku(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
    signal: AbortSignal.timeout(55000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Haiku API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text || "";
}

function buildSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const SPORT_LABELS: Record<string, string> = {
  football: "Football",
  basketball: "Basketball",
  tennis: "Tennis",
  "football-americain": "Football Américain",
  baseball: "Baseball",
  hockey: "Hockey",
  mma: "MMA/UFC",
  golf: "Golf",
};

export async function rewriteArticle(article: FetchedArticle): Promise<RewrittenArticle & { slug: string }> {
  const sportLabel = SPORT_LABELS[article.sport] || article.sport;

  const systemPrompt = `Tu es rédacteur sportif pour PRONOS.CLUB. Réécris l'actu avec un angle paris sportifs.

RÈGLES :
- Réécrire complètement, JAMAIS copier la source
- Angle betting/pronostics quand pertinent
- HTML valide : <p>, <h2>, <h3>
- 2-4 paragraphes courts
- Ne JAMAIS inventer de cotes — rester factuel
- Ne JAMAIS mentionner ESPN

Réponds UNIQUEMENT en JSON valide, SANS backticks :
{"title":"FR max 80c","title_en":"EN max 80c","title_es":"ES max 80c","excerpt":"FR max 160c","excerpt_en":"EN max 160c","excerpt_es":"ES max 160c","content":"<p>FR HTML</p>","content_en":"<p>EN HTML</p>","content_es":"<p>ES HTML</p>","tags":["t1","t2"],"meta_title":"FR max 60c","meta_description":"FR max 155c"}`;

  const userPrompt = `Sport: ${sportLabel} | Ligue: ${article.league}
Titre: ${article.title}
${article.description}

JSON:`;

  const raw = await callHaiku(systemPrompt, userPrompt);

  const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`JSON parse failed: ${cleaned.slice(0, 200)}`);
  }

  const slug = buildSlug(parsed.title || article.title);

  return {
    slug,
    title: parsed.title || article.title,
    title_en: parsed.title_en || parsed.title || article.title,
    title_es: parsed.title_es || parsed.title || article.title,
    excerpt: parsed.excerpt || "",
    excerpt_en: parsed.excerpt_en || "",
    excerpt_es: parsed.excerpt_es || "",
    content: parsed.content || `<p>${article.description}</p>`,
    content_en: parsed.content_en || "",
    content_es: parsed.content_es || "",
    tags: parsed.tags || [article.sport],
    meta_title: parsed.meta_title || parsed.title || article.title,
    meta_description: parsed.meta_description || parsed.excerpt || "",
  };
}