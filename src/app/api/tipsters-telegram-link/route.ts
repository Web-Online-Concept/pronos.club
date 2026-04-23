// src/app/api/tipsters-telegram-link/route.ts
// Ge\u0301ne\u0300re un token temporaire pour lier un chat_id Telegram

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

// ── POST : ge\u0301ne\u0300re un token unique (valable 15 min) ──
export async function POST() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Token al\u00e9atoire 8 caracte\u0300res
    const token = Math.random().toString(36).slice(2, 10).toUpperCase();
    const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await supabaseAdmin
      .from("users")
      .update({
        tipsters_telegram_link_token: token,
        tipsters_telegram_link_expires: expires,
      })
      .eq("id", user.id);

    const botUsername = process.env.TIPSTERS_TELEGRAM_BOT_USERNAME || "pronos_abonnes_club_bot";
    const deepLink = `https://t.me/${botUsername}?start=${token}`;

    return NextResponse.json({
      token,
      deep_link: deepLink,
      expires_at: expires,
      bot_username: botUsername,
    });
  } catch (err: any) {
    console.error("[tipsters-telegram-link] POST error:", err.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ── DELETE : d\u00e9lier le chat_id ──
export async function DELETE() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await supabaseAdmin
      .from("users")
      .update({
        tipsters_telegram_chat_id: null,
        tipsters_telegram_link_token: null,
        tipsters_telegram_link_expires: null,
      })
      .eq("id", user.id);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[tipsters-telegram-link] DELETE error:", err.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ── GET : statut actuel (li\u00e9 ou pas) ──
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { data } = await supabaseAdmin
      .from("users")
      .select("tipsters_telegram_chat_id")
      .eq("id", user.id)
      .single();

    return NextResponse.json({
      linked: !!data?.tipsters_telegram_chat_id,
    });
  } catch (err: any) {
    return NextResponse.json({ linked: false });
  }
}