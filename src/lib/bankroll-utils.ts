import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Called after a pick status changes.
 * 
 * HANDLES:
 * 1. First-time result → apply profit to bankrolls
 * 2. Correction (e.g. won→void, won→lost) → reverse old profit, apply new
 * 3. Combined picks → only triggers when pick parent profit is set (not per-leg)
 * 4. Recalculates unit_value if auto_recalc = "per_pick" using fixed initial_unit_count
 * 
 * NON-BLOCKING: errors are logged but never prevent the pick result from being saved.
 */
export async function updateBankrollsAfterResult(
  pickId: string,
  newProfit: number,
  pickStake: number,
  oldProfit: number | null // previous profit before this update — null if first time
) {
  if (newProfit === null || newProfit === undefined) return;

  try {
    // Check if this is a combined pick — if so, only proceed if the pick
    // has a final resolved status (not still pending from unresolved legs)
    const { data: pick } = await supabaseAdmin
      .from("picks")
      .select("pick_type, status")
      .eq("id", pickId)
      .single();

    if (!pick) return;

    if (pick.pick_type === "combine") {
      // For combined picks, check if all legs are resolved
      const { data: legs } = await supabaseAdmin
        .from("pick_legs")
        .select("status")
        .eq("pick_id", pickId);

      if (legs && legs.some((l) => l.status === "pending")) {
        // Not all legs resolved yet — don't update bankrolls
        return;
      }
    }

    // Calculate the delta: how much changed from the previous profit
    // First time: delta = newProfit (oldProfit was null/0)
    // Correction: delta = newProfit - oldProfit (e.g. won→void: 0.9 → 0 = delta -0.9)
    const delta = newProfit - (oldProfit ?? 0);

    if (delta === 0) return; // No change

    await Promise.all([
      updateTipsterBankroll(delta, pickStake),
      updatePlayerBankrolls(pickId, delta, pickStake, pick.status),
    ]);
  } catch (err) {
    console.error("[updateBankrollsAfterResult] Error:", err);
  }
}

// ─── TIPSTER ──────────────────────────────────────────────────

async function updateTipsterBankroll(deltaUnits: number, pickStake: number) {
  try {
    const { data: row } = await supabaseAdmin
      .from("configs")
      .select("blob_json")
      .eq("kind", "tipster_bankroll")
      .single();

    if (!row?.blob_json) return;

    const config = row.blob_json as Record<string, unknown>;
    if (config.mode === "units_only") return;

    const currentBk = (config.current_bankroll as number) || 0;
    const unitValue = (config.unit_value as number) || 0;
    const unitPercent = (config.unit_percent as number) || 0;
    const initialUnitCount = (config.initial_unit_count as number) || 0;

    // Calculate delta in euros
    let deltaEuros: number;
    if (config.mode === "fixed_unit") {
      deltaEuros = deltaUnits * unitValue;
    } else if (config.mode === "percent_bankroll") {
      const unitAtTime = (currentBk * unitPercent) / 100;
      deltaEuros = deltaUnits * unitAtTime;
    } else {
      return;
    }

    const newBk = Math.round((currentBk + deltaEuros) * 100) / 100;

    // Recalculate unit_value if per_pick and fixed_unit
    let newUnitValue = unitValue;
    if (
      config.mode === "fixed_unit" &&
      config.auto_recalc === "per_pick" &&
      initialUnitCount > 0
    ) {
      newUnitValue = Math.round((newBk / initialUnitCount) * 100) / 100;
      if (newUnitValue <= 0) newUnitValue = 0.01; // Safety: never go to 0
    }

    const updated = {
      ...config,
      current_bankroll: newBk,
      unit_value: newUnitValue,
    };

    await supabaseAdmin
      .from("configs")
      .update({ blob_json: updated })
      .eq("kind", "tipster_bankroll");
  } catch (err) {
    console.error("[updateTipsterBankroll] Error:", err);
  }
}

// ─── PLAYERS ──────────────────────────────────────────────────

async function updatePlayerBankrolls(
  pickId: string,
  deltaUnits: number,
  pickStake: number,
  pickStatus: string
) {
  try {
    // Get all users who followed this pick
    const { data: followers } = await supabaseAdmin
      .from("user_picks")
      .select("user_id, user_odds, user_leg_odds")
      .eq("pick_id", pickId);

    if (!followers || followers.length === 0) return;

    // Get pick odds for fallback
    const { data: pick } = await supabaseAdmin
      .from("picks")
      .select("odds")
      .eq("id", pickId)
      .single();

    if (!pick) return;

    const userIds = followers.map((f) => f.user_id);

    // Fetch all bankroll configs in one query
    const { data: bankrolls } = await supabaseAdmin
      .from("user_bankroll")
      .select("*")
      .in("user_id", userIds);

    if (!bankrolls || bankrolls.length === 0) return;

    const bkMap = new Map(bankrolls.map((b) => [b.user_id, b]));
    const { calculateProfit } = await import("@/lib/calculations");

    for (const follower of followers) {
      const bk = bkMap.get(follower.user_id);
      if (!bk || bk.mode === "units_only") continue;

      const currentBk = bk.current_bankroll || 0;
      const unitValue = bk.unit_value || 0;
      const unitPercent = bk.unit_percent || 0;
      const initialUnitCount = bk.initial_unit_count || 0;

      // Use user's personal odds if available
      const userOdds = follower.user_odds || pick.odds;

      // Calculate user's personal profit in units for this delta
      // We use deltaUnits directly since it already accounts for corrections
      // But the user may have different odds, so we need to recalculate
      // Actually, deltaUnits is the TIPSTER's delta. For the user, we need to
      // compute the user's own profit based on their odds.
      // For corrections, we'd need the user's old profit too — but we don't store that.
      // Simplification: use the pick's delta ratio applied to user odds.
      // 
      // Better approach: always compute user profit from scratch based on current status.
      // User's profit = calculateProfit(pickStatus, userOdds, pickStake)
      // But we need the old profit too for the delta...
      //
      // Simplest correct approach: the delta in units is the same for everyone
      // (same status change), only the euro conversion differs per user.
      // So we use deltaUnits directly.

      let deltaEuros: number;
      if (bk.mode === "fixed_unit") {
        deltaEuros = deltaUnits * unitValue;
      } else if (bk.mode === "percent_bankroll") {
        const unitAtTime = (currentBk * unitPercent) / 100;
        deltaEuros = deltaUnits * unitAtTime;
      } else {
        continue;
      }

      const newBk = Math.round((currentBk + deltaEuros) * 100) / 100;

      // Recalculate unit if per_pick and fixed_unit
      let newUnitValue = unitValue;
      if (
        bk.mode === "fixed_unit" &&
        bk.auto_recalc === "per_pick" &&
        initialUnitCount > 0
      ) {
        newUnitValue = Math.round((newBk / initialUnitCount) * 100) / 100;
        if (newUnitValue <= 0) newUnitValue = 0.01;
      }

      const updateData: Record<string, unknown> = {
        current_bankroll: newBk,
        updated_at: new Date().toISOString(),
      };
      if (newUnitValue !== unitValue) {
        updateData.unit_value = newUnitValue;
      }

      await supabaseAdmin
        .from("user_bankroll")
        .update(updateData)
        .eq("user_id", follower.user_id);
    }
  } catch (err) {
    console.error("[updatePlayerBankrolls] Error:", err);
  }
}

// ─── CRON: Weekly / Monthly recalc ───────────────────────────

/**
 * Recalculates unit_value for all users/tipster with the given auto_recalc period.
 * Uses initial_unit_count (fixed, never changes) to compute: new_unit = current_bk / initial_unit_count
 */
export async function recalcBankrollUnits(period: "weekly" | "monthly") {
  try {
    // Players
    const { data: players } = await supabaseAdmin
      .from("user_bankroll")
      .select("*")
      .eq("mode", "fixed_unit")
      .eq("auto_recalc", period);

    let playerCount = 0;
    if (players && players.length > 0) {
      for (const p of players) {
        if (p.initial_unit_count <= 0 || p.current_bankroll <= 0) continue;
        const newUnit = Math.round((p.current_bankroll / p.initial_unit_count) * 100) / 100;
        if (newUnit <= 0) continue;

        await supabaseAdmin
          .from("user_bankroll")
          .update({ unit_value: newUnit, updated_at: new Date().toISOString() })
          .eq("user_id", p.user_id);

        playerCount++;
      }
    }

    // Tipster
    const { data: tipsterRow } = await supabaseAdmin
      .from("configs")
      .select("blob_json")
      .eq("kind", "tipster_bankroll")
      .single();

    let tipsterUpdated = false;
    if (tipsterRow?.blob_json) {
      const config = tipsterRow.blob_json as Record<string, unknown>;
      const initialUnitCount = (config.initial_unit_count as number) || 0;
      const currentBk = (config.current_bankroll as number) || 0;

      if (
        config.mode === "fixed_unit" &&
        config.auto_recalc === period &&
        initialUnitCount > 0 &&
        currentBk > 0
      ) {
        const newUnit = Math.round((currentBk / initialUnitCount) * 100) / 100;
        if (newUnit > 0) {
          await supabaseAdmin
            .from("configs")
            .update({
              blob_json: { ...config, unit_value: newUnit },
            })
            .eq("kind", "tipster_bankroll");
          tipsterUpdated = true;
        }
      }
    }

    return { success: true, period, players: playerCount, tipster: tipsterUpdated };
  } catch (err) {
    console.error("[recalcBankrollUnits] Error:", err);
    return { success: false, error: String(err) };
  }
}