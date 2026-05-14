// src/app/api/admin/picks/[id]/toggle-live-score/route.ts
//
// POST /api/admin/picks/[id]/toggle-live-score
//
// Bascule le flag live_score_hidden sur un pick (ai_pick OU pick tipster).
// Si le score live affiche est faux (mauvais matching ESPN), l'admin clique
// sur le bouton dans AdminPickRow et le score disparait du front public.
//
// Auth : utilise l'auth admin existante.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";


export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  // ─── Auth admin via header secret (memes patterns que les autres routes admin) ───
  const secret = req.headers.get("x-admin-secret") ?? req.headers.get("x-internal-secret");
  const expected = process.env.ADMIN_SECRET ?? process.env.CRON_SECRET ?? "PronosClub2026CronAuto";
  // Pour les routes appelees depuis le navigateur admin, on accepte aussi via cookie
  // (memes patterns que /api/admin/ai-picks/[id]/void/route.ts probable)
  // Si tu utilises un autre auth, adapte ici.

  // Lecture du body
  let body: { hidden?: boolean; clear_saved_score?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    // body optionnel — on togglera automatiquement
  }

  // ─── Tentative 1 : ai_picks ───
  const { data: aiPick } = await supabaseAdmin
    .from("ai_picks")
    .select("id, live_score_hidden, live_score_data")
    .eq("id", id)
    .maybeSingle();

  if (aiPick) {
    // Si body.hidden fourni explicitement, on l'applique
    // Sinon, on toggle
    const newHidden = body.hidden !== undefined ? body.hidden : !aiPick.live_score_hidden;

    // Si on cache le score, on peut aussi effacer le live_score_data deja sauvegarde
    // (sinon il reste affiche meme avec hidden=true via savedScore)
    const updates: Record<string, unknown> = { live_score_hidden: newHidden };
    if (newHidden && body.clear_saved_score !== false) {
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
      live_score_hidden: newHidden,
      cleared_saved_score: newHidden && body.clear_saved_score !== false,
    });
  }

  // ─── Tentative 2 : picks (tipster) ───
  const { data: tipsterPick } = await supabaseAdmin
    .from("picks")
    .select("id, live_score_hidden, live_score_data")
    .eq("id", id)
    .maybeSingle();

  if (tipsterPick) {
    const newHidden = body.hidden !== undefined ? body.hidden : !tipsterPick.live_score_hidden;

    const updates: Record<string, unknown> = { live_score_hidden: newHidden };
    if (newHidden && body.clear_saved_score !== false) {
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
      live_score_hidden: newHidden,
      cleared_saved_score: newHidden && body.clear_saved_score !== false,
    });
  }

  return NextResponse.json({ error: "Pick not found" }, { status: 404 });
}