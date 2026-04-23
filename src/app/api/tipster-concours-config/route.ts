// src/app/api/tipster-concours-config/route.ts
// Config du concours tipsters
// - GET : config publique (applique auto les valeurs programmées échues)
// - PATCH action=update : change la valeur immédiatement
// - PATCH action=schedule : programme une nouvelle valeur pour la prochaine période
// - PATCH action=cancel_schedule : annule la valeur programmée
// - GET ?mode=full : retourne tout (config + scheduled) pour la page admin
// - GET ?mode=history : retourne l'historique des changements

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getConcoursConfig, getConcoursConfigFull, getNextPeriodStart } from "@/lib/tipster-concours-config";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getAdminUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabaseAdmin
    .from("users")
    .select("id, is_admin")
    .eq("id", user.id)
    .single();

  return profile?.is_admin ? profile : null;
}

// ── GET ──
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode");

  if (mode === "history") {
    // Historique : admin seulement
    const admin = await getAdminUser();
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const periodType = searchParams.get("period_type");
    let query = supabaseAdmin
      .from("tipster_concours_config_history")
      .select("*")
      .order("effective_from", { ascending: false })
      .limit(50);

    if (periodType === "week" || periodType === "month") {
      query = query.eq("period_type", periodType);
    }

    const { data, error } = await query;
    if (error) {
      console.error("[concours-config] history error:", error.message);
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
    return NextResponse.json({ history: data || [] });
  }

  if (mode === "full") {
    // Config complète (avec scheduled) : admin seulement
    const admin = await getAdminUser();
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const full = await getConcoursConfigFull();
    return NextResponse.json(full);
  }

  // Public : config simple (auto-applique les scheduled échus)
  const config = await getConcoursConfig();
  return NextResponse.json(config);
}

// ── PATCH : admin seulement ──
export async function PATCH(req: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { action, period_type, prize_amount, min_picks, active } = body;

  if (!["week", "month"].includes(period_type)) {
    return NextResponse.json({ error: "Invalid period_type" }, { status: 400 });
  }

  try {
    // ═══════ ANNULER UNE VALEUR PROGRAMMÉE ═══════
    if (action === "cancel_schedule") {
      const { data, error } = await supabaseAdmin
        .from("tipster_concours_config")
        .update({
          scheduled_prize_amount: null,
          scheduled_min_picks: null,
          scheduled_active: null,
          scheduled_effective_date: null,
          updated_at: new Date().toISOString(),
        })
        .eq("period_type", period_type)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ config: data });
    }

    // ═══════ PROGRAMMER UNE NOUVELLE VALEUR ═══════
    if (action === "schedule") {
      const updateData: any = {
        scheduled_effective_date: getNextPeriodStart(period_type).toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (prize_amount !== undefined) {
        const n = parseFloat(String(prize_amount));
        if (isNaN(n) || n < 0) return NextResponse.json({ error: "Prize invalide" }, { status: 400 });
        updateData.scheduled_prize_amount = n;
      }
      if (min_picks !== undefined) {
        const n = parseInt(String(min_picks), 10);
        if (isNaN(n) || n < 1) return NextResponse.json({ error: "Min picks invalide" }, { status: 400 });
        updateData.scheduled_min_picks = n;
      }
      if (typeof active === "boolean") {
        updateData.scheduled_active = active;
      }

      // Au moins un champ scheduled_* doit être défini
      if (updateData.scheduled_prize_amount === undefined &&
          updateData.scheduled_min_picks === undefined &&
          updateData.scheduled_active === undefined) {
        return NextResponse.json({ error: "Rien à programmer" }, { status: 400 });
      }

      const { data, error } = await supabaseAdmin
        .from("tipster_concours_config")
        .update(updateData)
        .eq("period_type", period_type)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ config: data });
    }

    // ═══════ MODIFICATION IMMÉDIATE (défaut) ═══════
    const updateData: any = { updated_at: new Date().toISOString() };
    if (prize_amount !== undefined) {
      const n = parseFloat(String(prize_amount));
      if (isNaN(n) || n < 0) return NextResponse.json({ error: "Prize invalide" }, { status: 400 });
      updateData.prize_amount = n;
    }
    if (min_picks !== undefined) {
      const n = parseInt(String(min_picks), 10);
      if (isNaN(n) || n < 1) return NextResponse.json({ error: "Min picks invalide" }, { status: 400 });
      updateData.min_picks = n;
    }
    if (typeof active === "boolean") {
      updateData.active = active;
    }

    // Lire l'ancienne valeur pour historiser
    const { data: oldConfig } = await supabaseAdmin
      .from("tipster_concours_config")
      .select("*")
      .eq("period_type", period_type)
      .single();

    const now = new Date().toISOString();

    // Fermer l'entrée historique courante et en créer une nouvelle
    if (oldConfig) {
      await supabaseAdmin
        .from("tipster_concours_config_history")
        .update({ effective_to: now })
        .eq("period_type", period_type)
        .is("effective_to", null);

      await supabaseAdmin
        .from("tipster_concours_config_history")
        .insert({
          period_type,
          prize_amount: updateData.prize_amount ?? oldConfig.prize_amount,
          min_picks: updateData.min_picks ?? oldConfig.min_picks,
          active: updateData.active ?? oldConfig.active,
          effective_from: now,
          created_by: admin.id,
        });
    }

    const { data, error } = await supabaseAdmin
      .from("tipster_concours_config")
      .update(updateData)
      .eq("period_type", period_type)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ config: data });

  } catch (err: any) {
    console.error("[tipster-concours-config] PATCH error:", err.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}