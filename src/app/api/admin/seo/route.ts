import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  try { await requireAdmin(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Blog stats
  const { data: posts } = await supabaseAdmin
    .from("blog_posts")
    .select("id, title, slug, view_count, status, published_at, excerpt, blog_categories(name)")
    .order("view_count", { ascending: false });

  const allPosts = posts || [];
  const publishedPosts = allPosts.filter(p => p.status === "published");
  const draftPosts = allPosts.filter(p => p.status === "draft");
  const totalViews = publishedPosts.reduce((s, p) => s + (p.view_count || 0), 0);
  const topPosts = publishedPosts.slice(0, 10);
  const postsWithoutExcerpt = publishedPosts.filter(p => !p.excerpt).length;

  // Categories
  const { data: categories } = await supabaseAdmin
    .from("blog_categories")
    .select("name, slug");

  // Category distribution
  const categoryStats: Record<string, number> = {};
  for (const post of publishedPosts) {
    const catName = (post.blog_categories as any)?.name || "Sans catégorie";
    categoryStats[catName] = (categoryStats[catName] || 0) + 1;
  }

  // Bilans
  const { count: bilansCount } = await supabaseAdmin
    .from("bilans")
    .select("id", { count: "exact" })
    .eq("is_published", true);

  // Users
  const { count: totalUsers } = await supabaseAdmin
    .from("users")
    .select("id", { count: "exact" });

  const { count: premiumUsers } = await supabaseAdmin
    .from("users")
    .select("id", { count: "exact" })
    .eq("subscription_status", "active");

  // Bookmakers pages (static = 6)
  const bookmakerPages = 6;

  // Sitemap page count
  const staticPages = 21; // from sitemap config
  const sitemapTotal = (staticPages + publishedPosts.length + (bilansCount || 0)) * 3; // x3 for 3 locales

  // Posts per month (last 6 months)
  const now = new Date();
  const monthlyPosts: { month: string; count: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const monthLabel = d.toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
    const count = publishedPosts.filter(p => p.published_at?.startsWith(monthKey)).length;
    monthlyPosts.push({ month: monthLabel, count });
  }

  // Average views per post
  const avgViews = publishedPosts.length > 0 ? Math.round(totalViews / publishedPosts.length) : 0;

  return NextResponse.json({
    blog: {
      published: publishedPosts.length,
      drafts: draftPosts.length,
      totalViews,
      avgViews,
      topPosts: topPosts.map(p => ({ title: p.title, slug: p.slug, views: p.view_count || 0 })),
      postsWithoutExcerpt,
      categoryStats,
      monthlyPosts,
    },
    site: {
      sitemapPages: sitemapTotal,
      totalUsers: totalUsers || 0,
      premiumUsers: premiumUsers || 0,
      bilansPublished: bilansCount || 0,
      bookmakerPages,
      categories: (categories || []).length,
    },
  });
}