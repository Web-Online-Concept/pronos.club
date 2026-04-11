// src/app/[locale]/(public)/news/[slug]/page.tsx
// Page article News individuel — design cohérent avec blog/[slug]

import Link from "next/link";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { getTranslations } from "next-intl/server";
import { localized } from "@/lib/blog-i18n";
import { ogImageUrl } from "@/lib/seo";

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const SPORT_ICONS: Record<string, string> = {
  football: "⚽", basketball: "🏀", tennis: "🎾", "football-americain": "🏈",
  baseball: "⚾", hockey: "🏒", mma: "🥊", golf: "⛳",
};

const SPORT_LABELS: Record<string, Record<string, string>> = {
  fr: { football: "Football", basketball: "Basketball", tennis: "Tennis", "football-americain": "Football US", baseball: "Baseball", hockey: "Hockey", mma: "MMA", golf: "Golf" },
  en: { football: "Soccer", basketball: "Basketball", tennis: "Tennis", "football-americain": "NFL", baseball: "Baseball", hockey: "Hockey", mma: "MMA", golf: "Golf" },
  es: { football: "Fútbol", basketball: "Baloncesto", tennis: "Tenis", "football-americain": "Fútbol Americano", baseball: "Béisbol", hockey: "Hockey", mma: "MMA", golf: "Golf" },
};

const SPORT_COLORS: Record<string, string> = {
  football: "#10b981", basketball: "#f59e0b", tennis: "#8b5cf6", "football-americain": "#ef4444",
  baseball: "#3b82f6", hockey: "#06b6d4", mma: "#dc2626", golf: "#22c55e",
};

function getSportLabel(sport: string, locale: string) {
  return SPORT_LABELS[locale]?.[sport] || SPORT_LABELS.fr[sport] || sport;
}

async function getArticle(slug: string) {
  const { data } = await supabaseAdmin
    .from("auto_news")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .single();
  if (!data) return null;
  // Increment views (fire & forget)
  supabaseAdmin.from("auto_news").update({ view_count: (data.view_count || 0) + 1 }).eq("id", data.id).then(() => {});
  return data;
}

async function getRelated(sport: string, currentSlug: string) {
  const { data } = await supabaseAdmin
    .from("auto_news")
    .select("id, title, title_en, title_es, slug, cover_image, sport, published_at")
    .eq("status", "published")
    .eq("sport", sport)
    .neq("slug", currentSlug)
    .order("published_at", { ascending: false })
    .limit(3);
  return data || [];
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const article = await getArticle(slug);
  if (!article) return { title: "Not found" };

  const title = localized(article, "title", locale);
  const description = localized(article, "excerpt", locale) || "";
  const sportLabel = getSportLabel(article.sport, locale);

  const image = ogImageUrl({
    title,
    subtitle: `${SPORT_ICONS[article.sport] || "🏅"} ${sportLabel} — PRONOS.CLUB`,
    cover: article.cover_image || undefined,
  });

  return {
    title: `${title} — PRONOS.CLUB`,
    description,
    openGraph: {
      title, description,
      images: [{ url: image, width: 1200, height: 630 }],
      type: "article",
      publishedTime: article.published_at,
      siteName: "PRONOS.CLUB",
    },
    twitter: {
      card: "summary_large_image",
      site: "@pronos_club_",
      title, description,
      images: [image],
    },
  };
}

export default async function NewsArticlePage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const article = await getArticle(slug);
  if (!article) notFound();

  const related = await getRelated(article.sport, article.slug);
  const dateFmt = locale === "es" ? "es-ES" : locale === "en" ? "en-US" : "fr-FR";
  const fmt = (d: string) => new Date(d).toLocaleDateString(dateFmt, { day: "numeric", month: "long", year: "numeric" });
  const articleUrl = `https://pronos.club/${locale}/news/${article.slug}`;

  const articleTitle = localized(article, "title", locale);
  const articleContent = localized(article, "content", locale);
  const articleExcerpt = localized(article, "excerpt", locale);
  const sportLabel = getSportLabel(article.sport, locale);
  const sportIcon = SPORT_ICONS[article.sport] || "🏅";
  const sportColor = SPORT_COLORS[article.sport] || "#10b981";

  const viewLabel: Record<string, [string, string]> = {
    fr: ["vue", "vues"], en: ["view", "views"], es: ["vista", "vistas"],
  };
  const shareLabel: Record<string, string> = { fr: "Partager", en: "Share", es: "Compartir" };
  const relatedLabel: Record<string, string> = { fr: "Articles similaires", en: "Related articles", es: "Artículos relacionados" };
  const ctaTitles: Record<string, string> = { fr: "Recevez nos pronostics premium", en: "Get our premium predictions", es: "Recibe nuestros pronósticos premium" };
  const ctaDescs: Record<string, string> = {
    fr: "Rejoignez PRONOS.CLUB et accédez à tous nos pronostics sportifs.",
    en: "Join PRONOS.CLUB and access all our sports predictions.",
    es: "Únete a PRONOS.CLUB y accede a todos nuestros pronósticos deportivos.",
  };
  const ctaBtns: Record<string, string> = { fr: "Voir les offres", en: "See plans", es: "Ver ofertas" };

  const vl = viewLabel[locale] || viewLabel.fr;

  const jsonLd = {
    "@context": "https://schema.org", "@type": "Article",
    headline: articleTitle, description: articleExcerpt || "",
    image: article.cover_image || undefined,
    datePublished: article.published_at,
    author: { "@type": "Organization", name: "PRONOS.CLUB" },
    publisher: { "@type": "Organization", name: "PRONOS.CLUB", url: "https://pronos.club" },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700;900&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />

      <main className="min-h-screen bg-white">
        {article.cover_image && (
          <div className="mx-auto max-w-4xl px-4 pt-8">
            <div className="overflow-hidden rounded-2xl">
              <img src={article.cover_image} alt={articleTitle} className="w-full max-h-[420px] object-cover" />
            </div>
          </div>
        )}

        <article className="mx-auto max-w-4xl px-4 pt-10 pb-16" style={{ fontFamily: "'Inter', sans-serif" }}>
          {/* Breadcrumb */}
          <div className="mb-8 flex items-center gap-2 text-xs" style={{ color: "#9ca3af" }}>
            <Link href={`/${locale}/news`} className="hover:text-neutral-600 transition">News</Link>
            <span>›</span>
            <Link
              href={`/${locale}/news?sport=${article.sport}`}
              className="font-medium hover:opacity-80 transition"
              style={{ color: sportColor }}
            >
              {sportIcon} {sportLabel}
            </Link>
          </div>

          {/* Title */}
          <h1 style={{ fontFamily: "'Merriweather', Georgia, serif", fontSize: "2rem", fontWeight: 900, lineHeight: 1.3, color: "#111827", letterSpacing: "-0.02em", marginBottom: "1rem" }}>
            {articleTitle}
          </h1>

          {/* Author + meta */}
          <div className="flex items-center gap-3 pb-8 mb-8" style={{ borderBottom: "1px solid #e5e7eb" }}>
            <img src="/pronos_club.png" alt="PRONOS.CLUB" className="h-10 w-10 rounded-full object-contain" />
            <div>
              <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "#111827" }}>PRONOS.CLUB</p>
              <p style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
                {fmt(article.published_at)} · {article.view_count} {article.view_count > 1 ? vl[1] : vl[0]}
              </p>
            </div>
          </div>

          {/* CONTENT */}
          <div className="blog-content" dangerouslySetInnerHTML={{ __html: articleContent }} />

          {/* Tags */}
          {article.tags?.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-12 pt-8" style={{ borderTop: "1px solid #e5e7eb" }}>
              {article.tags.map((tag: string) => (
                <span key={tag} style={{ background: "#f3f4f6", color: "#6b7280", fontSize: "0.75rem", padding: "0.25rem 0.75rem", borderRadius: "9999px" }}>
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Share */}
          <div className={`${article.tags?.length > 0 ? "mt-6" : "mt-12 pt-8"} flex flex-wrap items-center gap-3`} style={article.tags?.length > 0 ? undefined : { borderTop: "1px solid #e5e7eb" }}>
            <span style={{ fontSize: "0.8125rem", fontWeight: 500, color: "#9ca3af" }}>{shareLabel[locale] || shareLabel.fr}</span>
            {[
              { label: "𝕏", href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(articleTitle)}&url=${encodeURIComponent(articleUrl)}`, bg: "#0f1419" },
              { label: "Telegram", href: `https://t.me/share/url?url=${encodeURIComponent(articleUrl)}&text=${encodeURIComponent(articleTitle)}`, bg: "#0088cc" },
              { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(articleUrl)}`, bg: "#1877F2" },
              { label: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(articleTitle + " " + articleUrl)}`, bg: "#25D366" },
              { label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(articleUrl)}`, bg: "#0A66C2" },
            ].map((s) => (
              <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" style={{ background: s.bg, color: "white", fontSize: "0.75rem", fontWeight: 500, padding: "0.5rem 1rem", borderRadius: "8px", textDecoration: "none" }}>
                {s.label}
              </a>
            ))}
          </div>

          {/* CTA */}
          <div style={{ marginTop: "3rem", padding: "2rem", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "16px", textAlign: "center" }}>
            <p style={{ fontSize: "1.125rem", fontWeight: 700, color: "#111827", margin: 0 }}>{ctaTitles[locale] || ctaTitles.fr}</p>
            <p style={{ fontSize: "0.875rem", color: "#6b7280", marginTop: "0.5rem" }}>{ctaDescs[locale] || ctaDescs.fr}</p>
            <Link href={`/${locale}/abonnement`} style={{ display: "inline-block", marginTop: "1rem", background: "#059669", color: "white", padding: "0.75rem 2rem", borderRadius: "12px", fontSize: "0.875rem", fontWeight: 600, textDecoration: "none" }}>
              {ctaBtns[locale] || ctaBtns.fr}
            </Link>
          </div>
        </article>

        {/* Related */}
        {related.length > 0 && (
          <section style={{ borderTop: "1px solid #e5e7eb", background: "#fafafa" }}>
            <div className="mx-auto max-w-4xl px-4 py-12">
              <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#111827", marginBottom: "1.5rem" }}>
                {relatedLabel[locale] || relatedLabel.fr}
              </h2>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((r: any) => (
                  <Link key={r.id} href={`/${locale}/news/${r.slug}`} className="group overflow-hidden rounded-xl bg-white transition" style={{ border: "1px solid #e5e7eb" }}>
                    <div className="aspect-video overflow-hidden" style={{ background: "#f3f4f6" }}>
                      {r.cover_image ? (
                        <img src={r.cover_image} alt="" className="h-full w-full object-cover group-hover:scale-105 transition" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-3xl" style={{ color: "#d1d5db" }}>
                          {SPORT_ICONS[r.sport] || "📰"}
                        </div>
                      )}
                    </div>
                    <div style={{ padding: "1rem" }}>
                      <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "#111827", lineHeight: 1.4 }} className="line-clamp-2 group-hover:text-emerald-600 transition">
                        {localized(r, "title", locale)}
                      </h3>
                      <p style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "#9ca3af" }}>{fmt(r.published_at)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
    </>
  );
}