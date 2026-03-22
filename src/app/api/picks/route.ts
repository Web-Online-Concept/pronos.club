import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const limit = parseInt(searchParams.get("limit") ?? "50");
  const offset = parseInt(searchParams.get("offset") ?? "0");

  let query = supabaseAdmin
    .from("picks")
    .select("*, sport:sports(*), bookmaker:bookmakers(*), legs:pick_legs(*, sport:sports(*))", {
      count: "exact",
    })
    .order("published_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data, count });
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  const { data, error } = await supabaseAdmin
    .from("picks")
    .insert({
      sport_id: body.sport_id,
      pick_type: body.pick_type ?? "simple",
      competition: body.competition || null,
      bookmaker_id: body.bookmaker_id,
      event_name: body.event_name,
      event_date: body.event_date,
      selection: body.selection,
      odds: body.odds,
      min_odds: body.min_odds ?? null,
      stake: body.stake,
      is_premium: body.is_premium ?? false,
      analysis_fr: body.analysis_fr ?? null,
      analysis_en: body.analysis_en ?? null,
      analysis_es: body.analysis_es ?? null,
      screenshot_url: body.screenshot_url ?? null,
      bet_url: body.bet_url ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
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
    return NextResponse.json({ error: "Missing pick id" }, { status: 400 });
  }

  // Build update object with only provided fields
  const updateData: Record<string, unknown> = {};
  if (updates.event_name !== undefined) updateData.event_name = updates.event_name;
  if (updates.event_date !== undefined) updateData.event_date = updates.event_date;
  if (updates.selection !== undefined) updateData.selection = updates.selection;
  if (updates.odds !== undefined) updateData.odds = updates.odds;
  if (updates.min_odds !== undefined) updateData.min_odds = updates.min_odds ?? null;
  if (updates.stake !== undefined) updateData.stake = updates.stake;
  if (updates.sport_id !== undefined) updateData.sport_id = updates.sport_id;
  if (updates.bookmaker_id !== undefined) updateData.bookmaker_id = updates.bookmaker_id;
  if (updates.competition !== undefined) updateData.competition = updates.competition || null;
  if (updates.is_premium !== undefined) updateData.is_premium = updates.is_premium;
  if (updates.analysis_fr !== undefined) updateData.analysis_fr = updates.analysis_fr || null;
  if (updates.screenshot_url !== undefined) updateData.screenshot_url = updates.screenshot_url || null;
  if (updates.bet_url !== undefined) updateData.bet_url = updates.bet_url || null;
  if (updates.status !== undefined) updateData.status = updates.status;

  // If status changed, recalculate profit
  let oldProfit: number | null = null;
  if (updates.status) {
    const { calculateProfit } = await import("@/lib/calculations");
    // Get current pick data — including old profit for bankroll correction
    const { data: current } = await supabaseAdmin
      .from("picks")
      .select("odds, stake, profit")
      .eq("id", id)
      .single();

    if (current) {
      oldProfit = current.profit; // Store old profit before overwriting
      const odds = updates.odds ?? current.odds;
      const stake = updates.stake ?? current.stake;
      updateData.profit = calculateProfit(updates.status, odds, stake);
      updateData.result_entered_at = new Date().toISOString();
    }
  }

  const { data, error } = await supabaseAdmin
    .from("picks")
    .update(updateData)
    .eq("id", id)
    .select("*, sport:sports(*), bookmaker:bookmakers(*), legs:pick_legs(*, sport:sports(*))")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // After successful status change, update bankrolls (tipster + players)
  if (updates.status && data.profit !== null && data.profit !== undefined) {
    try {
      const { updateBankrollsAfterResult } = await import("@/lib/bankroll-utils");
      await updateBankrollsAfterResult(id, data.profit, data.stake, oldProfit);
    } catch (err) {
      console.error("[picks PUT] Bankroll update failed (non-blocking):", err);
    }
  }

  return NextResponse.json(data);
}

// DELETE is intentionally disabled — picks use sequential numbering (PC-XXXX)
// and must never be deleted to maintain transparency. Use void or modify instead.