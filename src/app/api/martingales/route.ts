// src/app/api/martingales/route.ts
// CRUD martingales + steps
// Premium only — auth via Supabase cookie

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getAuthUser() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError) {
    console.error("[martingales] Auth error:", authError.message);
    return null;
  }
  if (!user) {
    console.error("[martingales] No user found in session");
    return null;
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("users")
    .select("subscription_status")
    .eq("id", user.id)
    .single();

  if (profileError) {
    console.error("[martingales] Profile error:", profileError.message);
    return null;
  }

  if (!profile || (profile.subscription_status !== "active" && profile.subscription_status !== "trialing")) {
    console.error("[martingales] Not premium. Status:", profile?.subscription_status);
    return null;
  }

  return user;
}

// ── GET — List / Detail / Stats ──
export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") || "list";
  const martingaleId = searchParams.get("id");

  try {
    if (action === "detail" && martingaleId) {
      const { data: martingale } = await supabaseAdmin
        .from("martingales")
        .select("*")
        .eq("id", martingaleId)
        .eq("user_id", user.id)
        .single();

      if (!martingale) return NextResponse.json({ error: "Not found" }, { status: 404 });

      const { data: steps } = await supabaseAdmin
        .from("martingale_steps")
        .select("*")
        .eq("martingale_id", martingaleId)
        .order("step_number", { ascending: true });

      return NextResponse.json({ martingale, steps: steps || [] });
    }

    if (action === "stats") {
      const { data: all } = await supabaseAdmin
        .from("martingales")
        .select("status, profit, initial_stake, current_step, total_lost")
        .eq("user_id", user.id);

      const martingales = all || [];
      const total = martingales.length;
      const active = martingales.filter((m) => m.status === "active").length;
      const won = martingales.filter((m) => m.status === "won").length;
      const lost = martingales.filter((m) => m.status === "lost").length;
      const totalProfit = martingales.reduce((sum, m) => sum + (parseFloat(String(m.profit)) || 0), 0);
      const winRate = total > 0 ? Math.round((won / (won + lost || 1)) * 100) : 0;
      const avgSteps = won > 0
        ? Math.round(martingales.filter((m) => m.status === "won").reduce((sum, m) => sum + m.current_step, 0) / won * 10) / 10
        : 0;
      const worstLoss = lost > 0
        ? Math.min(...martingales.filter((m) => m.status === "lost").map((m) => parseFloat(String(m.profit)) || 0))
        : 0;

      return NextResponse.json({
        total, active, won, lost, totalProfit, winRate, avgSteps, worstLoss,
      });
    }

    // Default: list
    const { data: martingales } = await supabaseAdmin
      .from("martingales")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    return NextResponse.json({ martingales: martingales || [] });

  } catch (err: any) {
    console.error("[martingales] GET error:", err.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ── POST — Create / Add step / Resolve / Close ──
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { action } = body;

  try {
    // ── Reset all ──
    if (action === "reset_all") {
      const { data: userMartingales } = await supabaseAdmin
        .from("martingales")
        .select("id")
        .eq("user_id", user.id);

      if (userMartingales && userMartingales.length > 0) {
        const ids = userMartingales.map((m: any) => m.id);
        await supabaseAdmin.from("martingale_steps").delete().in("martingale_id", ids);
      }

      await supabaseAdmin.from("martingales").delete().eq("user_id", user.id);

      return NextResponse.json({ success: true });
    }

    // ── Create martingale ──
    if (action === "create") {
      const { name, initial_stake } = body;

      if (!initial_stake || initial_stake <= 0) {
        return NextResponse.json({ error: "Invalid stake" }, { status: 400 });
      }

      const { data: martingale, error: createError } = await supabaseAdmin
        .from("martingales")
        .insert({
          user_id: user.id,
          name: name || "Martingale",
          initial_stake,
          current_step: 0,
          status: "active",
          profit: 0,
          total_lost: 0,
        })
        .select()
        .single();

      if (createError) throw createError;

      return NextResponse.json({ martingale });
    }

    // ── Add step ──
    if (action === "add_step") {
      const { martingale_id, odds, stake: manualStake, description, match_date, sport } = body;

      const { data: martingale } = await supabaseAdmin
        .from("martingales")
        .select("*")
        .eq("id", martingale_id)
        .eq("user_id", user.id)
        .single();

      if (!martingale) return NextResponse.json({ error: "Not found" }, { status: 404 });
      if (martingale.status !== "active") return NextResponse.json({ error: "Martingale is not active" }, { status: 400 });

      // Check no pending step
      const { data: pendingSteps } = await supabaseAdmin
        .from("martingale_steps")
        .select("id")
        .eq("martingale_id", martingale_id)
        .eq("result", "pending");

      if (pendingSteps && pendingSteps.length > 0) {
        return NextResponse.json({ error: "A step is already pending" }, { status: 400 });
      }

      const stepNumber = martingale.current_step + 1;
      const totalLost = parseFloat(String(martingale.total_lost)) || 0;
      const initialStake = parseFloat(String(martingale.initial_stake));
      const beneficeTarget = initialStake * 2;

      let stake: number;
      let minOdds: number | null = null;

      if (stepNumber === 1) {
        // Palier 1: le joueur choisit sa mise ET sa cote
        stake = manualStake || initialStake;
        if (stake <= 0) return NextResponse.json({ error: "Invalid stake" }, { status: 400 });
      } else {
        // Palier 2+: l'outil calcule la mise selon la cote choisie
        // Formule: mise = (pertes_cumulées + bénéfice_cible) / (cote - 1)
        if (!odds || odds <= 1) return NextResponse.json({ error: "Invalid odds (> 1.00)" }, { status: 400 });
        stake = Math.ceil(((totalLost + beneficeTarget) / (odds - 1)) * 100) / 100;
        // Cote minimum pour info (si mise = même mise que palier 1)
        minOdds = Math.round(((totalLost + beneficeTarget) / initialStake + 1) * 1000) / 1000;
      }

      if (!odds || odds <= 1) return NextResponse.json({ error: "Invalid odds (> 1.00)" }, { status: 400 });

      const potentialGain = Math.round(stake * odds * 100) / 100;

      const { data: step, error: stepError } = await supabaseAdmin
        .from("martingale_steps")
        .insert({
          martingale_id,
          step_number: stepNumber,
          odds,
          stake,
          potential_gain: potentialGain,
          description: description || null,
          match_date: match_date || null,
          sport: sport || null,
          min_odds: minOdds,
          result: "pending",
        })
        .select()
        .single();

      if (stepError) throw stepError;

      await supabaseAdmin
        .from("martingales")
        .update({ current_step: stepNumber })
        .eq("id", martingale_id);

      return NextResponse.json({ step });
    }

    // ── Resolve step (won/lost) ──
    if (action === "resolve_step") {
      const { step_id, result } = body;

      if (!["won", "lost"].includes(result)) {
        return NextResponse.json({ error: "Invalid result" }, { status: 400 });
      }

      const { data: step } = await supabaseAdmin
        .from("martingale_steps")
        .select("*, martingales!inner(*)")
        .eq("id", step_id)
        .single();

      if (!step) return NextResponse.json({ error: "Step not found" }, { status: 404 });

      const martingale = (step as any).martingales;
      if (martingale.user_id !== user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (step.result !== "pending") return NextResponse.json({ error: "Step already resolved" }, { status: 400 });

      const stakeVal = parseFloat(String(step.stake));
      const actualGain = result === "won" ? parseFloat(String(step.potential_gain)) : 0;

      // Update step
      await supabaseAdmin
        .from("martingale_steps")
        .update({
          result,
          actual_gain: actualGain,
          completed_at: new Date().toISOString(),
        })
        .eq("id", step_id);

      if (result === "won") {
        // Martingale won! Profit = gain - mise du palier - toutes les pertes précédentes
        const totalLost = parseFloat(String(martingale.total_lost)) || 0;
        const profit = actualGain - stakeVal - totalLost;

        await supabaseAdmin
          .from("martingales")
          .update({ status: "won", profit })
          .eq("id", martingale.id);

        return NextResponse.json({ status: "won", profit });
      }

      // Lost — update total_lost
      const newTotalLost = (parseFloat(String(martingale.total_lost)) || 0) + stakeVal;

      await supabaseAdmin
        .from("martingales")
        .update({ total_lost: newTotalLost })
        .eq("id", martingale.id);

      return NextResponse.json({ status: "step_lost", total_lost: newTotalLost });
    }

    // ── Close (abandon with loss) ──
    if (action === "close") {
      const { martingale_id } = body;

      const { data: martingale } = await supabaseAdmin
        .from("martingales")
        .select("*")
        .eq("id", martingale_id)
        .eq("user_id", user.id)
        .single();

      if (!martingale) return NextResponse.json({ error: "Not found" }, { status: 404 });
      if (martingale.status !== "active") return NextResponse.json({ error: "Not active" }, { status: 400 });

      const totalLost = parseFloat(String(martingale.total_lost)) || 0;

      // Delete any pending step
      await supabaseAdmin
        .from("martingale_steps")
        .delete()
        .eq("martingale_id", martingale_id)
        .eq("result", "pending");

      await supabaseAdmin
        .from("martingales")
        .update({ status: "lost", profit: -totalLost })
        .eq("id", martingale_id);

      return NextResponse.json({ status: "lost", profit: -totalLost });
    }

    // ── Update odds on a pending step ──
    if (action === "update_step") {
      const { step_id, new_odds } = body;
      if (!new_odds || new_odds <= 1) return NextResponse.json({ error: "Invalid odds" }, { status: 400 });

      const { data: step } = await supabaseAdmin
        .from("martingale_steps")
        .select("*, martingales!inner(user_id, initial_stake, total_lost)")
        .eq("id", step_id)
        .single();

      if (!step || step.martingales.user_id !== user.id) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      if (step.result !== "pending") return NextResponse.json({ error: "Step already resolved" }, { status: 400 });

      const isFirstStep = step.step_number === 1;
      let newStake = parseFloat(String(step.stake));

      if (!isFirstStep) {
        // Recalculate stake based on new odds
        const totalLost = parseFloat(String(step.martingales.total_lost)) || 0;
        const initialStake = parseFloat(String(step.martingales.initial_stake));
        const beneficeTarget = initialStake * 2;
        newStake = Math.ceil(((totalLost + beneficeTarget) / (new_odds - 1)) * 100) / 100;
      }

      const newPotentialGain = Math.round(newStake * new_odds * 100) / 100;

      await supabaseAdmin
        .from("martingale_steps")
        .update({
          odds: new_odds,
          stake: newStake,
          potential_gain: newPotentialGain,
        })
        .eq("id", step_id);

      return NextResponse.json({ success: true, stake: newStake, potential_gain: newPotentialGain });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });

  } catch (err: any) {
    console.error("[martingales] POST error:", err.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ── DELETE — Delete martingale ──
export async function DELETE(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const martingaleId = searchParams.get("id");

  if (!martingaleId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const { data: martingale } = await supabaseAdmin
      .from("martingales")
      .select("id, user_id")
      .eq("id", martingaleId)
      .eq("user_id", user.id)
      .single();

    if (!martingale) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await supabaseAdmin.from("martingale_steps").delete().eq("martingale_id", martingaleId);
    await supabaseAdmin.from("martingales").delete().eq("id", martingaleId);

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error("[martingales] DELETE error:", err.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}