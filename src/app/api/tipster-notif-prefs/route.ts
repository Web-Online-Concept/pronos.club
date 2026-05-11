// src/app/api/tipster-notif-prefs/route.ts
// Préférences globales de notifs Pronos Abonnés
//
// Fix bugs notif (11/05/2026) :
//   - Bug B — Miroir vers users.notify_abonnes_push et notify_abonnes_email.
//     Avant ce fix, le PATCH ne touchait que tipster_notif_prefs. Or
//     /api/notifications/send avec category="abonnes" filtre sur
//     users.notify_abonnes_push. Sans miroir, une désactivation Section 5
//     n'aurait aucun effet sur cet envoyeur (préparé pour futur usage).
//     Maintenant les 2 tables restent cohérentes : tipster_notif_prefs
//     = source de vérité côté UI + envoyeur tipster-notifications.ts,
//     users.notify_abonnes_* = miroir pour /api/notifications/send et
//     pour les requêtes admin par filtre direct.

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
  return user;
}

// ── GET : récupérer les prefs du user connecté ──
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { data } = await supabaseAdmin
      .from("tipster_notif_prefs")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!data) {
      // Pas encore de prefs : retourner les valeurs par défaut
      return NextResponse.json({
        prefs: {
          mode: "none",
          channel_email: true,
          channel_telegram: false,
          channel_push: false,
        },
      });
    }

    return NextResponse.json({ prefs: data });
  } catch (err: any) {
    console.error("[tipster-notif-prefs] GET error:", err.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ── PATCH : mettre à jour les prefs ──
export async function PATCH(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { mode, channel_email, channel_telegram, channel_push } = body;

  if (mode && !["none", "all", "selected"].includes(mode)) {
    return NextResponse.json({ error: "Mode invalide" }, { status: 400 });
  }

  try {
    const updateData: any = { updated_at: new Date().toISOString() };
    if (mode !== undefined) updateData.mode = mode;
    if (typeof channel_email === "boolean") updateData.channel_email = channel_email;
    if (typeof channel_telegram === "boolean") updateData.channel_telegram = channel_telegram;
    if (typeof channel_push === "boolean") updateData.channel_push = channel_push;

    // Upsert : crée la ligne si elle n'existe pas
    const { data: existing } = await supabaseAdmin
      .from("tipster_notif_prefs")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      const { error } = await supabaseAdmin
        .from("tipster_notif_prefs")
        .update(updateData)
        .eq("user_id", user.id);
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin
        .from("tipster_notif_prefs")
        .insert({
          user_id: user.id,
          mode: updateData.mode || "none",
          channel_email: updateData.channel_email ?? true,
          channel_telegram: updateData.channel_telegram ?? false,
          channel_push: updateData.channel_push ?? false,
        });
      if (error) throw error;
    }

    // ─── Fix bug B — Miroir vers users.notify_abonnes_* ───
    // Garde la cohérence avec /api/notifications/send qui filtre sur
    // users.notify_abonnes_push / notify_abonnes_email pour category="abonnes".
    // On miroir UNIQUEMENT les champs explicitement passés dans le body.
    const mirrorUpdates: Record<string, boolean> = {};
    if (typeof channel_push === "boolean") {
      mirrorUpdates.notify_abonnes_push = channel_push;
    }
    if (typeof channel_email === "boolean") {
      mirrorUpdates.notify_abonnes_email = channel_email;
    }
    if (Object.keys(mirrorUpdates).length > 0) {
      const { error: mirrorErr } = await supabaseAdmin
        .from("users")
        .update(mirrorUpdates)
        .eq("id", user.id);
      if (mirrorErr) {
        // Non fatal : la pref principale a été sauvegardée. On log.
        console.error("[tipster-notif-prefs] miroir users échoué:", mirrorErr.message);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[tipster-notif-prefs] PATCH error:", err.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}