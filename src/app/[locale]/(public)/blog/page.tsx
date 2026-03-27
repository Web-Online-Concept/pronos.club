import Link from "next/link";
import { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";

export const metadata: Metadata = {
  title: "Blog — PRONOS.CLUB",
  description: "Actualités sportives, guides paris sportifs, analyses et previews.",
};

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function getPosts(category?: string) {
  let query = supabaseAdmin.from("blog_posts")
    .select("id, title, slug, excerpt, cover_image, category_id, tags, status, author_name, view_count, published_at, blog_categories(name, slug, color, icon)", { count: "exact" })
    .eq("status", "published").order("published_at", { ascending: false }).range(0, 23);

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

export default async function BlogPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ category?: string }> }) {
  const { locale } = await params;
  const { category } = await searchParams;
  const [{ posts }, categories] = await Promise.all([getPosts(category), getCategories()]);

  const fmt = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <div className="border-b border-neutral-200 bg-gradient-to-b from-neutral-50 to-white">
        <div className="mx-auto max-w-6xl px-4 py-12 text-center">
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">Blog</h1>
          <p className="mt-3 text-base text-neutral-500">Actualités, analyses, guides — tout pour parier intelligemment</p>
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            <Link href={`/${locale}/blog`} className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${!category ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"}`}>Tous</Link>
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
            <p className="mt-4 text-lg text-neutral-400">Aucun article pour le moment</p>
          </div>
        ) : (
          <>
            {!category && posts.length > 0 && (
              <Link href={`/${locale}/blog/${posts[0].slug}`} className="group mb-8 block overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm hover:shadow-md transition">
                <div className="grid md:grid-cols-2">
                  <div className="h-48 overflow-hidden bg-neutral-100">
                    {posts[0].cover_image ? <img src={posts[0].cover_image} alt="" className="h-full w-full object-cover group-hover:scale-105 transition" /> : <div className="flex h-full items-center justify-center text-6xl text-neutral-200">{posts[0].blog_categories?.icon || "📄"}</div>}
                  </div>
                  <div className="flex flex-col justify-center p-6">
                    {posts[0].blog_categories && <span className="mb-3 inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ backgroundColor: posts[0].blog_categories.color }}>{posts[0].blog_categories.icon} {posts[0].blog_categories.name}</span>}
                    <h2 className="text-xl font-bold leading-tight group-hover:text-emerald-600 transition">{posts[0].title}</h2>
                    {posts[0].excerpt && <p className="mt-2 text-sm text-neutral-500 line-clamp-2">{posts[0].excerpt}</p>}
                    <p className="mt-3 text-xs text-neutral-400">{fmt(posts[0].published_at)} · {posts[0].view_count} vues</p>
                  </div>
                </div>
              </Link>
            )}
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {posts.slice(!category ? 1 : 0).map((post: any) => (
                <Link key={post.id} href={`/${locale}/blog/${post.slug}`} className="group overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm hover:shadow-md transition">
                  <div className="h-36 overflow-hidden bg-neutral-100">
                    {post.cover_image ? <img src={post.cover_image} alt="" className="h-full w-full object-cover group-hover:scale-105 transition" /> : <div className="flex h-full items-center justify-center text-3xl text-neutral-200">{post.blog_categories?.icon || "📄"}</div>}
                  </div>
                  <div className="p-3">
                    {post.blog_categories && <span className="mb-1.5 inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold text-white" style={{ backgroundColor: post.blog_categories.color }}>{post.blog_categories.icon} {post.blog_categories.name}</span>}
                    <h3 className="text-sm font-semibold leading-snug group-hover:text-emerald-600 transition line-clamp-2">{post.title}</h3>
                    {post.excerpt && <p className="mt-1.5 text-xs text-neutral-500 line-clamp-2">{post.excerpt}</p>}
                    <p className="mt-2 text-[10px] text-neutral-400">{fmt(post.published_at)} · {post.view_count} vues</p>
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