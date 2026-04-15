// src/app/api/montantes/route.ts
// CRUD montantes + bankroll + steps
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Check premium
  const { data: profile } = await supabaseAdmin
    .from("users")
    .select("subscription_status")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.subscription_status !== "active" && profile.subscription_status !== "trialing")) {
    return null;
  }

  return user;
}

// ── GET — List montantes + bankroll + stats ──
export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") || "list";
  const montanteId = searchParams.get("id");

  try {
    if (action === "bankroll") {
      // Get or create bankroll
      let { data: bankroll } = await supabaseAdmin
        .from("montante_bankroll")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (!bankroll) {
        const { data: newBankroll } = await supabaseAdmin
          .from("montante_bankroll")
          .insert({ user_id: user.id, balance: 0 })
          .select()
          .single();
        bankroll = newBankroll;
      }

      // Get logs
      const { data: logs } = await supabaseAdmin
        .from("montante_bankroll_logs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      return NextResponse.json({ bankroll, logs: logs || [] });
    }

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

// ── POST — Create montante / Add step / Bankroll operations ──
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

      // Delete all bankroll logs
      await supabaseAdmin.from("montante_bankroll_logs").delete().eq("user_id", user.id);

      // Reset bankroll to 0
      await supabaseAdmin
        .from("montante_bankroll")
        .update({ balance: 0 })
        .eq("user_id", user.id);

      return NextResponse.json({ success: true });
    }

    // ── Init or update bankroll ──
    if (action === "bankroll_init" || action === "bankroll_deposit" || action === "bankroll_withdrawal") {
      const amount = parseFloat(body.amount);
      if (!amount || amount <= 0) return NextResponse.json({ error: "Invalid amount" }, { status: 400 });

      // Get or create bankroll
      let { data: bankroll } = await supabaseAdmin
        .from("montante_bankroll")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (!bankroll) {
        const { data: nb } = await supabaseAdmin
          .from("montante_bankroll")
          .insert({ user_id: user.id, balance: 0 })
          .select()
          .single();
        bankroll = nb;
      }

      let newBalance = bankroll!.balance;
      let logType: string;

      if (action === "bankroll_init") {
        newBalance = amount;
        logType = "deposit";
      } else if (action === "bankroll_deposit") {
        newBalance = parseFloat(bankroll!.balance) + amount;
        logType = "deposit";
      } else {
        if (amount > parseFloat(bankroll!.balance)) {
          return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });
        }
        newBalance = parseFloat(bankroll!.balance) - amount;
        logType = "withdrawal";
      }

      await supabaseAdmin
        .from("montante_bankroll")
        .update({ balance: newBalance })
        .eq("user_id", user.id);

      await supabaseAdmin
        .from("montante_bankroll_logs")
        .insert({
          user_id: user.id,
          type: logType,
          amount: logType === "withdrawal" ? -amount : amount,
          balance_after: newBalance,
          note: body.note || (logType === "deposit" ? "Dépôt" : "Retrait"),
        });

      return NextResponse.json({ balance: newBalance });
    }

    // ── Create montante ──
    if (action === "create") {
      const { name, mode, stake_mode, initial_stake, target_amount, total_steps } = body;

      if (!initial_stake || !total_steps || total_steps < 2 || total_steps > 20) {
        return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
      }

      // Check bankroll
      const { data: bankroll } = await supabaseAdmin
        .from("montante_bankroll")
        .select("balance")
        .eq("user_id", user.id)
        .single();

      if (!bankroll || parseFloat(bankroll.balance) < initial_stake) {
        return NextResponse.json({ error: "Insufficient bankroll" }, { status: 400 });
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

      // Deduct from bankroll
      const newBalance = parseFloat(bankroll.balance) - initial_stake;
      await supabaseAdmin
        .from("montante_bankroll")
        .update({ balance: newBalance })
        .eq("user_id", user.id);

      await supabaseAdmin
        .from("montante_bankroll_logs")
        .insert({
          user_id: user.id,
          montante_id: montante!.id,
          type: "stake",
          amount: -initial_stake,
          balance_after: newBalance,
          note: `Mise montante: ${name || "Ma montante"}`,
        });

      return NextResponse.json({ montante, balance: newBalance });
    }

    // ── Add step ──
    if (action === "add_step") {
      const { montante_id, odds, stake: manualStake, description } = body;

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
          description: description || null,
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

        // Log loss
        await supabaseAdmin
          .from("montante_bankroll_logs")
          .insert({
            user_id: user.id,
            montante_id: montante.id,
            type: "loss",
            amount: 0,
            balance_after: (await supabaseAdmin.from("montante_bankroll").select("balance").eq("user_id", user.id).single()).data?.balance || 0,
            note: `Montante perdue: ${montante.name} (étape ${step.step_number})`,
          });

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

        // Credit bankroll
        const { data: bankroll } = await supabaseAdmin
          .from("montante_bankroll")
          .select("balance")
          .eq("user_id", user.id)
          .single();

        const newBalance = parseFloat(bankroll!.balance) + actualGain;
        await supabaseAdmin
          .from("montante_bankroll")
          .update({ balance: newBalance })
          .eq("user_id", user.id);

        await supabaseAdmin
          .from("montante_bankroll_logs")
          .insert({
            user_id: user.id,
            montante_id: montante.id,
            type: "win",
            amount: actualGain,
            balance_after: newBalance,
            note: `Montante réussie: ${montante.name} (+${profit.toFixed(2)}€)`,
          });

        return NextResponse.json({ status: "won", profit, balance: newBalance });
      }

      return NextResponse.json({ status: "step_won", actual_gain: actualGain });
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
      .select("id, user_id, status, initial_stake")
      .eq("id", montanteId)
      .eq("user_id", user.id)
      .single();

    if (!montante) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // If active, refund bankroll
    if (montante.status === "active") {
      const { data: bankroll } = await supabaseAdmin
        .from("montante_bankroll")
        .select("balance")
        .eq("user_id", user.id)
        .single();

      if (bankroll) {
        const newBalance = parseFloat(bankroll.balance) + parseFloat(montante.initial_stake);
        await supabaseAdmin
          .from("montante_bankroll")
          .update({ balance: newBalance })
          .eq("user_id", user.id);

        await supabaseAdmin
          .from("montante_bankroll_logs")
          .insert({
            user_id: user.id,
            montante_id: montante.id,
            type: "withdrawal",
            amount: parseFloat(montante.initial_stake),
            balance_after: newBalance,
            note: `Montante supprimée: remboursement`,
          });
      }
    }

    // Delete steps then montante
    await supabaseAdmin.from("montante_steps").delete().eq("montante_id", montanteId);
    await supabaseAdmin.from("montantes").delete().eq("id", montanteId);

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error("[montantes] DELETE error:", err.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}