// src/app/api/admin/tipster-picks/route.ts
// Admin : moderation des picks tipsters (liste, resolution, suppression)
//
// v2 (avril 2026) : ajout du champ `final_odds` pour gerer les combines
// avec leg rembourse. La cote utilisee pour calculer units_result est :
//   - final_odds si elle est fournie (combine avec remboursement partiel)
//   - sinon la cote `odds` du ticket original

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Helper : detecte si un pick est un combine (supporte les 2 orthographes
// au cas ou le code de soumission stocke avec ou sans accent)
const isComboType = (pickType: string | null | undefined): boolean => {
  if (!pickType) return false;
  const normalized = pickType.toLowerCase().trim();
  return normalized === "combine" || normalized === "combiné";
};

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabaseAdmin
    .from("users")
    .select("id, is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) return null;
  return profile;
}

function computeUnitsResult(result: string | null, odds: number): number | null {
  if (!result) return null;
  const o = parseFloat(String(odds));
  switch (result) {
    case "won":       return Math.round((o - 1) * 1000) / 1000;
    case "half_won":  return Math.round(((o - 1) / 2) * 1000) / 1000;
    case "refunded":  return 0;
    case "half_lost": return -0.5;
    case "lost":      return -1;
    default: return null;
  }
}

// ── GET : liste complète des picks (tous statuts) ──
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter") || "all"; // all | live | resolved | ready_to_resolve

  try {
    let query = supabaseAdmin
      .from("tipster_picks")
      .select(`
        *,
        users:user_id (id, pseudo, avatar_url, email)
      `);

    const now = new Date().toISOString();

    if (filter === "live") {
      query = query.eq("status", "live").order("match_date", { ascending: true });
    } else if (filter === "resolved") {
      query = query.eq("status", "resolved").order("resolved_at", { ascending: false });
    } else if (filter === "ready_to_resolve") {
      // Picks live dont le match est termine (depuis 2h pour etre sur)
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      query = query
        .eq("status", "live")
        .lte("match_date", twoHoursAgo)
        .order("match_date", { ascending: true });
    } else {
      query = query.order("submitted_at", { ascending: false });
    }

    const { data: picks, error } = await query.limit(200);
    if (error) throw error;

    return NextResponse.json({ picks: picks || [] });

  } catch (err: any) {
    console.error("[admin/tipster-picks] GET error:", err.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ── PATCH : resoudre / modifier / rejeter un pick ──
export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { pick_id, action, result, admin_note, final_odds } = body;

  if (!pick_id) return NextResponse.json({ error: "Missing pick_id" }, { status: 400 });

  try {
    const { data: pick } = await supabaseAdmin
      .from("tipster_picks")
      .select("*")
      .eq("id", pick_id)
      .single();

    if (!pick) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // ─── Validation final_odds (si fournie) ──────────────────
    // final_odds n'a de sens que pour un combine ET un resultat won/half_won
    let finalOddsValue: number | null = null;
    if (final_odds !== undefined && final_odds !== null && final_odds !== "") {
      const parsed = parseFloat(String(final_odds));
      if (isNaN(parsed) || parsed < 1.01 || parsed > 1000) {
        return NextResponse.json(
          { error: "Cote finale invalide (doit etre entre 1.01 et 1000)" },
          { status: 400 }
        );
      }
      // Ne pas accepter final_odds sur un pick simple
      if (!isComboType(pick.pick_type)) {
        return NextResponse.json(
          { error: "Cote finale uniquement applicable aux combines" },
          { status: 400 }
        );
      }
      // Ne pas accepter final_odds sur un resultat autre que won/half_won
      if (action === "resolve" || action === "change_result") {
        if (result !== "won" && result !== "half_won") {
          return NextResponse.json(
            { error: "Cote finale uniquement applicable aux combines gagnants" },
            { status: 400 }
          );
        }
      }
      finalOddsValue = parsed;
    }

    if (action === "resolve") {
      // Resoudre le pick avec un resultat
      if (!result || !["won", "half_won", "refunded", "half_lost", "lost"].includes(result)) {
        return NextResponse.json({ error: "Resultat invalide" }, { status: 400 });
      }

      // Cote utilisee pour le calcul : final_odds si fournie, sinon odds du ticket
      const oddsForComputation = finalOddsValue ?? pick.odds;
      const unitsResult = computeUnitsResult(result, oddsForComputation);

      const { data: updated, error } = await supabaseAdmin
        .from("tipster_picks")
        .update({
          status: "resolved",
          result,
          units_result: unitsResult,
          final_odds: finalOddsValue,
          resolved_at: new Date().toISOString(),
          resolved_by: admin.id,
          admin_note: admin_note || null,
        })
        .eq("id", pick_id)
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ pick: updated });
    }

    if (action === "change_result") {
      // Modifier un resultat deja enregistre
      if (!result || !["won", "half_won", "refunded", "half_lost", "lost"].includes(result)) {
        return NextResponse.json({ error: "Resultat invalide" }, { status: 400 });
      }

      // Si le nouveau resultat n'est plus won/half_won, on efface final_odds
      // (cas edge : admin avait mis won + final_odds, puis change pour lost)
      const shouldKeepFinalOdds = result === "won" || result === "half_won";
      const finalOddsToStore = shouldKeepFinalOdds ? finalOddsValue : null;

      const oddsForComputation = finalOddsToStore ?? pick.odds;
      const unitsResult = computeUnitsResult(result, oddsForComputation);

      const { data: updated, error } = await supabaseAdmin
        .from("tipster_picks")
        .update({
          result,
          units_result: unitsResult,
          final_odds: finalOddsToStore,
          admin_note: admin_note || pick.admin_note,
        })
        .eq("id", pick_id)
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ pick: updated });
    }

    if (action === "reject") {
      // Rejeter un pick (ex: boost, triche, etc.)
      const { data: updated, error } = await supabaseAdmin
        .from("tipster_picks")
        .update({
          status: "rejected",
          admin_note: admin_note || "Rejete par l'administration",
          resolved_at: new Date().toISOString(),
          resolved_by: admin.id,
        })
        .eq("id", pick_id)
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ pick: updated });
    }

    if (action === "reopen") {
      // Remettre en live (ex: si resultat conteste)
      // On reset aussi final_odds car le pick repart de zero
      const { data: updated, error } = await supabaseAdmin
        .from("tipster_picks")
        .update({
          status: "live",
          result: null,
          units_result: null,
          final_odds: null,
          resolved_at: null,
          resolved_by: null,
        })
        .eq("id", pick_id)
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ pick: updated });
    }

    if (action === "edit_sport") {
      // Modifier uniquement le sport d'un pick (cas d'erreur de saisie tipster)
      const newSport = body.sport;
      if (!newSport || typeof newSport !== "string" || newSport.trim() === "") {
        return NextResponse.json({ error: "Sport invalide" }, { status: 400 });
      }
      const { data: updated, error } = await supabaseAdmin
        .from("tipster_picks")
        .update({
          sport: newSport.trim(),
          admin_note: admin_note || pick.admin_note,
        })
        .eq("id", pick_id)
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ pick: updated });
    }

    return NextResponse.json({ error: "Action inconnue" }, { status: 400 });

  } catch (err: any) {
    console.error("[admin/tipster-picks] PATCH error:", err.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ── DELETE : supprimer definitivement un pick (y compris le screen) ──
export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const pickId = searchParams.get("id");
  if (!pickId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const { data: pick } = await supabaseAdmin
      .from("tipster_picks")
      .select("*")
      .eq("id", pickId)
      .single();

    if (!pick) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Supprimer l'image du storage
    if (pick.image_url) {
      const pathMatch = pick.image_url.match(/\/tipster-picks\/(.+)$/);
      if (pathMatch) {
        await supabaseAdmin.storage.from("tipster-picks").remove([pathMatch[1]]);
      }
    }

    await supabaseAdmin.from("tipster_picks").delete().eq("id", pickId);

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error("[admin/tipster-picks] DELETE error:", err.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}