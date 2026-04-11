// src/app/[locale]/(public)/blog/page.tsx

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { getTranslations } from "next-intl/server";
import { localized } from "@/lib/blog-i18n";
import MobileCategorySelect from "./MobileCategorySelect";
import DesktopCategorySelect from "./DesktopCategorySelect";

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const PER_PAGE = 12;

async function getPosts(category?: string, page: number = 1) {
  const offset = (page - 1) * PER_PAGE;

  let query = supabaseAdmin.from("blog_posts")
    .select("id, title, title_en, title_es, slug, excerpt, excerpt_en, excerpt_es, cover_image, category_id, tags, status, author_name, view_count, published_at, blog_categories(name, name_en, name_es, slug, color, icon)", { count: "exact" })
    .eq("status", "published").order("published_at", { ascending: false })
    .range(offset, offset + PER_PAGE - 1);

  if (category) {
    const { data: cat } = await supabaseAdmin.from("blog_categories").select("id").eq("slug", category).single();
    if (cat) query = query.eq("category_id", cat.id);
  }

  const { data, count } = await query;
  return { posts: (data || []) as any[], total: count || 0 };
}

async function getCategories() {
  const { data } = await supabaseAdmin.from("blog_categories").select("*, name_en, name_es").order("sort_order", { ascending: true });
  return (data || []) as any[];
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "blog" });
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function BlogPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ category?: string; page?: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "blog" });
  const { category, page: pageParam } = await searchParams;
  const currentPage = Math.max(1, parseInt(pageParam || "1"));
  const [{ posts, total }, categories] = await Promise.all([getPosts(category, currentPage), getCategories()]);
  const totalPages = Math.ceil(total / PER_PAGE);

  const dateFmt = locale === "es" ? "es-ES" : locale === "en" ? "en-US" : "fr-FR";
  const fmt = (d: string) => new Date(d).toLocaleDateString(dateFmt, { day: "numeric", month: "long", year: "numeric" });

  const pageUrl = (p: number) => {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/${locale}/blog${qs ? `?${qs}` : ""}`;
  };

  // Helper for category name
  const catName = (c: any) => localized(c, "name", locale);

  // Préparer les catégories pour le composant client mobile
  const mobileCats = categories.map((c: any) => ({
    slug: c.slug,
    icon: c.icon,
    label: catName(c),
  }));

  return (
    <main className="min-h-screen bg-white text-neutral-900">
      {/* ═══════════ HERO — dark gradient matching other pages ═══════════ */}
      <section
        className="relative overflow-hidden border-b border-emerald-900/50"
        style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
      >
        {/* Glow effects */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 -top-32 h-[400px] w-[400px] rounded-full bg-emerald-500/15 blur-[120px]" />
          <div className="absolute -bottom-20 -right-20 h-[300px] w-[300px] rounded-full bg-emerald-400/10 blur-[100px]" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 py-10 text-center sm:py-14">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-400">✍️ PRONOS.CLUB</p>
          <h1 className="mt-3 text-3xl font-extrabold text-white sm:text-4xl">{t("heading")}</h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-white/40">{t("subtitle")}</p>

          {/* Mobile: dropdown (Client Component) */}
          <div className="mt-6 flex justify-center sm:hidden">
            <MobileCategorySelect
              locale={locale}
              category={category}
              categories={mobileCats}
              filterAllLabel={t("filter_all")}
            />
          </div>

          {/* Desktop: dropdown (Client Component) */}
          <div className="mt-8 hidden justify-center sm:flex">
            <DesktopCategorySelect
              locale={locale}
              category={category}
              categories={mobileCats}
              allLabel={t("filter_all")}
            />
          </div>
        </div>
      </section>

      {/* ═══════════ CONTENT ═══════════ */}
      <div className="mx-auto max-w-6xl px-4 py-10">
        {posts.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <p className="text-5xl">📰</p>
            <p className="mt-4 text-lg text-neutral-400">{t("empty")}</p>
          </div>
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post: any) => (
                <Link key={post.id} href={`/${locale}/blog/${post.slug}`} className="group overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm hover:shadow-md transition">
                  <div className="h-36 overflow-hidden bg-neutral-100">
                    {post.cover_image ? <img src={post.cover_image} alt="" className="h-full w-full object-cover group-hover:scale-105 transition" /> : <div className="flex h-full items-center justify-center text-3xl text-neutral-200">{post.blog_categories?.icon || "📄"}</div>}
                  </div>
                  <div className="p-3">
                    {post.blog_categories && <span className="mb-1.5 inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold text-white" style={{ backgroundColor: post.blog_categories.color }}>{post.blog_categories.icon} {catName(post.blog_categories)}</span>}
                    <h3 className="text-sm font-semibold leading-snug group-hover:text-emerald-600 transition line-clamp-2">{localized(post, "title", locale)}</h3>
                    {(localized(post, "excerpt", locale)) && <p className="mt-1.5 text-xs text-neutral-500 line-clamp-2">{localized(post, "excerpt", locale)}</p>}
                    <p className="mt-2 text-[10px] text-neutral-400">{fmt(post.published_at)} · {post.view_count} {t("views")}</p>
                  </div>
                </Link>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-10 flex items-center justify-center gap-2">
                {currentPage > 1 ? (
                  <Link href={pageUrl(currentPage - 1)} className="rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100 transition">{t("prev")}</Link>
                ) : (
                  <span className="rounded-lg border border-neutral-100 px-3 py-2 text-sm text-neutral-300">{t("prev")}</span>
                )}

                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <Link key={p} href={pageUrl(p)} className={`rounded-lg px-3 py-2 text-sm font-medium transition ${p === currentPage ? "bg-neutral-900 text-white" : "border border-neutral-200 text-neutral-600 hover:bg-neutral-100"}`}>{p}</Link>
                ))}

                {currentPage < totalPages ? (
                  <Link href={pageUrl(currentPage + 1)} className="rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100 transition">{t("next")}</Link>
                ) : (
                  <span className="rounded-lg border border-neutral-100 px-3 py-2 text-sm text-neutral-300">{t("next")}</span>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}