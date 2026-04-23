// src/app/api/admin/tipster-picks/route.ts
// Admin : mod\u00e9ration des picks tipsters (liste, r\u00e9solution, suppression)

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
      // Picks live dont le match est termin\u00e9 (depuis 2h pour \u00eatre s\u00fbr)
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

// ── PATCH : r\u00e9soudre / modifier / rejeter un pick ──
export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { pick_id, action, result, admin_note } = body;

  if (!pick_id) return NextResponse.json({ error: "Missing pick_id" }, { status: 400 });

  try {
    const { data: pick } = await supabaseAdmin
      .from("tipster_picks")
      .select("*")
      .eq("id", pick_id)
      .single();

    if (!pick) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (action === "resolve") {
      // R\u00e9soudre le pick avec un r\u00e9sultat
      if (!result || !["won", "half_won", "refunded", "half_lost", "lost"].includes(result)) {
        return NextResponse.json({ error: "R\u00e9sultat invalide" }, { status: 400 });
      }
      const unitsResult = computeUnitsResult(result, pick.odds);
      const { data: updated, error } = await supabaseAdmin
        .from("tipster_picks")
        .update({
          status: "resolved",
          result,
          units_result: unitsResult,
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
      // Modifier un r\u00e9sultat d\u00e9j\u00e0 enregistr\u00e9
      if (!result || !["won", "half_won", "refunded", "half_lost", "lost"].includes(result)) {
        return NextResponse.json({ error: "R\u00e9sultat invalide" }, { status: 400 });
      }
      const unitsResult = computeUnitsResult(result, pick.odds);
      const { data: updated, error } = await supabaseAdmin
        .from("tipster_picks")
        .update({
          result,
          units_result: unitsResult,
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
          admin_note: admin_note || "Rejet\u00e9 par l'administration",
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
      // Remettre en live (ex: si r\u00e9sultat contest\u00e9)
      const { data: updated, error } = await supabaseAdmin
        .from("tipster_picks")
        .update({
          status: "live",
          result: null,
          units_result: null,
          resolved_at: null,
          resolved_by: null,
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

// ── DELETE : supprimer d\u00e9finitivement un pick (y compris le screen) ──
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