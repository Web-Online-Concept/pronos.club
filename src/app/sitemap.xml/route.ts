// src/app/sitemap.xml/route.ts
// Sitemap dynamique — pages statiques + blog + bilans + NEWS AUTO + PRONOS IA dossiers

import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BASE_URL = "https://pronos.club";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  // Static pages
  const staticPages = [
    { path: "", priority: "1.0", changefreq: "daily" },
    { path: "/pronostics", priority: "0.9", changefreq: "daily" },
    { path: "/historique", priority: "0.8", changefreq: "daily" },
    { path: "/statistiques", priority: "0.8", changefreq: "daily" },
    // PRONOS IA (4 pages)
    { path: "/pronos-ia", priority: "0.9", changefreq: "daily" },
    { path: "/pronos-ia/comment-ca-marche", priority: "0.6", changefreq: "monthly" },
    { path: "/pronos-ia/stats", priority: "0.7", changefreq: "daily" },
    { path: "/pronos-ia/historique", priority: "0.7", changefreq: "daily" },
    { path: "/bilans", priority: "0.7", changefreq: "monthly" },
    { path: "/tipster", priority: "0.7", changefreq: "monthly" },
    { path: "/bookmakers", priority: "0.7", changefreq: "monthly" },
    { path: "/bookmakers/1xbet", priority: "0.6", changefreq: "monthly" },
    { path: "/bookmakers/stake", priority: "0.6", changefreq: "monthly" },
    { path: "/bookmakers/ps3838", priority: "0.6", changefreq: "monthly" },
    { path: "/bookmakers/winamax", priority: "0.6", changefreq: "monthly" },
    { path: "/bookmakers/betclic", priority: "0.6", changefreq: "monthly" },
    { path: "/bookmakers/unibet", priority: "0.6", changefreq: "monthly" },
    { path: "/blog", priority: "0.8", changefreq: "daily" },
    { path: "/news", priority: "0.8", changefreq: "hourly" },
    { path: "/videos", priority: "0.7", changefreq: "daily" },
    { path: "/livescore", priority: "0.8", changefreq: "daily" },
    { path: "/stats-sports", priority: "0.7", changefreq: "daily" },
    { path: "/coupe-du-monde", priority: "0.9", changefreq: "daily" },
    { path: "/abonnement", priority: "0.7", changefreq: "monthly" },
    { path: "/contact", priority: "0.4", changefreq: "yearly" },
    { path: "/mentions-legales", priority: "0.2", changefreq: "yearly" },
    { path: "/cgu", priority: "0.2", changefreq: "yearly" },
    { path: "/cgv", priority: "0.2", changefreq: "yearly" },
    { path: "/confidentialite", priority: "0.2", changefreq: "yearly" },
    { path: "/jeu-responsable", priority: "0.3", changefreq: "yearly" },
  ];

  // Blog posts
  const { data: posts } = await supabaseAdmin
    .from("blog_posts")
    .select("slug, updated_at")
    .eq("status", "published")
    .order("published_at", { ascending: false });

  // Bilans
  const { data: bilans } = await supabaseAdmin
    .from("bilans")
    .select("slug, updated_at")
    .eq("is_published", true);

  // Auto News
  const { data: newsArticles } = await supabaseAdmin
    .from("auto_news")
    .select("slug, updated_at")
    .eq("status", "published")
    .order("published_at", { ascending: false });

  // Pronos IA — dossiers pick individuels (1 page SEO par pick)
  // On filtre dossier_status="ready" uniquement : seules ces pages ont du contenu réel
  const { data: aiPicksDossiers } = await supabaseAdmin
    .from("ai_picks")
    .select("slug, event_date, updated_at")
    .not("slug", "is", null)
    .is("deleted_at", null)
    .eq("dossier_status", "ready")
    .order("event_date", { ascending: false })
    .limit(500); // cap à 500 pour ne pas exploser le sitemap

  const locales = ["fr", "en", "es"];
  const now = new Date().toISOString().split("T")[0];

  const urls: string[] = [];

  // Static pages for each locale
  for (const page of staticPages) {
    for (const locale of locales) {
      const alternates = locales
        .map(
          (alt) =>
            `    <xhtml:link rel="alternate" hreflang="${alt}" href="${BASE_URL}/${alt}${page.path}" />`
        )
        .join("\n");

      urls.push(`  <url>
    <loc>${BASE_URL}/${locale}${page.path}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
${alternates}
  </url>`);
    }
  }

  // Blog posts
  if (posts) {
    for (const post of posts) {
      for (const locale of locales) {
        const alternates = locales
          .map(
            (alt) =>
              `    <xhtml:link rel="alternate" hreflang="${alt}" href="${BASE_URL}/${alt}/blog/${post.slug}" />`
          )
          .join("\n");

        urls.push(`  <url>
    <loc>${BASE_URL}/${locale}/blog/${post.slug}</loc>
    <lastmod>${post.updated_at ? post.updated_at.split("T")[0] : now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
${alternates}
  </url>`);
      }
    }
  }

  // Bilans
  if (bilans) {
    for (const bilan of bilans) {
      for (const locale of locales) {
        const alternates = locales
          .map(
            (alt) =>
              `    <xhtml:link rel="alternate" hreflang="${alt}" href="${BASE_URL}/${alt}/bilans/${bilan.slug}" />`
          )
          .join("\n");

        urls.push(`  <url>
    <loc>${BASE_URL}/${locale}/bilans/${bilan.slug}</loc>
    <lastmod>${bilan.updated_at ? bilan.updated_at.split("T")[0] : now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
${alternates}
  </url>`);
      }
    }
  }

  // Auto News
  if (newsArticles) {
    for (const news of newsArticles) {
      for (const locale of locales) {
        const alternates = locales
          .map(
            (alt) =>
              `    <xhtml:link rel="alternate" hreflang="${alt}" href="${BASE_URL}/${alt}/news/${news.slug}" />`
          )
          .join("\n");

        urls.push(`  <url>
    <loc>${BASE_URL}/${locale}/news/${news.slug}</loc>
    <lastmod>${news.updated_at ? news.updated_at.split("T")[0] : now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.6</priority>
${alternates}
  </url>`);
      }
    }
  }

  // Pronos IA — 1 URL par pick dossier, pour chaque locale
  // Priority 0.8 si récent (< 30 jours), 0.6 sinon
  // changefreq "daily" tant que le match n'est pas résolu, "weekly" après
  if (aiPicksDossiers) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    for (const pick of aiPicksDossiers) {
      if (!pick.slug) continue;

      const pickDate = pick.event_date ? new Date(pick.event_date) : null;
      const isRecent = pickDate && pickDate > thirtyDaysAgo;
      const priority = isRecent ? "0.8" : "0.6";
      const changefreq = isRecent ? "daily" : "weekly";
      const lastmod = pick.updated_at
        ? pick.updated_at.split("T")[0]
        : pick.event_date
          ? pick.event_date.split("T")[0]
          : now;

      for (const locale of locales) {
        const alternates = locales
          .map(
            (alt) =>
              `    <xhtml:link rel="alternate" hreflang="${alt}" href="${BASE_URL}/${alt}/pronos-ia/match/${pick.slug}" />`
          )
          .join("\n");

        urls.push(`  <url>
    <loc>${BASE_URL}/${locale}/pronos-ia/match/${pick.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
${alternates}
  </url>`);
      }
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join("\n")}
</urlset>`;

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}