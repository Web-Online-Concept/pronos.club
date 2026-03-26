import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Blog — PRONOS.CLUB",
  description: "Actualités sportives, guides paris sportifs, analyses et previews. Tout le contenu pour devenir un parieur rentable.",
};

interface Category {
  id: string;
  name: string;
  slug: string;
  color: string;
  icon: string;
}

interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image: string | null;
  published_at: string;
  view_count: number;
  tags: string[];
  blog_categories: Category | null;
}

async function getPosts(category?: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ? "" : "http://localhost:3000";
  const url = new URL("/api/blog", base || "http://localhost:3000");
  url.searchParams.set("limit", "24");
  if (category) url.searchParams.set("category", category);

  const res = await fetch(url.toString(), { next: { revalidate: 60 } });
  return res.json();
}

async function getCategories(): Promise<Category[]> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ? "" : "http://localhost:3000";
  const res = await fetch(`${base || "http://localhost:3000"}/api/blog/categories`, { next: { revalidate: 300 } });
  return res.json();
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
  const [{ posts, total }, categories] = await Promise.all([
    getPosts(category),
    getCategories(),
  ]);

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Hero */}
      <div className="border-b border-white/[0.06] bg-gradient-to-b from-[#0d1117] to-[#0a0a0f]">
        <div className="mx-auto max-w-6xl px-4 py-12 text-center">
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
            Blog
          </h1>
          <p className="mt-3 text-base text-white/40">
            Actualités, analyses, guides — tout pour parier intelligemment
          </p>

          {/* Category pills */}
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            <Link
              href={`/${locale}/blog`}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                !category
                  ? "bg-white/10 text-white"
                  : "text-white/40 hover:text-white/60"
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
                    : "text-white/40 hover:text-white/60"
                }`}
                style={
                  category === c.slug
                    ? { backgroundColor: `${c.color}30`, color: c.color }
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
      <div className="mx-auto max-w-6xl px-4 py-8">
        {(posts as Post[]).length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <p className="text-5xl">📰</p>
            <p className="mt-4 text-lg font-medium text-white/40">
              Aucun article pour le moment
            </p>
            <p className="mt-1 text-sm text-white/20">
              Les premiers articles arrivent bientôt !
            </p>
          </div>
        ) : (
          <>
            {/* Featured (first post, larger) */}
            {!category && (posts as Post[]).length > 0 && (
              <Link
                href={`/${locale}/blog/${(posts as Post[])[0].slug}`}
                className="group mb-8 block overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition"
              >
                <div className="grid md:grid-cols-2">
                  <div className="aspect-video overflow-hidden bg-white/[0.03]">
                    {(posts as Post[])[0].cover_image ? (
                      <img
                        src={(posts as Post[])[0].cover_image!}
                        alt=""
                        className="h-full w-full object-cover transition group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-6xl text-white/10">
                        {(posts as Post[])[0].blog_categories?.icon || "📄"}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col justify-center p-6 md:p-10">
                    {(posts as Post[])[0].blog_categories && (
                      <span
                        className="mb-3 inline-flex w-fit rounded-full px-3 py-1 text-xs font-medium"
                        style={{
                          backgroundColor: `${(posts as Post[])[0].blog_categories!.color}20`,
                          color: (posts as Post[])[0].blog_categories!.color,
                        }}
                      >
                        {(posts as Post[])[0].blog_categories!.icon}{" "}
                        {(posts as Post[])[0].blog_categories!.name}
                      </span>
                    )}
                    <h2 className="text-2xl font-bold leading-tight group-hover:text-emerald-400 transition">
                      {(posts as Post[])[0].title}
                    </h2>
                    {(posts as Post[])[0].excerpt && (
                      <p className="mt-3 text-sm text-white/50 line-clamp-3">
                        {(posts as Post[])[0].excerpt}
                      </p>
                    )}
                    <p className="mt-4 text-xs text-white/30">
                      {fmt((posts as Post[])[0].published_at)}
                      {" · "}{(posts as Post[])[0].view_count} vue{(posts as Post[])[0].view_count > 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
              </Link>
            )}

            {/* Rest of posts in grid */}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {(posts as Post[])
                .slice(!category ? 1 : 0)
                .map((post: Post) => (
                  <Link
                    key={post.id}
                    href={`/${locale}/blog/${post.slug}`}
                    className="group overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition"
                  >
                    <div className="aspect-video overflow-hidden bg-white/[0.03]">
                      {post.cover_image ? (
                        <img
                          src={post.cover_image}
                          alt=""
                          className="h-full w-full object-cover transition group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-4xl text-white/10">
                          {post.blog_categories?.icon || "📄"}
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      {post.blog_categories && (
                        <span
                          className="mb-2 inline-flex rounded-md px-2 py-0.5 text-[10px] font-medium"
                          style={{
                            backgroundColor: `${post.blog_categories.color}20`,
                            color: post.blog_categories.color,
                          }}
                        >
                          {post.blog_categories.icon} {post.blog_categories.name}
                        </span>
                      )}
                      <h3 className="text-sm font-semibold leading-snug group-hover:text-emerald-400 transition line-clamp-2">
                        {post.title}
                      </h3>
                      {post.excerpt && (
                        <p className="mt-2 text-xs text-white/40 line-clamp-2">
                          {post.excerpt}
                        </p>
                      )}
                      <p className="mt-3 text-[10px] text-white/25">
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