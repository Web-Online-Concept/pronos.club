// src/app/api/tipster-concours-config/route.ts
// Config du concours tipsters : GET public, PATCH admin

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── GET : retourne la config (public) ──
export async function GET() {
  try {
    const { data: configs } = await supabaseAdmin
      .from("tipster_concours_config")
      .select("*")
      .order("period_type");

    const map: any = { week: null, month: null };
    for (const c of configs || []) {
      map[c.period_type] = {
        prize_amount: Number(c.prize_amount),
        min_picks: c.min_picks,
        active: c.active,
      };
    }

    // Fallback sécurité si table vide
    if (!map.week) map.week = { prize_amount: 10, min_picks: 3, active: true };
    if (!map.month) map.month = { prize_amount: 40, min_picks: 10, active: true };

    return NextResponse.json(map);
  } catch (err: any) {
    console.error("[tipster-concours-config] GET error:", err.message);
    return NextResponse.json({
      week: { prize_amount: 10, min_picks: 3, active: true },
      month: { prize_amount: 40, min_picks: 10, active: true },
    });
  }
}

// ── PATCH : admin seulement ──
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabaseAdmin
    .from("users")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { period_type, prize_amount, min_picks, active } = body;

  if (!["week", "month"].includes(period_type)) {
    return NextResponse.json({ error: "Invalid period_type" }, { status: 400 });
  }

  const updateData: any = { updated_at: new Date().toISOString() };
  if (prize_amount !== undefined) {
    const n = parseFloat(String(prize_amount));
    if (isNaN(n) || n < 0) return NextResponse.json({ error: "Prize invalide" }, { status: 400 });
    updateData.prize_amount = n;
  }
  if (min_picks !== undefined) {
    const n = parseInt(String(min_picks), 10);
    if (isNaN(n) || n < 1) return NextResponse.json({ error: "Min picks invalide" }, { status: 400 });
    updateData.min_picks = n;
  }
  if (typeof active === "boolean") {
    updateData.active = active;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("tipster_concours_config")
      .update(updateData)
      .eq("period_type", period_type)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ config: data });
  } catch (err: any) {
    console.error("[tipster-concours-config] PATCH error:", err.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}