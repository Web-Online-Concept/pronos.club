// src/app/api/admin/picks/[id]/toggle-live-score/route.ts
//
// POST /api/admin/picks/[id]/toggle-live-score
//
// Body : {
//   type: "live_only" | "full",   // type de cache
//   hidden: boolean                // true = cacher / false = afficher
// }
//
// 2 types de cache :
//   - "live_only" : cache le score live PENDANT le match (ESPN se trompe live)
//                   mais affiche le score final une fois le match termine
//   - "full"      : cache TOUJOURS le score (live ET final)
//
// Si hidden=true, on efface aussi `live_score_data` pour vider le cache.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";


type HideType = "live_only" | "full";
type ToggleBody = {
  type: HideType;
  hidden: boolean;
};


export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  let body: ToggleBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.type || (body.type !== "live_only" && body.type !== "full")) {
    return NextResponse.json(
      { error: "Missing or invalid 'type' (expected 'live_only' or 'full')" },
      { status: 400 }
    );
  }

  if (typeof body.hidden !== "boolean") {
    return NextResponse.json(
      { error: "Missing 'hidden' boolean" },
      { status: 400 }
    );
  }

  // Choix de la colonne a updater
  const columnName =
    body.type === "live_only"
      ? "live_score_hide_during_match"
      : "live_score_hide_completely";

  // ─── Tentative 1 : ai_picks ───
  const { data: aiPick } = await supabaseAdmin
    .from("ai_picks")
    .select(`id, live_score_hide_during_match, live_score_hide_completely`)
    .eq("id", id)
    .maybeSingle();

  if (aiPick) {
    const updates: Record<string, unknown> = { [columnName]: body.hidden };
    // Quand on cache (live_only OU full), on efface aussi le score sauvegarde
    // pour eviter qu'il continue d'apparaitre via savedScore.
    // Si on RE-AFFICHE (hidden=false), on garde live_score_data tel quel.
    if (body.hidden) {
      updates.live_score_data = null;
    }

    const { error: updErr } = await supabaseAdmin
      .from("ai_picks")
      .update(updates)
      .eq("id", id);

    if (updErr) {
      return NextResponse.json(
        { error: "Update failed", details: updErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      table: "ai_picks",
      id,
      column: columnName,
      hidden: body.hidden,
      cleared_saved_score: body.hidden,
    });
  }

  // ─── Tentative 2 : picks (tipster) ───
  const { data: tipsterPick } = await supabaseAdmin
    .from("picks")
    .select(`id, live_score_hide_during_match, live_score_hide_completely`)
    .eq("id", id)
    .maybeSingle();

  if (tipsterPick) {
    const updates: Record<string, unknown> = { [columnName]: body.hidden };
    if (body.hidden) {
      updates.live_score_data = null;
    }

    const { error: updErr } = await supabaseAdmin
      .from("picks")
      .update(updates)
      .eq("id", id);

    if (updErr) {
      return NextResponse.json(
        { error: "Update failed", details: updErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      table: "picks",
      id,
      column: columnName,
      hidden: body.hidden,
      cleared_saved_score: body.hidden,
    });
  }

  return NextResponse.json({ error: "Pick not found" }, { status: 404 });
}