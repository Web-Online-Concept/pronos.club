// src/app/api/admin/test-tipster-notif/route.ts
// Endpoint admin pour tester notifyFollowersOfNewPick sans créer de vrai pick.
// Usage:
//   POST /api/admin/test-tipster-notif
//   Body: { tipsterEmail: "joel.chemarin@gmail.com" }
//
// Effet de bord : poste sur le canal Telegram public @pronos_abonnes_club
// (même comportement qu'un vrai pick — supprimer le message après le test
// si besoin).

import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { notifyFollowersOfNewPick } from "@/lib/tipster-notifications";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { tipsterEmail } = body;

  if (!tipsterEmail) {
    return NextResponse.json({ error: "tipsterEmail required" }, { status: 400 });
  }

  // Récupère le tipster
  const { data: tipster } = await supabaseAdmin
    .from("users")
    .select("id, pseudo, avatar_url")
    .eq("email", tipsterEmail)
    .single();

  if (!tipster) {
    return NextResponse.json({ error: "Tipster not found" }, { status: 404 });
  }

  // Pick fictif (NON INSÉRÉ en DB)
  const fakePick = {
    id: `test-${Date.now()}`,
    user_id: tipster.id,
    sport: "⚽ Test Football",
    odds: 2.0,
    pick_type: "simple",
    match_date: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    bookmaker: "Winamax",
  };

  try {
    await notifyFollowersOfNewPick(fakePick, {
      id: tipster.id,
      pseudo: tipster.pseudo || "TIPSTER TEST",
      avatar_url: tipster.avatar_url || null,
    });
    return NextResponse.json({
      ok: true,
      tipster: { id: tipster.id, pseudo: tipster.pseudo, email: tipsterEmail },
      note: "Vérifier email_logs (category=new_pick_abonnes) et notification_logs pour les destinataires. Le canal Telegram public a aussi reçu un message — à supprimer manuellement si besoin.",
    });
  } catch (err: any) {
    console.error("[test-tipster-notif] error:", err);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}