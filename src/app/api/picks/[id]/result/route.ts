import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { calculateProfit, calculateCombinedResult } from "@/lib/calculations";
import { NextResponse } from "next/server";
import type { PickStatus } from "@/lib/supabase/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  // Fetch pick with legs
  const { data: pick, error: fetchError } = await supabaseAdmin
    .from("picks")
    .select("*, legs:pick_legs(*, sport:sports(*))")
    .eq("id", id)
    .single();

  if (fetchError || !pick) {
    return NextResponse.json({ error: "Pick not found" }, { status: 404 });
  }

  const legs = pick.legs ?? [];

  // === SIMPLE PICK (or legacy pick without legs) ===
  if (pick.pick_type === "simple" || legs.length <= 1) {
    const { status } = body as { status: PickStatus };
    const profit = calculateProfit(status, pick.odds, pick.stake);

    // Update leg if exists
    if (legs.length === 1) {
      await supabaseAdmin
        .from("pick_legs")
        .update({ status })
        .eq("pick_id", id)
        .eq("leg_number", 1);
    }

    const { data, error } = await supabaseAdmin
      .from("picks")
      .update({
        status,
        profit,
        result_entered_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Update bankrolls (tipster + players)
    try {
      const { updateBankrollsAfterResult } = await import("@/lib/bankroll-utils");
      await updateBankrollsAfterResult(id, profit, pick.stake, pick.profit);
    } catch (err) {
      console.error("[picks/result] Bankroll update failed (non-blocking):", err);
    }

    return NextResponse.json(data);
  }

  // === COMBINED PICK ===
  // Body: { leg_number: number, status: PickStatus }
  const { leg_number, status } = body as { leg_number: number; status: PickStatus };

  // Update this leg
  await supabaseAdmin
    .from("pick_legs")
    .update({ status })
    .eq("pick_id", id)
    .eq("leg_number", leg_number);

  // Re-fetch all legs to check if all are resolved
  const { data: updatedLegs } = await supabaseAdmin
    .from("pick_legs")
    .select("*")
    .eq("pick_id", id)
    .order("leg_number");

  const allLegs = updatedLegs ?? [];
  const allResolved = allLegs.every((l) => l.status !== "pending");

  if (allResolved) {
    // Calculate combined result
    const result = calculateCombinedResult(
      allLegs.map((l) => ({ status: l.status as PickStatus, odds: l.odds })),
      pick.stake
    );

    const { data, error } = await supabaseAdmin
      .from("picks")
      .update({
        status: result.status,
        profit: result.profit,
        result_entered_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // All legs resolved — update bankrolls (tipster + players)
    try {
      const { updateBankrollsAfterResult } = await import("@/lib/bankroll-utils");
      await updateBankrollsAfterResult(id, result.profit, pick.stake, pick.profit);
    } catch (err) {
      console.error("[picks/result] Bankroll update failed (non-blocking):", err);
    }

    return NextResponse.json({ ...data, all_resolved: true });
  }

  // Not all legs resolved yet — return partial state
  return NextResponse.json({
    id,
    leg_number,
    leg_status: status,
    all_resolved: false,
    legs: allLegs,
  });
}