import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { NextResponse } from "next/server";

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
  return NextResponse.json(data);
}