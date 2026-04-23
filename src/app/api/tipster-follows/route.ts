// src/app/api/tipster-follows/route.ts
// Gestion des follows (suivre/d\u00e9suivre un tipster + lister ses follows)

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getAuthUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// ── GET : lister les tipsters suivis par le user connect\u00e9 + stats d'un tipster ──
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") || "my_follows";

  if (action === "my_follows") {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
      const { data: follows } = await supabaseAdmin
        .from("tipster_follows")
        .select(`
          tipster_id,
          channel_email,
          channel_telegram,
          channel_push,
          created_at,
          tipster:tipster_id (id, pseudo, avatar_url)
        `)
        .eq("follower_id", user.id)
        .order("created_at", { ascending: false });

      return NextResponse.json({ follows: follows || [] });
    } catch (err: any) {
      console.error("[tipster-follows] GET my_follows error:", err.message);
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
  }

  if (action === "check") {
    // V\u00e9rifier si l'user connect\u00e9 suit un tipster pr\u00e9cis
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ following: false });

    const tipsterId = searchParams.get("tipster_id");
    if (!tipsterId) return NextResponse.json({ error: "Missing tipster_id" }, { status: 400 });

    try {
      const { data } = await supabaseAdmin
        .from("tipster_follows")
        .select("follower_id, channel_email, channel_telegram, channel_push")
        .eq("follower_id", user.id)
        .eq("tipster_id", tipsterId)
        .maybeSingle();

      return NextResponse.json({
        following: !!data,
        channels: data ? {
          email: data.channel_email,
          telegram: data.channel_telegram,
          push: data.channel_push,
        } : null,
      });
    } catch (err: any) {
      return NextResponse.json({ following: false });
    }
  }

  if (action === "count") {
    // Nombre de followers d'un tipster (public)
    const tipsterId = searchParams.get("tipster_id");
    if (!tipsterId) return NextResponse.json({ error: "Missing tipster_id" }, { status: 400 });

    try {
      const { count } = await supabaseAdmin
        .from("tipster_follows")
        .select("follower_id", { count: "exact", head: true })
        .eq("tipster_id", tipsterId);

      return NextResponse.json({ count: count || 0 });
    } catch {
      return NextResponse.json({ count: 0 });
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

// ── POST : suivre un tipster ──
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { tipster_id } = body;
  if (!tipster_id) return NextResponse.json({ error: "Missing tipster_id" }, { status: 400 });
  if (tipster_id === user.id) return NextResponse.json({ error: "Tu ne peux pas te suivre toi-m\u00eame" }, { status: 400 });

  try {
    const { error } = await supabaseAdmin
      .from("tipster_follows")
      .upsert({
        follower_id: user.id,
        tipster_id,
        channel_email: true,
        channel_telegram: true,
        channel_push: true,
      });

    if (error) throw error;
    return NextResponse.json({ success: true, following: true });
  } catch (err: any) {
    console.error("[tipster-follows] POST error:", err.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ── PATCH : modifier les canaux actifs pour un tipster suivi ──
export async function PATCH(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { tipster_id, channel_email, channel_telegram, channel_push } = body;
  if (!tipster_id) return NextResponse.json({ error: "Missing tipster_id" }, { status: 400 });

  try {
    const updateData: any = {};
    if (typeof channel_email === "boolean") updateData.channel_email = channel_email;
    if (typeof channel_telegram === "boolean") updateData.channel_telegram = channel_telegram;
    if (typeof channel_push === "boolean") updateData.channel_push = channel_push;

    const { error } = await supabaseAdmin
      .from("tipster_follows")
      .update(updateData)
      .eq("follower_id", user.id)
      .eq("tipster_id", tipster_id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[tipster-follows] PATCH error:", err.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ── DELETE : d\u00e9suivre un tipster ──
export async function DELETE(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const tipsterId = searchParams.get("tipster_id");
  if (!tipsterId) return NextResponse.json({ error: "Missing tipster_id" }, { status: 400 });

  try {
    const { error } = await supabaseAdmin
      .from("tipster_follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("tipster_id", tipsterId);

    if (error) throw error;
    return NextResponse.json({ success: true, following: false });
  } catch (err: any) {
    console.error("[tipster-follows] DELETE error:", err.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}