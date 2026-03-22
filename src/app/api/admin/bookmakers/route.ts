import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("bookmakers")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: "Missing bookmaker id" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.slug !== undefined) updateData.slug = updates.slug;
  if (updates.logo_url !== undefined) updateData.logo_url = updates.logo_url;
  if (updates.affiliate_url !== undefined) updateData.affiliate_url = updates.affiliate_url || null;
  if (updates.description_fr !== undefined) updateData.description_fr = updates.description_fr || null;
  if (updates.description_en !== undefined) updateData.description_en = updates.description_en || null;
  if (updates.description_es !== undefined) updateData.description_es = updates.description_es || null;
  if (updates.is_arjel !== undefined) updateData.is_arjel = updates.is_arjel;
  if (updates.country !== undefined) updateData.country = updates.country || null;
  if (updates.bonus_fr !== undefined) updateData.bonus_fr = updates.bonus_fr || null;
  if (updates.bonus_en !== undefined) updateData.bonus_en = updates.bonus_en || null;
  if (updates.bonus_es !== undefined) updateData.bonus_es = updates.bonus_es || null;
  if (updates.pros_fr !== undefined) updateData.pros_fr = updates.pros_fr || null;
  if (updates.pros_en !== undefined) updateData.pros_en = updates.pros_en || null;
  if (updates.pros_es !== undefined) updateData.pros_es = updates.pros_es || null;
  if (updates.cons_fr !== undefined) updateData.cons_fr = updates.cons_fr || null;
  if (updates.cons_en !== undefined) updateData.cons_en = updates.cons_en || null;
  if (updates.cons_es !== undefined) updateData.cons_es = updates.cons_es || null;
  if (updates.rating !== undefined) updateData.rating = updates.rating;
  if (updates.is_featured !== undefined) updateData.is_featured = updates.is_featured;
  if (updates.video_url !== undefined) updateData.video_url = updates.video_url || null;
  if (updates.sort_order !== undefined) updateData.sort_order = updates.sort_order;

  const { data, error } = await supabaseAdmin
    .from("bookmakers")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}