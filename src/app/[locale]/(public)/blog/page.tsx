import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { getTranslations } from "next-intl/server";

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const PER_PAGE = 12;

async function getPosts(category?: string, page: number = 1) {
  const offset = (page - 1) * PER_PAGE;

  let query = supabaseAdmin.from("blog_posts")
    .select("id, title, slug, excerpt, cover_image, category_id, tags, status, author_name, view_count, published_at, blog_categories(name, slug, color, icon)", { count: "exact" })
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
  const { data } = await supabaseAdmin.from("blog_categories").select("*").order("sort_order", { ascending: true });
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

  // Build pagination URL helper
  const pageUrl = (p: number) => {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/${locale}/blog${qs ? `?${qs}` : ""}`;
  };

  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <div className="border-b border-neutral-200 bg-gradient-to-b from-neutral-50 to-white">
        <div className="mx-auto max-w-6xl px-4 py-12 text-center">
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">{t("heading")}</h1>
          <p className="mt-3 text-base text-neutral-500">{t("subtitle")}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            <Link href={`/${locale}/blog`} className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${!category ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"}`}>{t("filter_all")}</Link>
            {categories.map((c: any) => (
              <Link key={c.slug} href={`/${locale}/blog?category=${c.slug}`} className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${category === c.slug ? "text-white" : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"}`} style={category === c.slug ? { backgroundColor: c.color } : undefined}>{c.icon} {c.name}</Link>
            ))}
          </div>
        </div>
      </div>
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
                    {post.blog_categories && <span className="mb-1.5 inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold text-white" style={{ backgroundColor: post.blog_categories.color }}>{post.blog_categories.icon} {post.blog_categories.name}</span>}
                    <h3 className="text-sm font-semibold leading-snug group-hover:text-emerald-600 transition line-clamp-2">{post.title}</h3>
                    {post.excerpt && <p className="mt-1.5 text-xs text-neutral-500 line-clamp-2">{post.excerpt}</p>}
                    <p className="mt-2 text-[10px] text-neutral-400">{fmt(post.published_at)} · {post.view_count} {t("views")}</p>
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-10 flex items-center justify-center gap-2">
                {/* Previous */}
                {currentPage > 1 ? (
                  <Link href={pageUrl(currentPage - 1)} className="rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100 transition">{t("prev")}</Link>
                ) : (
                  <span className="rounded-lg border border-neutral-100 px-3 py-2 text-sm text-neutral-300">{t("prev")}</span>
                )}

                {/* Page numbers */}
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <Link
                    key={p}
                    href={pageUrl(p)}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                      p === currentPage
                        ? "bg-neutral-900 text-white"
                        : "border border-neutral-200 text-neutral-600 hover:bg-neutral-100"
                    }`}
                  >
                    {p}
                  </Link>
                ))}

                {/* Next */}
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