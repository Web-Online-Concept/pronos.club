import Link from "next/link";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Category {
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
  content: string;
  cover_image: string | null;
  category_id: string | null;
  tags: string[];
  author_name: string;
  view_count: number;
  meta_title: string | null;
  meta_description: string | null;
  og_image: string | null;
  published_at: string;
  blog_categories: Category | null;
}

async function getPost(slug: string): Promise<Post | null> {
  const { data: post } = await supabaseAdmin
    .from("blog_posts")
    .select("*, blog_categories(name, slug, color, icon)")
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (!post) return null;

  // Increment view count (fire and forget)
  supabaseAdmin
    .from("blog_posts")
    .update({ view_count: (post.view_count || 0) + 1 })
    .eq("id", post.id)
    .then(() => {});

  return post;
}

async function getRelated(categorySlug: string | undefined, currentSlug: string) {
  if (!categorySlug) return [];

  const { data: cat } = await supabaseAdmin
    .from("blog_categories")
    .select("id")
    .eq("slug", categorySlug)
    .single();

  if (!cat) return [];

  const { data: posts } = await supabaseAdmin
    .from("blog_posts")
    .select("id, title, slug, cover_image, published_at, blog_categories(name, slug, color, icon)")
    .eq("status", "published")
    .eq("category_id", cat.id)
    .neq("slug", currentSlug)
    .order("published_at", { ascending: false })
    .limit(3);

  return posts || [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: "Article introuvable" };

  return {
    title: `${post.meta_title || post.title} — PRONOS.CLUB`,
    description: post.meta_description || post.excerpt || "",
    openGraph: {
      title: post.meta_title || post.title,
      description: post.meta_description || post.excerpt || "",
      images: post.og_image || post.cover_image ? [{ url: (post.og_image || post.cover_image)! }] : [],
      type: "article",
      publishedTime: post.published_at,
    },
    twitter: {
      card: "summary_large_image",
      title: post.meta_title || post.title,
      description: post.meta_description || post.excerpt || "",
    },
  };
}

export default async function BlogArticlePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  const related = await getRelated(post.blog_categories?.slug, post.slug);

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt || "",
    image: post.cover_image || undefined,
    datePublished: post.published_at,
    author: {
      "@type": "Organization",
      name: post.author_name || "PRONOS.CLUB",
    },
    publisher: {
      "@type": "Organization",
      name: "PRONOS.CLUB",
      url: "https://pronos.club",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main className="min-h-screen bg-[#0a0a0f] text-white">
        {/* Cover image */}
        {post.cover_image && (
          <div className="relative mx-auto max-w-5xl px-4 pt-8">
            <div className="overflow-hidden rounded-2xl">
              <img
                src={post.cover_image}
                alt={post.title}
                className="w-full max-h-[480px] object-cover"
              />
            </div>
          </div>
        )}

        {/* Article header */}
        <article className="mx-auto max-w-3xl px-4 pt-10 pb-16">
          {/* Breadcrumb */}
          <div className="mb-6 flex items-center gap-2 text-xs text-white/30">
            <Link href={`/${locale}/blog`} className="hover:text-white/60 transition">
              Blog
            </Link>
            {post.blog_categories && (
              <>
                <span>›</span>
                <Link
                  href={`/${locale}/blog?category=${post.blog_categories.slug}`}
                  className="hover:text-white/60 transition"
                  style={{ color: post.blog_categories.color }}
                >
                  {post.blog_categories.icon} {post.blog_categories.name}
                </Link>
              </>
            )}
          </div>

          <h1 className="text-3xl font-black leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            {post.title}
          </h1>

          <div className="mt-4 flex items-center gap-4 text-sm text-white/40">
            <span>{fmt(post.published_at)}</span>
            <span>·</span>
            <span>{post.view_count} vue{post.view_count > 1 ? "s" : ""}</span>
            <span>·</span>
            <span>Par {post.author_name}</span>
          </div>

          {/* Tags */}
          {post.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {post.tags.map((tag: string) => (
                <span
                  key={tag}
                  className="rounded-full bg-white/[0.06] px-3 py-1 text-xs text-white/40"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Content */}
          <div
            className={[
              "mt-10",
              "prose prose-invert prose-emerald max-w-none",
              "prose-headings:font-bold prose-headings:tracking-tight",
              "prose-h2:mt-10 prose-h2:text-2xl",
              "prose-h3:mt-8 prose-h3:text-xl",
              "prose-p:text-white/75 prose-p:leading-relaxed",
              "prose-a:text-emerald-400 prose-a:no-underline hover:prose-a:underline",
              "prose-strong:text-white",
              "prose-blockquote:border-l-emerald-500 prose-blockquote:text-white/60",
              "prose-img:rounded-xl prose-img:mx-auto",
              "prose-ul:text-white/75 prose-ol:text-white/75",
              "prose-li:marker:text-emerald-500",
              "[&_iframe]:rounded-xl [&_iframe]:w-full [&_iframe]:aspect-video",
            ].join(" ")}
            dangerouslySetInnerHTML={{ __html: post.content }}
          />

          {/* Share */}
          <div className="mt-12 flex items-center gap-3 border-t border-white/[0.06] pt-8">
            <span className="text-sm text-white/30">Partager :</span>
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(`https://pronos.club/${locale}/blog/${post.slug}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs text-white/50 hover:bg-white/10 hover:text-white transition"
            >
              𝕏 Twitter
            </a>
            <a
              href={`https://t.me/share/url?url=${encodeURIComponent(`https://pronos.club/${locale}/blog/${post.slug}`)}&text=${encodeURIComponent(post.title)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs text-white/50 hover:bg-white/10 hover:text-white transition"
            >
              Telegram
            </a>
          </div>

          {/* CTA */}
          <div className="mt-12 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center">
            <p className="text-lg font-bold">Recevez nos pronostics premium</p>
            <p className="mt-1 text-sm text-white/50">
              Plus de 50 pronostics par mois · Historique transparent · Groupe Telegram exclusif
            </p>
            <Link
              href={`/${locale}/abonnement`}
              className="mt-4 inline-block rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold hover:bg-emerald-500 transition"
            >
              Découvrir Premium — 20€/mois
            </Link>
          </div>
        </article>

        {/* Related articles */}
        {related.length > 0 && (
          <section className="border-t border-white/[0.06] bg-white/[0.01]">
            <div className="mx-auto max-w-6xl px-4 py-12">
              <h2 className="mb-6 text-lg font-bold">Articles similaires</h2>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((r: any) => (
                  <Link
                    key={r.id}
                    href={`/${locale}/blog/${r.slug}`}
                    className="group overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition"
                  >
                    <div className="aspect-video overflow-hidden bg-white/[0.03]">
                      {r.cover_image ? (
                        <img src={r.cover_image} alt="" className="h-full w-full object-cover group-hover:scale-105 transition" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-3xl text-white/10">
                          {r.blog_categories?.icon || "📄"}
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="text-sm font-semibold line-clamp-2 group-hover:text-emerald-400 transition">
                        {r.title}
                      </h3>
                      <p className="mt-2 text-[10px] text-white/25">{fmt(r.published_at)}</p>
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