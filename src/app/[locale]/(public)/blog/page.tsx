import Link from "next/link";
import { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";

export const metadata: Metadata = {
  title: "Blog — PRONOS.CLUB",
  description: "Actualités sportives, guides paris sportifs, analyses et previews. Tout le contenu pour devenir un parieur rentable.",
};

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Category {
  id: string;
  name: string;
  slug: string;
  color: string;
  icon: string;
}

async function getPosts(category?: string) {
  let query = supabaseAdmin
    .from("blog_posts")
    .select("id, title, slug, excerpt, cover_image, category_id, tags, status, author_name, view_count, published_at, created_at, updated_at, blog_categories(name, slug, color, icon)", { count: "exact" })
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .range(0, 23);

  if (category) {
    const { data: cat } = await supabaseAdmin
      .from("blog_categories")
      .select("id")
      .eq("slug", category)
      .single();
    if (cat) query = query.eq("category_id", cat.id);
  }

  const { data: posts, count } = await query;
  return { posts: posts || [], total: count || 0 };
}

async function getCategories(): Promise<Category[]> {
  const { data } = await supabaseAdmin
    .from("blog_categories")
    .select("*")
    .order("sort_order", { ascending: true });
  return data || [];
}

export default async function BlogPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const { locale } = await params;
  const { category } = await searchParams;
  const [{ posts }, categories] = await Promise.all([
    getPosts(category),
    getCategories(),
  ]);

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  const allPosts = posts as any[];

  return (
    <main className="min-h-screen bg-white text-neutral-900">
      {/* Hero */}
      <div className="border-b border-neutral-200 bg-gradient-to-b from-neutral-50 to-white">
        <div className="mx-auto max-w-6xl px-4 py-12 text-center">
          <h1 className="text-4xl font-black tracking-tight text-neutral-900 sm:text-5xl">
            Blog
          </h1>
          <p className="mt-3 text-base text-neutral-500">
            Actualités, analyses, guides — tout pour parier intelligemment
          </p>

          {/* Category pills */}
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            <Link
              href={`/${locale}/blog`}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                !category
                  ? "bg-neutral-900 text-white"
                  : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-700"
              }`}
            >
              Tous
            </Link>
            {categories.map((c: Category) => (
              <Link
                key={c.slug}
                href={`/${locale}/blog?category=${c.slug}`}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  category === c.slug
                    ? "text-white"
                    : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-700"
                }`}
                style={
                  category === c.slug
                    ? { backgroundColor: c.color, color: "#fff" }
                    : undefined
                }
              >
                {c.icon} {c.name}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="mx-auto max-w-6xl px-4 py-10">
        {allPosts.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <p className="text-5xl">📰</p>
            <p className="mt-4 text-lg font-medium text-neutral-400">
              Aucun article pour le moment
            </p>
            <p className="mt-1 text-sm text-neutral-300">
              Les premiers articles arrivent bientôt !
            </p>
          </div>
        ) : (
          <>
            {/* Featured (first post, larger) */}
            {!category && allPosts.length > 0 && (
              <Link
                href={`/${locale}/blog/${allPosts[0].slug}`}
                className="group mb-10 block overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm hover:shadow-md transition"
              >
                <div className="grid md:grid-cols-2">
                  <div className="aspect-video overflow-hidden bg-neutral-100">
                    {allPosts[0].cover_image ? (
                      <img
                        src={allPosts[0].cover_image}
                        alt=""
                        className="h-full w-full object-cover transition group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-6xl text-neutral-200">
                        {allPosts[0].blog_categories?.icon || "📄"}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col justify-center p-6 md:p-10">
                    {allPosts[0].blog_categories && (
                      <span
                        className="mb-3 inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold text-white"
                        style={{ backgroundColor: allPosts[0].blog_categories.color }}
                      >
                        {allPosts[0].blog_categories.icon}{" "}
                        {allPosts[0].blog_categories.name}
                      </span>
                    )}
                    <h2 className="text-2xl font-bold leading-tight text-neutral-900 group-hover:text-emerald-600 transition">
                      {allPosts[0].title}
                    </h2>
                    {allPosts[0].excerpt && (
                      <p className="mt-3 text-sm text-neutral-500 line-clamp-3">
                        {allPosts[0].excerpt}
                      </p>
                    )}
                    <p className="mt-4 text-xs text-neutral-400">
                      {fmt(allPosts[0].published_at)}
                      {" · "}{allPosts[0].view_count} vue{allPosts[0].view_count > 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
              </Link>
            )}

            {/* Rest of posts in grid */}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {allPosts
                .slice(!category ? 1 : 0)
                .map((post: any) => (
                  <Link
                    key={post.id}
                    href={`/${locale}/blog/${post.slug}`}
                    className="group overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm hover:shadow-md transition"
                  >
                    <div className="aspect-video overflow-hidden bg-neutral-100">
                      {post.cover_image ? (
                        <img
                          src={post.cover_image}
                          alt=""
                          className="h-full w-full object-cover transition group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-4xl text-neutral-200">
                          {post.blog_categories?.icon || "📄"}
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      {post.blog_categories && (
                        <span
                          className="mb-2 inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold text-white"
                          style={{ backgroundColor: post.blog_categories.color }}
                        >
                          {post.blog_categories.icon} {post.blog_categories.name}
                        </span>
                      )}
                      <h3 className="text-sm font-semibold leading-snug text-neutral-900 group-hover:text-emerald-600 transition line-clamp-2">
                        {post.title}
                      </h3>
                      {post.excerpt && (
                        <p className="mt-2 text-xs text-neutral-500 line-clamp-2">
                          {post.excerpt}
                        </p>
                      )}
                      <p className="mt-3 text-[10px] text-neutral-400">
                        {fmt(post.published_at)} · {post.view_count} vue{post.view_count > 1 ? "s" : ""}
                      </p>
                    </div>
                  </Link>
                ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}