// src/app/api/news/route.ts
// API publique pour la page News — GET avec pagination et filtres

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");
  const sport = searchParams.get("sport");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "12");
  const offset = (page - 1) * limit;

  // Single article by slug
  if (slug) {
    const { data: article } = await supabaseAdmin
      .from("auto_news")
      .select("*")
      .eq("slug", slug)
      .eq("status", "published")
      .single();

    if (!article) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Increment view count (fire and forget)
    supabaseAdmin
      .from("auto_news")
      .update({ view_count: (article.view_count || 0) + 1 })
      .eq("id", article.id)
      .then(() => {});

    return NextResponse.json(article);
  }

  // List articles
  let query = supabaseAdmin
    .from("auto_news")
    .select("id, title, title_en, title_es, slug, excerpt, excerpt_en, excerpt_es, cover_image, sport, league, tags, view_count, published_at", { count: "exact" })
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (sport) {
    query = query.eq("sport", sport);
  }

  query = query.range(offset, offset + limit - 1);

  const { data: articles, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    articles: articles || [],
    total: count || 0,
    page,
    limit,
  });
}