import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const admin = searchParams.get("admin") === "true";
  const slug = searchParams.get("slug");
  const category = searchParams.get("category");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "12");
  const offset = (page - 1) * limit;

  if (slug) {
    const { data: post } = await supabaseAdmin
      .from("blog_posts")
      .select("*, blog_categories(name, slug, color, icon)")
      .eq("slug", slug)
      .single();

    if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (post.status !== "published" && !admin) {
      try { await requireAdmin(); } catch {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    }

    if (!admin) {
      supabaseAdmin.from("blog_posts").update({ view_count: (post.view_count || 0) + 1 }).eq("id", post.id).then(() => {});
    }

    return NextResponse.json(post);
  }

  let query = supabaseAdmin
    .from("blog_posts")
    .select("id, title, slug, excerpt, cover_image, category_id, tags, status, author_name, view_count, published_at, created_at, updated_at, blog_categories(name, slug, color, icon)", { count: "exact" });

  if (admin) {
    try { await requireAdmin(); } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    query = query.order("updated_at", { ascending: false });
  } else {
    query = query.eq("status", "published").order("published_at", { ascending: false });
  }

  if (category) {
    const { data: cat } = await supabaseAdmin.from("blog_categories").select("id").eq("slug", category).single();
    if (cat) query = query.eq("category_id", cat.id);
  }

  query = query.range(offset, offset + limit - 1);
  const { data: posts, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ posts: posts || [], total: count || 0, page, limit });
}

export async function POST(request: Request) {
  try { await requireAdmin(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { title, slug, excerpt, content, cover_image, category_id, tags, status, author_name, meta_title, meta_description, og_image } = body;

  if (!title || !slug) return NextResponse.json({ error: "Title and slug required" }, { status: 400 });

  const { data, error } = await supabaseAdmin.from("blog_posts").insert({
    title,
    slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, ""),
    excerpt: excerpt || null,
    content: content || "",
    cover_image: cover_image || null,
    category_id: category_id || null,
    tags: tags || [],
    status: status || "draft",
    author_name: author_name || "PRONOS.CLUB",
    meta_title: meta_title || null,
    meta_description: meta_description || null,
    og_image: og_image || null,
    published_at: status === "published" ? new Date().toISOString() : null,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  try { await requireAdmin(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  if (updates.status === "published") {
    const { data: existing } = await supabaseAdmin.from("blog_posts").select("published_at").eq("id", id).single();
    if (existing && !existing.published_at) updates.published_at = new Date().toISOString();
  }

  if (updates.slug) updates.slug = updates.slug.toLowerCase().replace(/[^a-z0-9-]/g, "");
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin.from("blog_posts").update(updates).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  try { await requireAdmin(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  const { error } = await supabaseAdmin.from("blog_posts").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}