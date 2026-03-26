import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function isAdmin(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("sb-access-token")?.value;
  if (!token) return false;
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return false;
  const { data } = await supabaseAdmin
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  return data?.role === "admin";
}

// GET — public (published) or admin (all)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const admin = searchParams.get("admin") === "true";
  const slug = searchParams.get("slug");
  const category = searchParams.get("category");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "12");
  const offset = (page - 1) * limit;

  // Single post by slug
  if (slug) {
    const { data: post } = await supabaseAdmin
      .from("blog_posts")
      .select("*, blog_categories(name, slug, color, icon)")
      .eq("slug", slug)
      .single();

    if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (post.status !== "published" && !admin) {
      const adminOk = await isAdmin(req);
      if (!adminOk) return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Increment view count (fire and forget)
    if (!admin) {
      supabaseAdmin
        .from("blog_posts")
        .update({ view_count: (post.view_count || 0) + 1 })
        .eq("id", post.id)
        .then(() => {});
    }

    return NextResponse.json(post);
  }

  // List posts
  let query = supabaseAdmin
    .from("blog_posts")
    .select("id, title, slug, excerpt, cover_image, category_id, tags, status, author_name, view_count, published_at, created_at, updated_at, blog_categories(name, slug, color, icon)", { count: "exact" });

  if (admin) {
    const adminOk = await isAdmin(req);
    if (!adminOk) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    query = query.order("updated_at", { ascending: false });
  } else {
    query = query.eq("status", "published").order("published_at", { ascending: false });
  }

  if (category) {
    const { data: cat } = await supabaseAdmin
      .from("blog_categories")
      .select("id")
      .eq("slug", category)
      .single();
    if (cat) query = query.eq("category_id", cat.id);
  }

  query = query.range(offset, offset + limit - 1);

  const { data: posts, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ posts: posts || [], total: count || 0, page, limit });
}

// POST — create new post (admin only)
export async function POST(req: NextRequest) {
  const adminOk = await isAdmin(req);
  if (!adminOk) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    title, slug, excerpt, content, cover_image,
    category_id, tags, status, author_name,
    meta_title, meta_description, og_image,
  } = body;

  if (!title || !slug) {
    return NextResponse.json({ error: "Title and slug required" }, { status: 400 });
  }

  const insertData: Record<string, unknown> = {
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
  };

  const { data, error } = await supabaseAdmin
    .from("blog_posts")
    .insert(insertData)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PUT — update post (admin only)
export async function PUT(req: NextRequest) {
  const adminOk = await isAdmin(req);
  if (!adminOk) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  if (updates.status === "published") {
    const { data: existing } = await supabaseAdmin
      .from("blog_posts")
      .select("published_at")
      .eq("id", id)
      .single();
    if (existing && !existing.published_at) {
      updates.published_at = new Date().toISOString();
    }
  }

  if (updates.slug) {
    updates.slug = updates.slug.toLowerCase().replace(/[^a-z0-9-]/g, "");
  }

  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("blog_posts")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE — delete post (admin only)
export async function DELETE(req: NextRequest) {
  const adminOk = await isAdmin(req);
  if (!adminOk) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("blog_posts")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}