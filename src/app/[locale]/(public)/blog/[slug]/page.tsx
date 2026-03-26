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

async function getPost(slug: string) {
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

  const articleUrl = `https://pronos.club/${locale}/blog/${post.slug}`;

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

      <main className="min-h-screen bg-white text-neutral-900">
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
          <div className="mb-6 flex items-center gap-2 text-xs text-neutral-400">
            <Link href={`/${locale}/blog`} className="hover:text-neutral-600 transition">
              Blog
            </Link>
            {post.blog_categories && (
              <>
                <span>›</span>
                <Link
                  href={`/${locale}/blog?category=${post.blog_categories.slug}`}
                  className="hover:text-neutral-600 transition"
                  style={{ color: post.blog_categories.color }}
                >
                  {post.blog_categories.icon} {post.blog_categories.name}
                </Link>
              </>
            )}
          </div>

          <h1 className="text-3xl font-black leading-tight tracking-tight text-neutral-900 sm:text-4xl lg:text-5xl">
            {post.title}
          </h1>

          <div className="mt-4 flex items-center gap-4 text-sm text-neutral-400">
            <span>{fmt(post.published_at)}</span>
            <span>·</span>
            <span>{post.view_count} vue{post.view_count > 1 ? "s" : ""}</span>
            <span>·</span>
            <span>Par {post.author_name}</span>
          </div>

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {post.tags.map((tag: string) => (
                <span
                  key={tag}
                  className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-500"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Content */}
          <div
            className="blog-article-content mt-10"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />

          <style dangerouslySetInnerHTML={{ __html: `
            .blog-article-content { color: #374151; font-size: 1.125rem; line-height: 1.75; }
            .blog-article-content h2 { font-size: 1.5rem; font-weight: 700; color: #111827; margin-top: 2.5rem; margin-bottom: 1rem; }
            .blog-article-content h3 { font-size: 1.25rem; font-weight: 700; color: #111827; margin-top: 2rem; margin-bottom: 0.75rem; }
            .blog-article-content h4 { font-size: 1.125rem; font-weight: 700; color: #111827; margin-top: 1.5rem; margin-bottom: 0.5rem; }
            .blog-article-content p { margin-bottom: 1.25rem; line-height: 1.75; color: #374151; }
            .blog-article-content strong { color: #111827; font-weight: 700; }
            .blog-article-content em { font-style: italic; }
            .blog-article-content u { text-decoration: underline; }
            .blog-article-content a { color: #059669; text-decoration: none; }
            .blog-article-content a:hover { text-decoration: underline; }
            .blog-article-content ul { list-style-type: disc; padding-left: 1.5rem; margin-bottom: 1.25rem; }
            .blog-article-content ol { list-style-type: decimal; padding-left: 1.5rem; margin-bottom: 1.25rem; }
            .blog-article-content li { margin-bottom: 0.25rem; color: #374151; }
            .blog-article-content blockquote { border-left: 4px solid #10b981; padding-left: 1rem; color: #6b7280; font-style: italic; margin: 1.5rem 0; }
            .blog-article-content img { border-radius: 12px; max-width: 100%; height: auto; margin: 2rem auto; display: block; }
            .blog-article-content hr { border: none; border-top: 1px solid #e5e7eb; margin: 2.5rem 0; }
            .blog-article-content iframe { width: 100%; aspect-ratio: 16/9; border-radius: 12px; margin: 2rem 0; border: none; }
            .blog-article-content br { display: block; content: ""; margin-top: 0.5rem; }
          `}} />

          {/* Share buttons */}
          <div className="mt-12 flex flex-wrap items-center gap-3 border-t border-neutral-200 pt-8">
            <span className="text-sm font-medium text-neutral-400">Partager :</span>
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(articleUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-neutral-900 px-4 py-2 text-xs font-medium text-white hover:bg-neutral-700 transition"
            >
              𝕏 Twitter
            </a>
            <a
              href={`https://t.me/share/url?url=${encodeURIComponent(articleUrl)}&text=${encodeURIComponent(post.title)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-[#0088cc] px-4 py-2 text-xs font-medium text-white hover:bg-[#006699] transition"
            >
              ✈️ Telegram
            </a>
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(articleUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-[#1877F2] px-4 py-2 text-xs font-medium text-white hover:bg-[#0d65d9] transition"
            >
              📘 Facebook
            </a>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(post.title + " " + articleUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-[#25D366] px-4 py-2 text-xs font-medium text-white hover:bg-[#1da851] transition"
            >
              💬 WhatsApp
            </a>
            <a
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(articleUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-[#0A66C2] px-4 py-2 text-xs font-medium text-white hover:bg-[#084e96] transition"
            >
              💼 LinkedIn
            </a>
          </div>

          {/* CTA */}
          <div className="mt-12 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
            <p className="text-lg font-bold text-neutral-900">Recevez nos pronostics premium</p>
            <p className="mt-1 text-sm text-neutral-500">
              Plus de 50 pronostics par mois · Historique transparent · Groupe Telegram exclusif
            </p>
            <Link
              href={`/${locale}/abonnement`}
              className="mt-4 inline-block rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 transition"
            >
              Découvrir Premium — 20€/mois
            </Link>
          </div>
        </article>

        {/* Related articles */}
        {related.length > 0 && (
          <section className="border-t border-neutral-200 bg-neutral-50">
            <div className="mx-auto max-w-6xl px-4 py-12">
              <h2 className="mb-6 text-lg font-bold text-neutral-900">Articles similaires</h2>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((r: any) => (
                  <Link
                    key={r.id}
                    href={`/${locale}/blog/${r.slug}`}
                    className="group overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm hover:shadow-md transition"
                  >
                    <div className="aspect-video overflow-hidden bg-neutral-100">
                      {r.cover_image ? (
                        <img src={r.cover_image} alt="" className="h-full w-full object-cover group-hover:scale-105 transition" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-3xl text-neutral-200">
                          {r.blog_categories?.icon || "📄"}
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="text-sm font-semibold text-neutral-900 line-clamp-2 group-hover:text-emerald-600 transition">
                        {r.title}
                      </h3>
                      <p className="mt-2 text-[10px] text-neutral-400">{fmt(r.published_at)}</p>
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