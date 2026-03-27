import Link from "next/link";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function getPost(slug: string) {
  const { data: post } = await supabaseAdmin.from("blog_posts")
    .select("*, blog_categories(name, slug, color, icon)")
    .eq("slug", slug).eq("status", "published").single();
  if (!post) return null;
  supabaseAdmin.from("blog_posts").update({ view_count: (post.view_count || 0) + 1 }).eq("id", post.id).then(() => {});
  return post;
}

async function getRelated(catSlug: string | undefined, currentSlug: string) {
  if (!catSlug) return [];
  const { data: cat } = await supabaseAdmin.from("blog_categories").select("id").eq("slug", catSlug).single();
  if (!cat) return [];
  const { data } = await supabaseAdmin.from("blog_posts")
    .select("id, title, slug, cover_image, published_at, blog_categories(name, slug, color, icon)")
    .eq("status", "published").eq("category_id", cat.id).neq("slug", currentSlug)
    .order("published_at", { ascending: false }).limit(3);
  return data || [];
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: "Article introuvable" };
  return {
    title: `${post.meta_title || post.title} — PRONOS.CLUB`,
    description: post.meta_description || post.excerpt || "",
    openGraph: {
      title: post.meta_title || post.title,
      description: post.meta_description || post.excerpt || "",
      images: post.cover_image ? [{ url: post.cover_image }] : [],
      type: "article",
      publishedTime: post.published_at,
    },
    twitter: { card: "summary_large_image", title: post.meta_title || post.title, description: post.meta_description || post.excerpt || "" },
  };
}

export default async function BlogArticlePage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  const related = await getRelated(post.blog_categories?.slug, post.slug);
  const fmt = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const articleUrl = `https://pronos.club/${locale}/blog/${post.slug}`;

  const jsonLd = {
    "@context": "https://schema.org", "@type": "Article",
    headline: post.title, description: post.excerpt || "", image: post.cover_image || undefined,
    datePublished: post.published_at,
    author: { "@type": "Organization", name: post.author_name || "PRONOS.CLUB" },
    publisher: { "@type": "Organization", name: "PRONOS.CLUB", url: "https://pronos.club" },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700;900&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />

      <main className="min-h-screen bg-white">
        {post.cover_image && (
          <div className="mx-auto max-w-4xl px-4 pt-8">
            <div className="overflow-hidden rounded-2xl">
              <img src={post.cover_image} alt={post.title} className="w-full max-h-[420px] object-cover" />
            </div>
          </div>
        )}

        <article className="mx-auto max-w-4xl px-4 pt-10 pb-16" style={{ fontFamily: "'Inter', sans-serif" }}>
          {/* Breadcrumb */}
          <div className="mb-8 flex items-center gap-2 text-xs" style={{ color: "#9ca3af" }}>
            <Link href={`/${locale}/blog`} className="hover:text-neutral-600 transition">Blog</Link>
            {post.blog_categories && (
              <>
                <span>›</span>
                <Link href={`/${locale}/blog?category=${post.blog_categories.slug}`} className="font-medium hover:opacity-80 transition" style={{ color: post.blog_categories.color }}>{post.blog_categories.icon} {post.blog_categories.name}</Link>
              </>
            )}
          </div>

          {/* Title */}
          <h1 style={{ fontFamily: "'Merriweather', Georgia, serif", fontSize: "2rem", fontWeight: 900, lineHeight: 1.3, color: "#111827", letterSpacing: "-0.02em", marginBottom: "1rem" }}>
            {post.title}
          </h1>

          {/* Author */}
          <div className="flex items-center gap-3 pb-8 mb-8" style={{ borderBottom: "1px solid #e5e7eb" }}>
            <img src="/pronos_club.png" alt="PRONOS.CLUB" className="h-10 w-10 rounded-full object-contain" />
            <div>
              <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "#111827" }}>{post.author_name || "PRONOS.CLUB"}</p>
              <p style={{ fontSize: "0.75rem", color: "#9ca3af" }}>{fmt(post.published_at)} · {post.view_count} vue{post.view_count > 1 ? "s" : ""}</p>
            </div>
          </div>

          {/* CONTENT — uses the SAME .blog-content class as the editor */}
          <div className="blog-content" dangerouslySetInnerHTML={{ __html: post.content }} />

          {/* Tags */}
          {post.tags?.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-12 pt-8" style={{ borderTop: "1px solid #e5e7eb" }}>
              {post.tags.map((tag: string) => (
                <span key={tag} style={{ background: "#f3f4f6", color: "#6b7280", fontSize: "0.75rem", padding: "0.25rem 0.75rem", borderRadius: "9999px" }}>#{tag}</span>
              ))}
            </div>
          )}

          {/* Share */}
          <div className={`${post.tags?.length > 0 ? "mt-6" : "mt-12 pt-8"} flex flex-wrap items-center gap-3`} style={post.tags?.length > 0 ? undefined : { borderTop: "1px solid #e5e7eb" }}>
            <span style={{ fontSize: "0.8125rem", fontWeight: 500, color: "#9ca3af" }}>Partager :</span>
            {[
              { label: "𝕏", href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(articleUrl)}`, bg: "#0f1419" },
              { label: "Telegram", href: `https://t.me/share/url?url=${encodeURIComponent(articleUrl)}&text=${encodeURIComponent(post.title)}`, bg: "#0088cc" },
              { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(articleUrl)}`, bg: "#1877F2" },
              { label: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(post.title + " " + articleUrl)}`, bg: "#25D366" },
              { label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(articleUrl)}`, bg: "#0A66C2" },
            ].map(s => (
              <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" style={{ background: s.bg, color: "white", fontSize: "0.75rem", fontWeight: 500, padding: "0.5rem 1rem", borderRadius: "8px", textDecoration: "none" }}>{s.label}</a>
            ))}
          </div>

          {/* CTA */}
          <div style={{ marginTop: "3rem", padding: "2rem", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "16px", textAlign: "center" }}>
            <p style={{ fontSize: "1.125rem", fontWeight: 700, color: "#111827", margin: 0 }}>Recevez nos pronostics premium</p>
            <p style={{ fontSize: "0.875rem", color: "#6b7280", marginTop: "0.5rem" }}>Plus de 50 pronostics par mois · Historique transparent · Groupe Telegram exclusif</p>
            <Link href={`/${locale}/abonnement`} style={{ display: "inline-block", marginTop: "1rem", background: "#059669", color: "white", padding: "0.75rem 2rem", borderRadius: "12px", fontSize: "0.875rem", fontWeight: 600, textDecoration: "none" }}>Découvrir Premium — 20€/mois</Link>
          </div>
        </article>

        {/* Related */}
        {related.length > 0 && (
          <section style={{ borderTop: "1px solid #e5e7eb", background: "#fafafa" }}>
            <div className="mx-auto max-w-4xl px-4 py-12">
              <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#111827", marginBottom: "1.5rem" }}>Articles similaires</h2>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((r: any) => (
                  <Link key={r.id} href={`/${locale}/blog/${r.slug}`} className="group overflow-hidden rounded-xl bg-white transition" style={{ border: "1px solid #e5e7eb" }}>
                    <div className="aspect-video overflow-hidden" style={{ background: "#f3f4f6" }}>
                      {r.cover_image ? <img src={r.cover_image} alt="" className="h-full w-full object-cover group-hover:scale-105 transition" /> : <div className="flex h-full items-center justify-center text-3xl" style={{ color: "#d1d5db" }}>{r.blog_categories?.icon || "📄"}</div>}
                    </div>
                    <div style={{ padding: "1rem" }}>
                      <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "#111827", lineHeight: 1.4 }} className="line-clamp-2 group-hover:text-emerald-600 transition">{r.title}</h3>
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