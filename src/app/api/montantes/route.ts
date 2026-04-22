// src/app/api/montantes/route.ts
// CRUD montantes + steps
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
    console.error("[montantes] Auth error:", authError.message);
    return null;
  }
  if (!user) {
    console.error("[montantes] No user found in session");
    return null;
  }

  // Check premium
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("users")
    .select("subscription_status")
    .eq("id", user.id)
    .single();

  if (profileError) {
    console.error("[montantes] Profile error:", profileError.message);
    return null;
  }

  if (!profile || (profile.subscription_status !== "active" && profile.subscription_status !== "trialing")) {
    console.error("[montantes] Not premium. Status:", profile?.subscription_status);
    return null;
  }

  return user;
}

// ── GET — List montantes + stats + detail ──
export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") || "list";
  const montanteId = searchParams.get("id");

  try {
    if (action === "detail" && montanteId) {
      const { data: montante } = await supabaseAdmin
        .from("montantes")
        .select("*")
        .eq("id", montanteId)
        .eq("user_id", user.id)
        .single();

      if (!montante) return NextResponse.json({ error: "Not found" }, { status: 404 });

      const { data: steps } = await supabaseAdmin
        .from("montante_steps")
        .select("*")
        .eq("montante_id", montanteId)
        .order("step_number", { ascending: true });

      return NextResponse.json({ montante, steps: steps || [] });
    }

    if (action === "stats") {
      const { data: all } = await supabaseAdmin
        .from("montantes")
        .select("status, profit, initial_stake, current_step, total_steps")
        .eq("user_id", user.id);

      const montantes = all || [];
      const total = montantes.length;
      const active = montantes.filter((m) => m.status === "active").length;
      const won = montantes.filter((m) => m.status === "won").length;
      const lost = montantes.filter((m) => m.status === "lost").length;
      const totalProfit = montantes.reduce((sum, m) => sum + (m.profit || 0), 0);
      const winRate = total > 0 ? Math.round((won / (won + lost || 1)) * 100) : 0;
      const avgFailStep = lost > 0
        ? Math.round(montantes.filter((m) => m.status === "lost").reduce((sum, m) => sum + m.current_step, 0) / lost * 10) / 10
        : 0;
      const bestProfit = montantes.length > 0
        ? Math.max(...montantes.map((m) => m.profit || 0))
        : 0;

      return NextResponse.json({
        total, active, won, lost, totalProfit, winRate, avgFailStep, bestProfit,
      });
    }

    // Default: list all montantes
    const { data: montantes } = await supabaseAdmin
      .from("montantes")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    return NextResponse.json({ montantes: montantes || [] });

  } catch (err: any) {
    console.error("[montantes] GET error:", err.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ── POST — Create montante / Add step / Resolve / Cash out ──
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { action } = body;

  try {
    // ── Reset all ──
    if (action === "reset_all") {
      // Delete all steps of user's montantes
      const { data: userMontantes } = await supabaseAdmin
        .from("montantes")
        .select("id")
        .eq("user_id", user.id);

      if (userMontantes && userMontantes.length > 0) {
        const ids = userMontantes.map((m: any) => m.id);
        await supabaseAdmin.from("montante_steps").delete().in("montante_id", ids);
      }

      // Delete all montantes
      await supabaseAdmin.from("montantes").delete().eq("user_id", user.id);

      return NextResponse.json({ success: true });
    }

    // ── Create montante ──
    if (action === "create") {
      const { name, mode, stake_mode, initial_stake, target_amount, total_steps } = body;

      if (!initial_stake || !total_steps || total_steps < 1 || total_steps > 50) {
        return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
      }

      // Calculate avg odds needed for objectif mode
      let avgOddsNeeded = null;
      if (mode === "objectif" && target_amount) {
        avgOddsNeeded = Math.round(Math.pow(target_amount / initial_stake, 1 / total_steps) * 1000) / 1000;
      }

      // Create montante
      const { data: montante, error: createError } = await supabaseAdmin
        .from("montantes")
        .insert({
          user_id: user.id,
          name: name || "Ma montante",
          mode: mode || "objectif",
          stake_mode: stake_mode || "auto",
          initial_stake,
          target_amount: target_amount || null,
          total_steps,
          current_step: 0,
          status: "active",
          profit: 0,
          avg_odds_needed: avgOddsNeeded,
        })
        .select()
        .single();

      if (createError) throw createError;

      return NextResponse.json({ montante });
    }

    // ── Add step ──
    if (action === "add_step") {
      const { montante_id, odds, stake: manualStake, match_name, description, match_date, bet_type, sport, bookmaker } = body;

      const { data: montante } = await supabaseAdmin
        .from("montantes")
        .select("*")
        .eq("id", montante_id)
        .eq("user_id", user.id)
        .single();

      if (!montante) return NextResponse.json({ error: "Not found" }, { status: 404 });
      if (montante.status !== "active") return NextResponse.json({ error: "Montante is not active" }, { status: 400 });
      if (montante.current_step >= montante.total_steps) return NextResponse.json({ error: "All steps completed" }, { status: 400 });

      const stepNumber = montante.current_step + 1;

      // Calculate stake
      let stake: number;
      if (montante.stake_mode === "auto") {
        if (stepNumber === 1) {
          stake = parseFloat(montante.initial_stake);
        } else {
          // Get previous step gain
          const { data: prevStep } = await supabaseAdmin
            .from("montante_steps")
            .select("actual_gain")
            .eq("montante_id", montante_id)
            .eq("step_number", stepNumber - 1)
            .single();

          stake = prevStep?.actual_gain ? parseFloat(prevStep.actual_gain) : parseFloat(montante.initial_stake);
        }
      } else {
        stake = manualStake || 0;
        if (stake <= 0) return NextResponse.json({ error: "Invalid stake" }, { status: 400 });
      }

      const potentialGain = Math.round(stake * odds * 100) / 100;

      const { data: step, error: stepError } = await supabaseAdmin
        .from("montante_steps")
        .insert({
          montante_id,
          step_number: stepNumber,
          odds,
          stake,
          potential_gain: potentialGain,
          match_name: match_name || null,
          description: description || null,
          match_date: match_date || null,
          bet_type: bet_type || "simple",
          sport: sport || null,
          bookmaker: bookmaker || null,
          result: "pending",
        })
        .select()
        .single();

      if (stepError) throw stepError;

      // Update montante current_step
      await supabaseAdmin
        .from("montantes")
        .update({ current_step: stepNumber })
        .eq("id", montante_id);

      return NextResponse.json({ step });
    }

    // ── Resolve step (won/lost) ──
    if (action === "resolve_step") {
      const { step_id, result } = body;

      if (!["won", "lost"].includes(result)) {
        return NextResponse.json({ error: "Invalid result" }, { status: 400 });
      }

      const { data: step } = await supabaseAdmin
        .from("montante_steps")
        .select("*, montantes!inner(*)")
        .eq("id", step_id)
        .single();

      if (!step) return NextResponse.json({ error: "Step not found" }, { status: 404 });

      const montante = (step as any).montantes;
      if (montante.user_id !== user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (step.result !== "pending") return NextResponse.json({ error: "Step already resolved" }, { status: 400 });

      const actualGain = result === "won" ? step.potential_gain : 0;

      // Update step
      await supabaseAdmin
        .from("montante_steps")
        .update({
          result,
          actual_gain: actualGain,
          completed_at: new Date().toISOString(),
        })
        .eq("id", step_id);

      if (result === "lost") {
        // Montante failed
        const profit = -parseFloat(montante.initial_stake);
        await supabaseAdmin
          .from("montantes")
          .update({ status: "lost", profit })
          .eq("id", montante.id);

        return NextResponse.json({ status: "lost", montante_id: montante.id });
      }

      // Won — check if montante is complete
      const isLastStep = step.step_number >= montante.total_steps;
      const reachedTarget = montante.target_amount && actualGain >= parseFloat(montante.target_amount);

      if (isLastStep || reachedTarget) {
        // Montante succeeded!
        const profit = actualGain - parseFloat(montante.initial_stake);

        await supabaseAdmin
          .from("montantes")
          .update({ status: "won", profit })
          .eq("id", montante.id);

        return NextResponse.json({ status: "won", profit });
      }

      return NextResponse.json({ status: "step_won", actual_gain: actualGain });
    }

    // ── Update odds on a step ──
    if (action === "update_odds") {
      const { step_id, new_odds } = body;
      if (!new_odds || new_odds <= 1) return NextResponse.json({ error: "Invalid odds" }, { status: 400 });

      const { data: step } = await supabaseAdmin
        .from("montante_steps")
        .select("*, montantes!inner(user_id, stake_mode)")
        .eq("id", step_id)
        .single();

      if (!step || step.montantes.user_id !== user.id) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      const newPotentialGain = Math.round(parseFloat(step.stake) * new_odds * 100) / 100;

      const updateData: any = {
        odds: new_odds,
        potential_gain: newPotentialGain,
      };

      // If step was already won, recalculate actual_gain too
      if (step.result === "won") {
        updateData.actual_gain = newPotentialGain;
      }

      await supabaseAdmin
        .from("montante_steps")
        .update(updateData)
        .eq("id", step_id);

      return NextResponse.json({ success: true });
    }

    // ── Update step (edit any field) ──
    if (action === "update_step") {
      const { step_id, sport, match_name, description, match_date, bet_type, bookmaker, new_odds } = body;

      const { data: step } = await supabaseAdmin
        .from("montante_steps")
        .select("*, montantes!inner(user_id, current_step, total_steps)")
        .eq("id", step_id)
        .single();

      if (!step || (step as any).montantes.user_id !== user.id) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      const updateData: any = {};

      if (sport !== undefined) updateData.sport = sport || null;
      if (match_name !== undefined) updateData.match_name = match_name || null;
      if (description !== undefined) updateData.description = description || null;
      if (match_date !== undefined) updateData.match_date = match_date || null;
      if (bet_type !== undefined) {
        if (!["simple", "combiné"].includes(bet_type)) {
          return NextResponse.json({ error: "Invalid bet_type" }, { status: 400 });
        }
        updateData.bet_type = bet_type;
      }
      if (bookmaker !== undefined) updateData.bookmaker = bookmaker || null;

      // Cote modifiable UNIQUEMENT si dernier step ET pending
      if (new_odds !== undefined && new_odds !== null) {
        const isLastStep = step.step_number >= (step as any).montantes.current_step;
        const isPending = step.result === "pending";

        if (!isLastStep || !isPending) {
          return NextResponse.json({
            error: "La cote n'est modifiable que sur le dernier palier non résolu",
          }, { status: 400 });
        }
        if (!new_odds || new_odds <= 1) {
          return NextResponse.json({ error: "Invalid odds" }, { status: 400 });
        }

        const newPotentialGain = Math.round(parseFloat(step.stake) * new_odds * 100) / 100;
        updateData.odds = new_odds;
        updateData.potential_gain = newPotentialGain;
      }

      if (Object.keys(updateData).length === 0) {
        return NextResponse.json({ error: "No fields to update" }, { status: 400 });
      }

      await supabaseAdmin
        .from("montante_steps")
        .update(updateData)
        .eq("id", step_id);

      return NextResponse.json({ success: true });
    }

    // ── Change result (undo/modify last resolved step) ──
    if (action === "change_result") {
      const { step_id, new_result } = body;

      if (!["won", "lost", "pending"].includes(new_result)) {
        return NextResponse.json({ error: "Invalid result" }, { status: 400 });
      }

      const { data: step } = await supabaseAdmin
        .from("montante_steps")
        .select("*, montantes!inner(*)")
        .eq("id", step_id)
        .single();

      if (!step) return NextResponse.json({ error: "Step not found" }, { status: 404 });

      const montante = (step as any).montantes;
      if (montante.user_id !== user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

      // Vérif : doit être le dernier palier résolu (aucun palier suivant)
      const { data: nextSteps } = await supabaseAdmin
        .from("montante_steps")
        .select("id")
        .eq("montante_id", montante.id)
        .gt("step_number", step.step_number)
        .limit(1);

      if (nextSteps && nextSteps.length > 0) {
        return NextResponse.json({
          error: "Ce palier a des paliers suivants, impossible de modifier son résultat",
        }, { status: 400 });
      }

      // Calcul nouveau actual_gain
      const newActualGain = new_result === "won" ? step.potential_gain : (new_result === "lost" ? 0 : null);

      await supabaseAdmin
        .from("montante_steps")
        .update({
          result: new_result,
          actual_gain: newActualGain,
          completed_at: new_result === "pending" ? null : new Date().toISOString(),
        })
        .eq("id", step_id);

      // Recalcul status + profit de la montante
      let newMontanteStatus: "active" | "won" | "lost" = "active";
      let newProfit = 0;

      if (new_result === "lost") {
        newMontanteStatus = "lost";
        newProfit = -parseFloat(montante.initial_stake);
      } else if (new_result === "won") {
        const isLastStep = step.step_number >= montante.total_steps;
        const reachedTarget = montante.target_amount && newActualGain! >= parseFloat(montante.target_amount);

        if (isLastStep || reachedTarget) {
          newMontanteStatus = "won";
          newProfit = newActualGain! - parseFloat(montante.initial_stake);
        } else {
          newMontanteStatus = "active";
          newProfit = 0;
        }
      } else {
        // pending → montante repasse active, pas de profit
        newMontanteStatus = "active";
        newProfit = 0;
      }

      await supabaseAdmin
        .from("montantes")
        .update({ status: newMontanteStatus, profit: newProfit })
        .eq("id", montante.id);

      return NextResponse.json({ success: true, new_status: newMontanteStatus });
    }

    // ── Cash out (libre mode — end montante with current gain) ──
    if (action === "cash_out") {
      const { montante_id } = body;

      const { data: montante } = await supabaseAdmin
        .from("montantes")
        .select("*")
        .eq("id", montante_id)
        .eq("user_id", user.id)
        .single();

      if (!montante) return NextResponse.json({ error: "Not found" }, { status: 404 });
      if (montante.status !== "active") return NextResponse.json({ error: "Not active" }, { status: 400 });

      // Get last won step gain
      const { data: lastWonStep } = await supabaseAdmin
        .from("montante_steps")
        .select("actual_gain")
        .eq("montante_id", montante_id)
        .eq("result", "won")
        .order("step_number", { ascending: false })
        .limit(1)
        .single();

      const cashOutAmount = lastWonStep?.actual_gain ? parseFloat(lastWonStep.actual_gain) : 0;
      if (cashOutAmount <= 0) return NextResponse.json({ error: "Nothing to cash out" }, { status: 400 });

      const profit = cashOutAmount - parseFloat(montante.initial_stake);

      // Update montante
      await supabaseAdmin
        .from("montantes")
        .update({ status: "won", profit, total_steps: montante.current_step })
        .eq("id", montante_id);

      return NextResponse.json({ status: "won", profit });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });

  } catch (err: any) {
    console.error("[montantes] POST error:", err.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ── DELETE — Delete montante ──
export async function DELETE(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const montanteId = searchParams.get("id");

  if (!montanteId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    // Verify ownership
    const { data: montante } = await supabaseAdmin
      .from("montantes")
      .select("id, user_id")
      .eq("id", montanteId)
      .eq("user_id", user.id)
      .single();

    if (!montante) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Delete steps then montante
    await supabaseAdmin.from("montante_steps").delete().eq("montante_id", montanteId);
    await supabaseAdmin.from("montantes").delete().eq("id", montanteId);

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error("[montantes] DELETE error:", err.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}