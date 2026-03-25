import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { sendBilanEmail } from "@/lib/emails";
import { NextResponse } from "next/server";

const MONTH_NAMES = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

function formatMonth(ym: string) {
  const [y, m] = ym.split("-");
  return `${MONTH_NAMES[parseInt(m) - 1]} ${y}`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const calcMonth = searchParams.get("calc_month");

  // If calc_month provided, return auto-calculated stats for that month
  if (calcMonth) {
    try {
      await requireAdmin();
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [y, m] = calcMonth.split("-");
    const from = `${calcMonth}-01`;
    const to = `${y}-${m}-${new Date(parseInt(y), parseInt(m), 0).getDate()}`;

    const { data: picks } = await supabaseAdmin
      .from("picks")
      .select("status, profit, stake, odds")
      .neq("status", "pending")
      .gte("event_date", from)
      .lte("event_date", to);

    const all = picks ?? [];
    const resolved = all.filter((p) => p.status !== "void");
    const won = all.filter((p) => p.status === "won" || p.status === "half_won").length;
    const totalStaked = all.reduce((s, p) => s + (p.stake ?? 0), 0);
    const totalProfit = all.reduce((s, p) => s + (p.profit ?? 0), 0);

    return NextResponse.json({
      total_picks: all.length,
      win_rate: resolved.length > 0 ? Math.round((won / resolved.length) * 100 * 10) / 10 : 0,
      roi: totalStaked > 0 ? Math.round((totalProfit / totalStaked) * 100 * 10) / 10 : 0,
      profit: Math.round(totalProfit * 10) / 10,
    });
  }

  const { data, error } = await supabaseAdmin
    .from("bilans")
    .select("*")
    .order("month", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { title, month, content, summary, cover_image, profit, roi, win_rate, total_picks } = body;

  if (!title || !month) {
    return NextResponse.json({ error: "Title and month required" }, { status: 400 });
  }

  // Generate slug from month
  const slug = month; // e.g. "2026-03"

  const { data, error } = await supabaseAdmin
    .from("bilans")
    .insert({
      title,
      slug,
      month,
      content: content ?? "",
      summary: summary ?? null,
      cover_image: cover_image ?? null,
      profit: profit ?? 0,
      roi: roi ?? 0,
      win_rate: win_rate ?? 0,
      total_picks: total_picks ?? 0,
      is_published: false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
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

  if (!id) return NextResponse.json({ error: "Missing bilan id" }, { status: 400 });

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (updates.title !== undefined) updateData.title = updates.title;
  if (updates.content !== undefined) updateData.content = updates.content;
  if (updates.summary !== undefined) updateData.summary = updates.summary;
  if (updates.cover_image !== undefined) updateData.cover_image = updates.cover_image;
  if (updates.profit !== undefined) updateData.profit = updates.profit;
  if (updates.roi !== undefined) updateData.roi = updates.roi;
  if (updates.win_rate !== undefined) updateData.win_rate = updates.win_rate;
  if (updates.total_picks !== undefined) updateData.total_picks = updates.total_picks;

  if (updates.is_published !== undefined) {
    updateData.is_published = updates.is_published;
    if (updates.is_published && !updates.published_at) {
      updateData.published_at = new Date().toISOString();
    }
  }

  const { data, error } = await supabaseAdmin
    .from("bilans")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify premium subscribers when publishing
  if (updates.is_published === true && data) {
    notifyPremiumSubscribers(data).catch(() => {});
  }

  return NextResponse.json(data);
}

async function notifyPremiumSubscribers(bilan: Record<string, unknown>) {
  const { data: premiumUsers } = await supabaseAdmin
    .from("users")
    .select("email, pseudo, display_name")
    .eq("subscription_status", "active")
    .eq("notify_bilan", true)
    .not("email", "is", null);

  if (!premiumUsers || premiumUsers.length === 0) return;

  const month = formatMonth(bilan.month as string);
  const slug = bilan.slug as string;
  const stats = {
    totalPicks: bilan.total_picks as number,
    winRate: bilan.win_rate as number,
    roi: bilan.roi as number,
    profit: bilan.profit as number,
  };

  for (const user of premiumUsers) {
    const name = user.pseudo || user.display_name || user.email.split("@")[0];
    await sendBilanEmail(user.email, name, month, slug, stats).catch(() => {});
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "Missing bilan id" }, { status: 400 });

  // Get bilan to delete cover image from storage
  const { data: bilan } = await supabaseAdmin
    .from("bilans")
    .select("slug, cover_image")
    .eq("id", id)
    .single();

  if (bilan?.cover_image) {
    const path = bilan.cover_image.split("/bilans/").pop();
    if (path) {
      await supabaseAdmin.storage.from("bilans").remove([path]);
    }
  }

  const { error } = await supabaseAdmin
    .from("bilans")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}