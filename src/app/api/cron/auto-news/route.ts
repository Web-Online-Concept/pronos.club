// src/app/api/cron/auto-news/route.ts
// CRON Vercel — Système News Automatique PRONOS.CLUB
// Fréquence : toutes les heures
// Flow : ESPN fetch → déduplique → Haiku rewrite 3 langues → INSERT auto_news

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchESPNNews } from "./espn";
import { rewriteArticle } from "./rewriter";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Permet jusqu'à 300s sur Vercel Pro (60s sur Hobby)
export const maxDuration = 300;

// Sécurité CRON Vercel
function verifyCron(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) return true;
  const url = new URL(request.url);
  if (url.searchParams.get("secret") === process.env.CRON_SECRET) return true;
  return false;
}

export async function GET(request: Request) {
  if (!verifyCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const results = { fetched: 0, skipped: 0, published: 0, errors: 0, details: [] as string[] };

  try {
    // 1. Fetch ESPN News (max 2 par source pour limiter)
    const articles = await fetchESPNNews(2);
    results.fetched = articles.length;

    if (articles.length === 0) {
      return NextResponse.json({ ...results, message: "No articles fetched" });
    }

    // 2. Déduplique
    const sourceIds = articles.map((a) => a.sourceId);
    const { data: existing } = await supabaseAdmin
      .from("auto_news")
      .select("source_id")
      .in("source_id", sourceIds);

    const existingIds = new Set((existing || []).map((e) => e.source_id));
    const newArticles = articles.filter((a) => !existingIds.has(a.sourceId));
    results.skipped = articles.length - newArticles.length;

    if (newArticles.length === 0) {
      return NextResponse.json({ ...results, message: "All articles already exist" });
    }

    // 3. Max 2 articles par exécution (séquentiel pour éviter rate limit + timeout)
    const toProcess = newArticles.slice(0, 2);

    for (const article of toProcess) {
      try {
        // Vérifier qu'on n'a pas dépassé 250s
        if (Date.now() - startTime > 250000) {
          results.details.push("Stopped: approaching timeout limit");
          break;
        }

        const rewritten = await rewriteArticle(article);

        // Slug unique
        const { data: slugExists } = await supabaseAdmin
          .from("auto_news")
          .select("id")
          .eq("slug", rewritten.slug)
          .maybeSingle();

        const finalSlug = slugExists
          ? `${rewritten.slug}-${Date.now().toString(36)}`
          : rewritten.slug;

        const { error: insertError } = await supabaseAdmin.from("auto_news").insert({
          title: rewritten.title,
          title_en: rewritten.title_en,
          title_es: rewritten.title_es,
          slug: finalSlug,
          excerpt: rewritten.excerpt,
          excerpt_en: rewritten.excerpt_en,
          excerpt_es: rewritten.excerpt_es,
          content: rewritten.content,
          content_en: rewritten.content_en,
          content_es: rewritten.content_es,
          cover_image: article.imageUrl,
          sport: article.sport,
          league: article.league,
          tags: rewritten.tags,
          source_id: article.sourceId,
          source_url: article.sourceUrl,
          source_name: "ESPN",
          meta_title: rewritten.meta_title,
          meta_description: rewritten.meta_description,
          status: "published",
          published_at: new Date().toISOString(),
        });

        if (insertError) {
          results.errors++;
          results.details.push(`INSERT error [${article.sourceId}]: ${insertError.message}`);
        } else {
          results.published++;
          results.details.push(`OK: ${rewritten.title} (${article.sport}/${article.league})`);
        }
      } catch (err: any) {
        results.errors++;
        results.details.push(`Error [${article.sourceId}]: ${err.message}`);
      }
    }

    const elapsed = Date.now() - startTime;
    return NextResponse.json({ ...results, elapsed_ms: elapsed });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, ...results }, { status: 500 });
  }
}