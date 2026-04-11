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
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
    signal: AbortSignal.timeout(30000),
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
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
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

  const systemPrompt = `Tu es un rédacteur sportif expert en paris sportifs pour PRONOS.CLUB. 
Tu réécris des actualités sportives avec un angle betting/pronostics.

RÈGLES STRICTES :
- Réécrire complètement l'article, JAMAIS copier le texte source
- Ajouter un angle paris sportifs / pronostics / cotes / value bet quand pertinent
- Ton professionnel mais accessible, engageant pour des parieurs
- Le contenu doit être en HTML valide (paragraphes <p>, titres <h2>/<h3>, listes <ul>/<li> si pertinent)
- Minimum 3 paragraphes, maximum 6 paragraphes
- Ne JAMAIS inventer de cotes ou résultats — rester factuel
- Ne JAMAIS mentionner la source (ESPN)

FORMAT DE RÉPONSE — JSON strict, rien d'autre :
{
  "title": "Titre FR accrocheur (max 80 car.)",
  "title_en": "English title (max 80 chars)",
  "title_es": "Título en español (max 80 car.)",
  "excerpt": "Résumé FR 1-2 phrases (max 160 car.)",
  "excerpt_en": "English summary (max 160 chars)",
  "excerpt_es": "Resumen en español (max 160 car.)",
  "content": "<p>Contenu FR complet en HTML...</p>",
  "content_en": "<p>Full English content in HTML...</p>",
  "content_es": "<p>Contenido completo en español HTML...</p>",
  "tags": ["tag1", "tag2", "tag3"],
  "meta_title": "Meta titre SEO FR (max 60 car.)",
  "meta_description": "Meta description SEO FR (max 155 car.)"
}`;

  const userPrompt = `Sport : ${sportLabel}
Ligue : ${article.league}
Titre original : ${article.title}
Description : ${article.description}

Réécris cet article en 3 langues (FR, EN, ES) avec un angle paris sportifs. Réponds UNIQUEMENT en JSON valide.`;

  const raw = await callHaiku(systemPrompt, userPrompt);

  // Parse JSON — nettoyer les éventuels backticks markdown
  const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`Failed to parse Haiku response: ${cleaned.slice(0, 200)}`);
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