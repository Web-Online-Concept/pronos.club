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

    // Enrichir avec current_gain (actual_gain du dernier palier won/refunded)
    if (martingales && martingales.length > 0) {
      const ids = martingales.map((m: any) => m.id);
      const { data: lastSteps } = await supabaseAdmin
        .from("martingale_steps")
        .select("martingale_id, step_number, actual_gain, result")
        .in("martingale_id", ids)
        .in("result", ["won", "refunded"])
        .order("step_number", { ascending: false });

      const gainMap = new Map<string, number>();
      (lastSteps || []).forEach((s: any) => {
        if (!gainMap.has(s.martingale_id)) {
          gainMap.set(s.martingale_id, parseFloat(s.actual_gain) || 0);
        }
      });

      martingales.forEach((m: any) => {
        m.current_gain = gainMap.get(m.id) || 0;
      });
    }

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
      const { martingale_id, odds, stake: manualStake, match_name, description, match_date, sport, bookmaker } = body;

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
      const beneficeTarget = initialStake;

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
          match_name: match_name || null,
          description: description || null,
          match_date: match_date || null,
          sport: sport || null,
          bookmaker: bookmaker || null,
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

    // ── Update step (edit any field) ──
    if (action === "update_step") {
      const { step_id, sport, match_name, description, match_date, bookmaker, new_odds } = body;

      const { data: step } = await supabaseAdmin
        .from("martingale_steps")
        .select("*, martingales!inner(user_id, initial_stake, total_lost, current_step)")
        .eq("id", step_id)
        .single();

      if (!step || (step as any).martingales.user_id !== user.id) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      const updateData: any = {};

      if (sport !== undefined) updateData.sport = sport || null;
      if (match_name !== undefined) updateData.match_name = match_name || null;
      if (description !== undefined) updateData.description = description || null;
      if (match_date !== undefined) updateData.match_date = match_date || null;
      if (bookmaker !== undefined) updateData.bookmaker = bookmaker || null;

      // Cote modifiable UNIQUEMENT si dernier step ET pending
      if (new_odds !== undefined && new_odds !== null) {
        const isLastStep = step.step_number >= (step as any).martingales.current_step;
        const isPending = step.result === "pending";

        if (!isLastStep || !isPending) {
          return NextResponse.json({
            error: "La cote n'est modifiable que sur le dernier palier non résolu",
          }, { status: 400 });
        }
        if (!new_odds || new_odds <= 1) {
          return NextResponse.json({ error: "Invalid odds" }, { status: 400 });
        }

        // Recalcul mise uniquement si palier > 1 (palier 1 = mise libre)
        const isFirstStep = step.step_number === 1;
        let newStake = parseFloat(String(step.stake));

        if (!isFirstStep) {
          const totalLost = parseFloat(String((step as any).martingales.total_lost)) || 0;
          const initialStake = parseFloat(String((step as any).martingales.initial_stake));
          const beneficeTarget = initialStake;
          newStake = Math.ceil(((totalLost + beneficeTarget) / (new_odds - 1)) * 100) / 100;
        }

        const newPotentialGain = Math.round(newStake * new_odds * 100) / 100;
        updateData.odds = new_odds;
        updateData.stake = newStake;
        updateData.potential_gain = newPotentialGain;
      }

      if (Object.keys(updateData).length === 0) {
        return NextResponse.json({ error: "No fields to update" }, { status: 400 });
      }

      await supabaseAdmin
        .from("martingale_steps")
        .update(updateData)
        .eq("id", step_id);

      return NextResponse.json({ success: true });
    }

    // ── Change result (undo/modify last resolved step) ──
    if (action === "change_result") {
      const { step_id, new_result } = body;

      if (!["won", "lost", "pending", "refunded"].includes(new_result)) {
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

      // Vérif : doit être le dernier palier (aucun palier suivant)
      const { data: nextSteps } = await supabaseAdmin
        .from("martingale_steps")
        .select("id")
        .eq("martingale_id", martingale.id)
        .gt("step_number", step.step_number)
        .limit(1);

      if (nextSteps && nextSteps.length > 0) {
        return NextResponse.json({
          error: "Ce palier a des paliers suivants, impossible de modifier son résultat",
        }, { status: 400 });
      }

      const stakeVal = parseFloat(String(step.stake));
      const initialStake = parseFloat(String(martingale.initial_stake));

      // Calcul nouveau actual_gain + nouveau total_lost de la martingale
      // Logique martingale :
      // - "won" : actual_gain = potential_gain, martingale = won, profit = gain - stake - total_lost (avant ce palier)
      // - "lost" : actual_gain = 0, total_lost augmente de stake, martingale reste active
      // - "refunded" : actual_gain = stake (mise récupérée), total_lost inchangé, martingale reste active
      // - "pending" : actual_gain = null, total_lost remis comme avant ce palier (on retire stake)

      // D'abord on calcule le total_lost "avant" ce palier (pour pouvoir rétablir)
      // total_lost actuel = somme des stakes de tous les paliers "lost" de la martingale
      const { data: lostSteps } = await supabaseAdmin
        .from("martingale_steps")
        .select("stake")
        .eq("martingale_id", martingale.id)
        .eq("result", "lost")
        .neq("id", step_id); // exclure ce palier

      const totalLostBeforeThisStep = (lostSteps || []).reduce(
        (sum: number, s: any) => sum + (parseFloat(String(s.stake)) || 0),
        0
      );

      let newActualGain: number | null = null;
      let newTotalLost = totalLostBeforeThisStep;
      let newStatus: "active" | "won" | "lost" = "active";
      let newProfit = 0;

      if (new_result === "won") {
        newActualGain = parseFloat(String(step.potential_gain));
        newTotalLost = totalLostBeforeThisStep; // inchangé (ce palier n'est plus une perte)
        newStatus = "won";
        newProfit = newActualGain - stakeVal - totalLostBeforeThisStep;
      } else if (new_result === "lost") {
        newActualGain = 0;
        newTotalLost = totalLostBeforeThisStep + stakeVal;
        newStatus = "active";
        newProfit = 0;
      } else if (new_result === "refunded") {
        newActualGain = stakeVal;
        newTotalLost = totalLostBeforeThisStep; // mise récupérée, pas de perte
        newStatus = "active";
        newProfit = 0;
      } else {
        // pending
        newActualGain = null;
        newTotalLost = totalLostBeforeThisStep;
        newStatus = "active";
        newProfit = 0;
      }

      // Update step
      await supabaseAdmin
        .from("martingale_steps")
        .update({
          result: new_result,
          actual_gain: newActualGain,
          completed_at: new_result === "pending" ? null : new Date().toISOString(),
        })
        .eq("id", step_id);

      // Update martingale
      await supabaseAdmin
        .from("martingales")
        .update({
          status: newStatus,
          profit: newProfit,
          total_lost: newTotalLost,
        })
        .eq("id", martingale.id);

      return NextResponse.json({ success: true, new_status: newStatus });
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