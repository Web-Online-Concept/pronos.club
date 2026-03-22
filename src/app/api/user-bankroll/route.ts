import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data } = await supabase
    .from("user_bankroll")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!data) {
    // Return default config (units only, no bankroll)
    return NextResponse.json({
      mode: "units_only",
      initial_bankroll: 0,
      current_bankroll: 0,
      unit_value: 0,
      unit_percent: 0,
      auto_recalc: "none",
      initial_unit_count: 0,
    });
  }

  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  const row: Record<string, unknown> = {
    user_id: user.id,
    updated_at: new Date().toISOString(),
  };

  if (body.mode !== undefined) row.mode = body.mode;
  if (body.initial_bankroll !== undefined) row.initial_bankroll = body.initial_bankroll;
  if (body.current_bankroll !== undefined) row.current_bankroll = body.current_bankroll;
  if (body.unit_value !== undefined) row.unit_value = body.unit_value;
  if (body.unit_percent !== undefined) row.unit_percent = body.unit_percent;
  if (body.auto_recalc !== undefined) row.auto_recalc = body.auto_recalc;
  if (body.initial_unit_count !== undefined) row.initial_unit_count = body.initial_unit_count;

  // If setting initial bankroll for the first time, also set current = initial
  if (body.initial_bankroll !== undefined && body.current_bankroll === undefined) {
    row.current_bankroll = body.initial_bankroll;
  }

  const { data, error } = await supabase
    .from("user_bankroll")
    .upsert(row, { onConflict: "user_id" })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}