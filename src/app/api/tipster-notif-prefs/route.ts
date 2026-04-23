// src/app/api/tipster-notif-prefs/route.ts
// Pr\u00e9f\u00e9rences globales de notifs Pronos Abonn\u00e9s

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

// ── GET : r\u00e9cup\u00e9rer les prefs du user connect\u00e9 ──
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { data } = await supabaseAdmin
      .from("tipster_notif_prefs")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!data) {
      // Pas encore de prefs : retourner les valeurs par d\u00e9faut
      return NextResponse.json({
        prefs: {
          mode: "none",
          channel_email: true,
          channel_telegram: false,
          channel_push: false,
        },
      });
    }

    return NextResponse.json({ prefs: data });
  } catch (err: any) {
    console.error("[tipster-notif-prefs] GET error:", err.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ── PATCH : mettre \u00e0 jour les prefs ──
export async function PATCH(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { mode, channel_email, channel_telegram, channel_push } = body;

  if (mode && !["none", "all", "selected"].includes(mode)) {
    return NextResponse.json({ error: "Mode invalide" }, { status: 400 });
  }

  try {
    const updateData: any = { updated_at: new Date().toISOString() };
    if (mode !== undefined) updateData.mode = mode;
    if (typeof channel_email === "boolean") updateData.channel_email = channel_email;
    if (typeof channel_telegram === "boolean") updateData.channel_telegram = channel_telegram;
    if (typeof channel_push === "boolean") updateData.channel_push = channel_push;

    // Upsert : cr\u00e9e la ligne si elle n'existe pas
    const { data: existing } = await supabaseAdmin
      .from("tipster_notif_prefs")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      const { error } = await supabaseAdmin
        .from("tipster_notif_prefs")
        .update(updateData)
        .eq("user_id", user.id);
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin
        .from("tipster_notif_prefs")
        .insert({
          user_id: user.id,
          mode: updateData.mode || "none",
          channel_email: updateData.channel_email ?? true,
          channel_telegram: updateData.channel_telegram ?? false,
          channel_push: updateData.channel_push ?? false,
        });
      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[tipster-notif-prefs] PATCH error:", err.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}