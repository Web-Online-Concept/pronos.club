"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface SeoData {
  blog: {
    published: number;
    drafts: number;
    totalViews: number;
    avgViews: number;
    topPosts: { title: string; slug: string; views: number }[];
    postsWithoutExcerpt: number;
    categoryStats: Record<string, number>;
    monthlyPosts: { month: string; count: number }[];
  };
  site: {
    sitemapPages: number;
    totalUsers: number;
    premiumUsers: number;
    bilansPublished: number;
    bookmakerPages: number;
    categories: number;
  };
}

export default function AdminSeoPage() {
  const { locale } = useParams();
  const [data, setData] = useState<SeoData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/seo")
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0a0a0f]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-emerald-500" />
      </main>
    );
  }

  const d = data!;

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="border-b border-white/[0.06] bg-[#0d0d14]">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <Link href={`/${locale}/admin`} className="mb-2 inline-block text-xs text-white/30 hover:text-white/60 transition">← Dashboard admin</Link>
          <h1 className="text-2xl font-bold">Référencement & SEO</h1>
          <p className="mt-1 text-sm text-white/40">Suivi du contenu, de l&apos;indexation et des performances</p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6 space-y-8">

        {/* ═══════ SITE OVERVIEW ═══════ */}
        <section>
          <h2 className="mb-4 text-sm font-semibold text-white/60">Vue d&apos;ensemble du site</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Pages dans le sitemap" value={String(d.site.sitemapPages)} sub="3 langues × toutes les pages" color="emerald" />
            <StatCard label="Articles publiés" value={String(d.blog.published)} sub={`${d.blog.drafts} brouillon${d.blog.drafts > 1 ? "s" : ""}`} color="blue" />
            <StatCard label="Bilans publiés" value={String(d.site.bilansPublished)} color="cyan" />
            <StatCard label="Pages bookmakers" value={String(d.site.bookmakerPages)} color="amber" />
          </div>
        </section>

        {/* ═══════ BLOG PERFORMANCE ═══════ */}
        <section>
          <h2 className="mb-4 text-sm font-semibold text-white/60">Performance du blog</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Vues totales" value={d.blog.totalViews.toLocaleString("fr-FR")} color="emerald" />
            <StatCard label="Moyenne par article" value={String(d.blog.avgViews)} sub="vues / article" color="blue" />
            <StatCard label="Articles sans extrait" value={String(d.blog.postsWithoutExcerpt)} sub={d.blog.postsWithoutExcerpt > 0 ? "⚠️ À compléter pour le SEO" : "✅ Tous les articles ont un extrait"} color={d.blog.postsWithoutExcerpt > 0 ? "amber" : "emerald"} />
          </div>
        </section>

        {/* ═══════ TOP ARTICLES ═══════ */}
        <section>
          <h2 className="mb-4 text-sm font-semibold text-white/60">Articles les plus vus</h2>
          {d.blog.topPosts.length === 0 ? (
            <p className="text-sm text-white/30 py-4">Aucun article publié</p>
          ) : (
            <div className="rounded-xl border border-white/[0.06] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                    <th className="px-4 py-3 text-left text-[10px] font-medium uppercase tracking-wider text-white/30">#</th>
                    <th className="px-4 py-3 text-left text-[10px] font-medium uppercase tracking-wider text-white/30">Article</th>
                    <th className="px-4 py-3 text-right text-[10px] font-medium uppercase tracking-wider text-white/30">Vues</th>
                  </tr>
                </thead>
                <tbody>
                  {d.blog.topPosts.map((post, i) => (
                    <tr key={post.slug} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                      <td className="px-4 py-3 text-xs text-white/30">{i + 1}</td>
                      <td className="px-4 py-3">
                        <Link href={`/${locale}/blog/${post.slug}`} target="_blank" className="text-xs font-medium text-white hover:text-emerald-400 transition">
                          {post.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-bold text-emerald-400">{post.views}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ═══════ ARTICLES BY CATEGORY ═══════ */}
        <section>
          <h2 className="mb-4 text-sm font-semibold text-white/60">Articles par catégorie</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(d.blog.categoryStats).map(([cat, count]) => (
              <div key={cat} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                <span className="text-sm text-white/70">{cat}</span>
                <span className="text-sm font-bold text-white">{count} article{count > 1 ? "s" : ""}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════ MONTHLY PUBLISHING ═══════ */}
        <section>
          <h2 className="mb-4 text-sm font-semibold text-white/60">Publications par mois (6 derniers mois)</h2>
          <div className="flex items-end gap-3 h-40">
            {d.blog.monthlyPosts.map((m) => {
              const maxCount = Math.max(...d.blog.monthlyPosts.map(x => x.count), 1);
              const height = Math.max((m.count / maxCount) * 100, 4);
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs font-bold text-white">{m.count}</span>
                  <div className="w-full rounded-t-lg bg-emerald-500/30" style={{ height: `${height}%` }}>
                    <div className="w-full h-full rounded-t-lg bg-emerald-500" style={{ opacity: m.count > 0 ? 1 : 0.2 }} />
                  </div>
                  <span className="text-[10px] text-white/30">{m.month}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* ═══════ USERS ═══════ */}
        <section>
          <h2 className="mb-4 text-sm font-semibold text-white/60">Utilisateurs</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Inscrits total" value={String(d.site.totalUsers)} color="blue" />
            <StatCard label="Abonnés Premium" value={String(d.site.premiumUsers)} color="emerald" />
            <StatCard label="Taux de conversion" value={d.site.totalUsers > 0 ? `${Math.round((d.site.premiumUsers / d.site.totalUsers) * 100)}%` : "0%"} sub="inscrits → premium" color="purple" />
          </div>
        </section>

        {/* ═══════ SEO CHECKLIST ═══════ */}
        <section>
          <h2 className="mb-4 text-sm font-semibold text-white/60">Checklist SEO</h2>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
            <CheckItem done label="Sitemap.xml dynamique" url="/sitemap.xml" />
            <CheckItem done label="Robots.txt configuré" url="/robots.txt" />
            <CheckItem done label="Favicon installé" />
            <CheckItem done label="Open Graph par défaut" />
            <CheckItem done label="Twitter Cards configurés" />
            <CheckItem done label="Schema.org sur les articles" />
            <CheckItem done label="Meta titles par page" />
            <CheckItem done={false} label="Image OG personnalisée (og-image.jpg)" note="Créer une image 1200×630 dans /public/" />
            <CheckItem done={false} label="Google Analytics" note="Ajouter G-XXXXXXXXXX au lancement" />
            <CheckItem done={false} label="Google Search Console" note="Vérifier le domaine + soumettre le sitemap" />
          </div>
        </section>

        {/* ═══════ GOOGLE ANALYTICS — PLACEHOLDER ═══════ */}
        <section>
          <h2 className="mb-4 text-sm font-semibold text-white/60">Google Analytics</h2>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-6 text-center">
            <p className="text-3xl">📊</p>
            <p className="mt-3 text-sm font-medium text-amber-400">Non connecté</p>
            <p className="mt-1 text-xs text-white/40">
              Les données de trafic (visiteurs, pages vues, sources) apparaîtront ici une fois Google Analytics configuré.
            </p>
            <p className="mt-3 text-xs text-white/20">
              1. Créer une propriété GA4 sur analytics.google.com<br />
              2. Copier l&apos;ID de mesure (G-XXXXXXXXXX)<br />
              3. L&apos;ajouter dans les variables d&apos;environnement Vercel
            </p>
          </div>
        </section>

        {/* ═══════ GOOGLE SEARCH CONSOLE — PLACEHOLDER ═══════ */}
        <section>
          <h2 className="mb-4 text-sm font-semibold text-white/60">Google Search Console</h2>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-6 text-center">
            <p className="text-3xl">🔍</p>
            <p className="mt-3 text-sm font-medium text-amber-400">Non connecté</p>
            <p className="mt-1 text-xs text-white/40">
              Les données d&apos;indexation (pages indexées, requêtes, positions, CTR) apparaîtront ici une fois Search Console configuré.
            </p>
            <p className="mt-3 text-xs text-white/20">
              1. Ajouter le site sur search.google.com/search-console<br />
              2. Vérifier la propriété (DNS ou balise meta)<br />
              3. Soumettre le sitemap : https://pronos.club/sitemap.xml
            </p>
          </div>
        </section>

        {/* ═══════ USEFUL LINKS ═══════ */}
        <section>
          <h2 className="mb-4 text-sm font-semibold text-white/60">Liens utiles</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Sitemap.xml", url: "https://pronos.club/sitemap.xml", icon: "🗺️" },
              { label: "Robots.txt", url: "https://pronos.club/robots.txt", icon: "🤖" },
              { label: "Test Rich Results", url: "https://search.google.com/test/rich-results?url=https://pronos.club", icon: "✅" },
              { label: "PageSpeed Insights", url: "https://pagespeed.web.dev/analysis?url=https://pronos.club", icon: "⚡" },
            ].map(link => (
              <a key={link.label} href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white/60 hover:bg-white/[0.04] hover:text-white transition">
                <span className="text-lg">{link.icon}</span>
                <span>{link.label}</span>
              </a>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

// ── Stat card component ──
function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  const colors: Record<string, string> = {
    emerald: "border-emerald-500/20 bg-emerald-500/5",
    blue: "border-blue-500/20 bg-blue-500/5",
    cyan: "border-cyan-500/20 bg-cyan-500/5",
    amber: "border-amber-500/20 bg-amber-500/5",
    purple: "border-purple-500/20 bg-purple-500/5",
  };
  const textColors: Record<string, string> = {
    emerald: "text-emerald-400",
    blue: "text-blue-400",
    cyan: "text-cyan-400",
    amber: "text-amber-400",
    purple: "text-purple-400",
  };

  return (
    <div className={`rounded-xl border p-4 ${colors[color] || colors.emerald}`}>
      <p className="text-[10px] font-medium uppercase tracking-wider text-white/30">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${textColors[color] || textColors.emerald}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-white/30">{sub}</p>}
    </div>
  );
}

// ── Checklist item component ──
function CheckItem({ done, label, url, note }: { done: boolean; label: string; url?: string; note?: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className={`mt-0.5 text-sm ${done ? "text-emerald-400" : "text-amber-400"}`}>
        {done ? "✅" : "⬜"}
      </span>
      <div>
        <p className={`text-sm ${done ? "text-white/60" : "text-white/80 font-medium"}`}>
          {url ? <a href={url} target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 transition underline">{label}</a> : label}
        </p>
        {note && <p className="text-xs text-white/30 mt-0.5">{note}</p>}
      </div>
    </div>
  );
}