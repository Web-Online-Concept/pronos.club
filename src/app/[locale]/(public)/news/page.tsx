// src/app/[locale]/(public)/news/page.tsx
// Page publique News automatiques — design cohérent avec le blog

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import MobileSportSelect from "./MobileSportSelect";
import DesktopSportSelect from "./DesktopSportSelect";
import { localized } from "@/lib/blog-i18n";

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const PER_PAGE = 12;

const SPORT_ICONS: Record<string, string> = {
  football: "⚽",
  basketball: "🏀",
  tennis: "🎾",
  "football-americain": "🏈",
  baseball: "⚾",
  hockey: "🏒",
  mma: "🥊",
  golf: "⛳",
};

const SPORT_LABELS_FR: Record<string, string> = {
  football: "Football",
  basketball: "Basketball",
  tennis: "Tennis",
  "football-americain": "Football US",
  baseball: "Baseball",
  hockey: "Hockey",
  mma: "MMA",
  golf: "Golf",
};

const SPORT_LABELS_EN: Record<string, string> = {
  football: "Soccer",
  basketball: "Basketball",
  tennis: "Tennis",
  "football-americain": "NFL",
  baseball: "Baseball",
  hockey: "Hockey",
  mma: "MMA",
  golf: "Golf",
};

const SPORT_LABELS_ES: Record<string, string> = {
  football: "Fútbol",
  basketball: "Baloncesto",
  tennis: "Tenis",
  "football-americain": "Fútbol Americano",
  baseball: "Béisbol",
  hockey: "Hockey",
  mma: "MMA",
  golf: "Golf",
};

function getSportLabel(sport: string, locale: string): string {
  if (locale === "en") return SPORT_LABELS_EN[sport] || sport;
  if (locale === "es") return SPORT_LABELS_ES[sport] || sport;
  return SPORT_LABELS_FR[sport] || sport;
}

const SPORT_COLORS: Record<string, string> = {
  football: "#10b981",
  basketball: "#f59e0b",
  tennis: "#8b5cf6",
  "football-americain": "#ef4444",
  baseball: "#3b82f6",
  hockey: "#06b6d4",
  mma: "#dc2626",
  golf: "#22c55e",
};

async function getNews(sport?: string, page: number = 1) {
  const offset = (page - 1) * PER_PAGE;
  let query = supabaseAdmin
    .from("auto_news")
    .select("id, title, title_en, title_es, slug, excerpt, excerpt_en, excerpt_es, cover_image, sport, league, tags, view_count, published_at", { count: "exact" })
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .range(offset, offset + PER_PAGE - 1);

  if (sport) query = query.eq("sport", sport);

  const { data, count } = await query;
  return { articles: (data || []) as any[], total: count || 0 };
}

async function getSports() {
  const { data } = await supabaseAdmin
    .from("auto_news")
    .select("sport")
    .eq("status", "published");

  const unique = [...new Set((data || []).map((d: any) => d.sport))];
  return unique.sort();
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const titles: Record<string, string> = {
    fr: "Actualités Sport & Paris — PRONOS.CLUB",
    en: "Sports & Betting News — PRONOS.CLUB",
    es: "Noticias Deportivas & Apuestas — PRONOS.CLUB",
  };
  const descriptions: Record<string, string> = {
    fr: "Toute l'actualité sportive avec un angle paris sportifs. Football, NBA, Tennis, NFL et plus.",
    en: "All sports news with a betting angle. Soccer, NBA, Tennis, NFL and more.",
    es: "Todas las noticias deportivas con enfoque en apuestas. Fútbol, NBA, Tenis, NFL y más.",
  };
  return { title: titles[locale] || titles.fr, description: descriptions[locale] || descriptions.fr };
}

export default async function NewsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ sport?: string; page?: string }> }) {
  const { locale } = await params;
  const { sport, page: pageParam } = await searchParams;
  const currentPage = Math.max(1, parseInt(pageParam || "1"));
  const [{ articles, total }, sports] = await Promise.all([getNews(sport, currentPage), getSports()]);
  const totalPages = Math.ceil(total / PER_PAGE);

  const dateFmt = locale === "es" ? "es-ES" : locale === "en" ? "en-US" : "fr-FR";
  const fmt = (d: string) => new Date(d).toLocaleDateString(dateFmt, { day: "numeric", month: "long", year: "numeric" });

  const headings: Record<string, string> = {
    fr: "Actualités Sportives",
    en: "Sports News",
    es: "Noticias Deportivas",
  };
  const subtitles: Record<string, string> = {
    fr: "L'actu sport décryptée avec un angle paris et pronostics",
    en: "Sports news with a betting and predictions angle",
    es: "Noticias deportivas con enfoque en apuestas y pronósticos",
  };
  const filterAll: Record<string, string> = {
    fr: "Tous les sports",
    en: "All sports",
    es: "Todos los deportes",
  };
  const emptyMsg: Record<string, string> = {
    fr: "Aucune actualité pour le moment",
    en: "No news yet",
    es: "Sin noticias por el momento",
  };
  const viewsLabel: Record<string, string> = { fr: "vues", en: "views", es: "vistas" };
  const prevLabel: Record<string, string> = { fr: "← Précédent", en: "← Previous", es: "← Anterior" };
  const nextLabel: Record<string, string> = { fr: "Suivant →", en: "Next →", es: "Siguiente →" };

  const sportOptions = sports.map((s: string) => ({
    value: s,
    icon: SPORT_ICONS[s] || "🏅",
    label: getSportLabel(s, locale),
  }));

  const pageUrl = (p: number) => {
    const params = new URLSearchParams();
    if (sport) params.set("sport", sport);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/${locale}/news${qs ? `?${qs}` : ""}`;
  };

  return (
    <main className="min-h-screen overflow-x-hidden bg-white text-neutral-900">
      {/* ═══════════ HERO ═══════════ */}
      <section
        className="relative overflow-hidden border-b border-emerald-900/50"
        style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 -top-32 h-[400px] w-[400px] rounded-full bg-emerald-500/15 blur-[120px]" />
          <div className="absolute -bottom-20 -right-20 h-[300px] w-[300px] rounded-full bg-emerald-400/10 blur-[100px]" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 py-10 text-center sm:py-14">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-400">📰 PRONOS.CLUB</p>
          <h1 className="mt-3 text-3xl font-extrabold text-white sm:text-4xl">{headings[locale] || headings.fr}</h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-white/40">{subtitles[locale] || subtitles.fr}</p>

          {/* Mobile: dropdown (Client Component) */}
          <div className="mt-6 flex justify-center sm:hidden">
            <MobileSportSelect
              locale={locale}
              sport={sport}
              sports={sportOptions}
              filterAllLabel={filterAll[locale] || filterAll.fr}
            />
          </div>

          {/* Desktop: dropdown (Client Component) */}
          <div className="mt-8 hidden justify-center sm:flex">
            <DesktopSportSelect
              locale={locale}
              sport={sport}
              sports={sportOptions}
              allLabel={filterAll[locale] || filterAll.fr}
            />
          </div>
        </div>
      </section>

      {/* ═══════════ CONTENT ═══════════ */}
      <div className="mx-auto max-w-6xl px-4 py-10">
        {articles.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <p className="text-5xl">📰</p>
            <p className="mt-4 text-lg text-neutral-400">{emptyMsg[locale] || emptyMsg.fr}</p>
          </div>
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {articles.map((article: any) => (
                <Link
                  key={article.id}
                  href={`/${locale}/news/${article.slug}`}
                  className="group min-w-0 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm hover:shadow-md transition"
                >
                  <div className="h-36 overflow-hidden bg-neutral-100">
                    {article.cover_image ? (
                      <img src={article.cover_image} alt="" className="h-full w-full object-cover group-hover:scale-105 transition" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-3xl text-neutral-200">
                        {SPORT_ICONS[article.sport] || "📰"}
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <span
                      className="mb-1.5 inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold text-white"
                      style={{ backgroundColor: SPORT_COLORS[article.sport] || "#10b981" }}
                    >
                      {SPORT_ICONS[article.sport] || "🏅"} {getSportLabel(article.sport, locale)}
                    </span>
                    <h3 className="text-sm font-semibold leading-snug group-hover:text-emerald-600 transition line-clamp-2">
                      {localized(article, "title", locale)}
                    </h3>
                    {localized(article, "excerpt", locale) && (
                      <p className="mt-1.5 text-xs text-neutral-500 line-clamp-2">
                        {localized(article, "excerpt", locale)}
                      </p>
                    )}
                    <p className="mt-2 text-[10px] text-neutral-400">
                      {fmt(article.published_at)} · {article.view_count} {viewsLabel[locale] || viewsLabel.fr}
                    </p>
                  </div>
                </Link>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-10 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
                {currentPage > 1 ? (
                  <Link href={pageUrl(currentPage - 1)} className="rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100 transition">
                    ←
                  </Link>
                ) : (
                  <span className="rounded-lg border border-neutral-100 px-3 py-2 text-sm text-neutral-300">←</span>
                )}

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1))
                  .map((p, idx, arr) => {
                    const prev = arr[idx - 1];
                    const showEllipsis = prev && p - prev > 1;
                    return (
                      <span key={p} className="contents">
                        {showEllipsis && <span className="px-1 text-sm text-neutral-400">…</span>}
                        <Link
                          href={pageUrl(p)}
                          className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                            p === currentPage
                              ? "bg-neutral-900 text-white"
                              : "border border-neutral-200 text-neutral-600 hover:bg-neutral-100"
                          }`}
                        >
                          {p}
                        </Link>
                      </span>
                    );
                  })}

                {currentPage < totalPages ? (
                  <Link href={pageUrl(currentPage + 1)} className="rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100 transition">
                    →
                  </Link>
                ) : (
                  <span className="rounded-lg border border-neutral-100 px-3 py-2 text-sm text-neutral-300">→</span>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}