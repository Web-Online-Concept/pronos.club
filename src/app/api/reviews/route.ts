import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin, requireAuth } from "@/lib/auth";
import { NextResponse } from "next/server";

// GET — public approved reviews OR admin all reviews
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const admin = searchParams.get("admin");

  if (admin === "true") {
    try {
      await requireAdmin();
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from("reviews")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // Public — only approved
  const { data, error } = await supabaseAdmin
    .from("reviews")
    .select("id, pseudo, avatar_url, rating, content, created_at")
    .eq("status", "approved")
    .order("approved_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST — user submits a review
export async function POST(request: Request) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Must be premium
  if (user.subscription_status !== "active") {
    return NextResponse.json({ error: "Premium subscription required" }, { status: 403 });
  }

  // Check if user already submitted a review
  const { data: existing } = await supabaseAdmin
    .from("reviews")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (existing) {
    return NextResponse.json({ error: "Vous avez déjà soumis un avis" }, { status: 400 });
  }

  const { rating, content } = await request.json();

  if (!rating || !content || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Note et contenu requis" }, { status: 400 });
  }

  if (content.length > 1000) {
    return NextResponse.json({ error: "Avis trop long (1000 caractères max)" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("reviews")
    .insert({
      user_id: user.id,
      pseudo: user.pseudo || user.display_name || user.email?.split("@")[0] || "Anonyme",
      avatar_url: user.avatar_url || null,
      rating,
      content,
      status: "pending",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PUT — admin approve/reject/edit
export async function PUT(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, status, content, admin_note } = await request.json();

  if (!id) return NextResponse.json({ error: "Missing review id" }, { status: 400 });

  const updateData: Record<string, unknown> = {};

  if (status) {
    updateData.status = status;
    if (status === "approved") {
      updateData.approved_at = new Date().toISOString();
    }
  }
  if (content !== undefined) updateData.content = content;
  if (admin_note !== undefined) updateData.admin_note = admin_note;

  const { data, error } = await supabaseAdmin
    .from("reviews")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE — admin delete
export async function DELETE(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "Missing review id" }, { status: 400 });

  const { error } = await supabaseAdmin.from("reviews").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}