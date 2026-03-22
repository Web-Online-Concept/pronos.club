import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { NextResponse } from "next/server";

// POST — create legs for a pick
export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { legs } = await request.json();

  if (!legs || !Array.isArray(legs) || legs.length === 0) {
    return NextResponse.json({ error: "legs array required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("pick_legs")
    .insert(legs)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

// PUT — update an individual leg
export async function PUT(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { pick_id, leg_number, event_name, selection, odds, competition, sport_id, event_date } = body;

  if (!pick_id || !leg_number) {
    return NextResponse.json({ error: "pick_id and leg_number required" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (event_name !== undefined) updateData.event_name = event_name;
  if (selection !== undefined) updateData.selection = selection;
  if (odds !== undefined) updateData.odds = odds;
  if (competition !== undefined) updateData.competition = competition;
  if (sport_id !== undefined) updateData.sport_id = sport_id;
  if (event_date !== undefined) updateData.event_date = event_date;

  const { data, error } = await supabaseAdmin
    .from("pick_legs")
    .update(updateData)
    .eq("pick_id", pick_id)
    .eq("leg_number", leg_number)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}