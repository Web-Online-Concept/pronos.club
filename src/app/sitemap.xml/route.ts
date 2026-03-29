import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BASE_URL = "https://pronos.club";

export async function GET() {
  // Static pages
  const staticPages = [
    { path: "", priority: "1.0", changefreq: "daily" },
    { path: "/pronostics", priority: "0.9", changefreq: "daily" },
    { path: "/historique", priority: "0.8", changefreq: "daily" },
    { path: "/statistiques", priority: "0.8", changefreq: "daily" },
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

  const locales = ["fr", "en", "es"];
  const now = new Date().toISOString().split("T")[0];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
`;

  // Static pages for each locale
  for (const page of staticPages) {
    for (const locale of locales) {
      xml += `  <url>
    <loc>${BASE_URL}/${locale}${page.path}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
`;
      // Alternate language links
      for (const alt of locales) {
        xml += `    <xhtml:link rel="alternate" hreflang="${alt}" href="${BASE_URL}/${alt}${page.path}" />\n`;
      }
      xml += `  </url>\n`;
    }
  }

  // Blog posts
  if (posts) {
    for (const post of posts) {
      for (const locale of locales) {
        xml += `  <url>
    <loc>${BASE_URL}/${locale}/blog/${post.slug}</loc>
    <lastmod>${post.updated_at ? post.updated_at.split("T")[0] : now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
`;
        for (const alt of locales) {
          xml += `    <xhtml:link rel="alternate" hreflang="${alt}" href="${BASE_URL}/${alt}/blog/${post.slug}" />\n`;
        }
        xml += `  </url>\n`;
      }
    }
  }

  // Bilans
  if (bilans) {
    for (const bilan of bilans) {
      for (const locale of locales) {
        xml += `  <url>
    <loc>${BASE_URL}/${locale}/bilans/${bilan.slug}</loc>
    <lastmod>${bilan.updated_at ? bilan.updated_at.split("T")[0] : now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
`;
        for (const alt of locales) {
          xml += `    <xhtml:link rel="alternate" hreflang="${alt}" href="${BASE_URL}/${alt}/bilans/${bilan.slug}" />\n`;
        }
        xml += `  </url>\n`;
      }
    }
  }

  xml += `</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}