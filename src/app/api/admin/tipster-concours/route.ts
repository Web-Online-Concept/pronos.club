// src/app/api/admin/tipster-concours/route.ts
// Admin : calcul gagnants semaine/mois pr\u00e9c\u00e9dents + gestion paiements

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabaseAdmin
    .from("users")
    .select("id, is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) return null;
  return profile;
}

// ── Helpers ──
function getPreviousWeekBounds() {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const thisMonday = new Date(now);
  thisMonday.setDate(now.getDate() + diffToMonday);
  thisMonday.setHours(0, 0, 0, 0);

  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(thisMonday.getDate() - 7);
  const lastSunday = new Date(thisMonday);
  lastSunday.setDate(thisMonday.getDate() - 1);
  lastSunday.setHours(23, 59, 59, 999);

  return { start: lastMonday, end: lastSunday };
}

function getPreviousMonthBounds() {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastOfPrev = new Date(firstOfMonth);
  lastOfPrev.setDate(firstOfMonth.getDate() - 1);
  lastOfPrev.setHours(23, 59, 59, 999);
  const firstOfPrev = new Date(lastOfPrev.getFullYear(), lastOfPrev.getMonth(), 1, 0, 0, 0, 0);
  return { start: firstOfPrev, end: lastOfPrev };
}

async function computeWinner(
  start: Date,
  end: Date,
  minPicks: number
) {
  const { data: picks } = await supabaseAdmin
    .from("tipster_picks")
    .select("user_id, units_result")
    .eq("status", "resolved")
    .gte("resolved_at", start.toISOString())
    .lte("resolved_at", end.toISOString());

  const map = new Map<string, { user_id: string; total_picks: number; total_units: number }>();

  for (const p of picks || []) {
    if (!map.has(p.user_id)) {
      map.set(p.user_id, { user_id: p.user_id, total_picks: 0, total_units: 0 });
    }
    const s = map.get(p.user_id)!;
    s.total_picks += 1;
    s.total_units += parseFloat(String(p.units_result)) || 0;
  }

  const eligible = Array.from(map.values()).filter((s) => s.total_picks >= minPicks);
  eligible.sort((a, b) => b.total_units - a.total_units);
  return eligible[0] || null;
}

// ── POST : calcul gagnant (manuel ou cron) ──
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, period_type, is_cron } = body;

  // Autoriser si cron avec secret OU si admin connect\u00e9
  if (is_cron) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized cron" }, { status: 401 });
    }
  } else {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    if (action === "calculate") {
      if (!["week", "month"].includes(period_type)) {
        return NextResponse.json({ error: "Invalid period_type" }, { status: 400 });
      }

      const bounds = period_type === "week" ? getPreviousWeekBounds() : getPreviousMonthBounds();
      const minPicks = period_type === "week" ? 3 : 10;
      const prize = period_type === "week" ? 10 : 40;

      // V\u00e9rif : d\u00e9j\u00e0 calcul\u00e9 pour cette p\u00e9riode ?
      const periodStartDate = bounds.start.toISOString().split("T")[0];
      const { data: existing } = await supabaseAdmin
        .from("tipster_concours_winners")
        .select("id")
        .eq("period_type", period_type)
        .eq("period_start", periodStartDate)
        .limit(1);

      if (existing && existing.length > 0) {
        return NextResponse.json({
          skipped: true,
          reason: "Already calculated for this period",
          period_start: periodStartDate,
        });
      }

      const winner = await computeWinner(bounds.start, bounds.end, minPicks);

      if (!winner) {
        return NextResponse.json({
          skipped: true,
          reason: "No eligible winner",
          period_start: periodStartDate,
        });
      }

      // Enregistrer le gagnant
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("tipster_concours_winners")
        .insert({
          user_id: winner.user_id,
          period_type,
          period_start: periodStartDate,
          period_end: bounds.end.toISOString().split("T")[0],
          total_units: Math.round(winner.total_units * 100) / 100,
          picks_count: winner.total_picks,
          prize_amount: prize,
          paid: false,
        })
        .select(`*, users:user_id (pseudo, avatar_url, email, paypal_email)`)
        .single();

      if (insertError) throw insertError;

      // TODO : envoyer email au gagnant
      // (laisser comme tache pour l'admin en v1, faire plus tard avec resend)

      return NextResponse.json({ winner: inserted });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });

  } catch (err: any) {
    console.error("[admin/tipster-concours] POST error:", err.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ── PATCH : marquer gagnant comme pay\u00e9 ──
export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { winner_id, paid, paid_note } = body;

  if (!winner_id) return NextResponse.json({ error: "Missing winner_id" }, { status: 400 });

  try {
    const updateData: any = { paid };
    if (paid) {
      updateData.paid_at = new Date().toISOString();
      updateData.paid_note = paid_note || null;
    } else {
      updateData.paid_at = null;
      updateData.paid_note = null;
    }

    const { data: updated, error } = await supabaseAdmin
      .from("tipster_concours_winners")
      .update(updateData)
      .eq("id", winner_id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ winner: updated });

  } catch (err: any) {
    console.error("[admin/tipster-concours] PATCH error:", err.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ── GET : liste de tous les gagnants (pour admin) ──
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { data: winners } = await supabaseAdmin
      .from("tipster_concours_winners")
      .select(`
        *,
        users:user_id (id, pseudo, avatar_url, email, paypal_email)
      `)
      .order("created_at", { ascending: false });

    return NextResponse.json({ winners: winners || [] });

  } catch (err: any) {
    console.error("[admin/tipster-concours] GET error:", err.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}