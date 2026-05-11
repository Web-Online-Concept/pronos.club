/**
 * ═══════════════════════════════════════════════════════════════════
 * /api/notifications/subscribe (V3.5 Lot 14 + fix bug notif 11/05/26)
 * ═══════════════════════════════════════════════════════════════════
 *
 * V3.5 Lot 14 (10/05/2026) :
 *   - Quand l'utilisateur souscrit au push browser, on active automatiquement
 *     les 3 toggles côté users : notify_push (global) + notify_tipster_push +
 *     notify_abonnes_push.
 *   - Logique : 1 seul abonnement push physique partagé entre les catégories.
 *     Les toggles déterminent qui reçoit quoi côté serveur.
 *   - Quand l'utilisateur désinscrit, tous les toggles push sont remis à false.
 *
 * Fix bugs notif (11/05/2026) :
 *   - Bug #1 : Sync tipster_notif_prefs.channel_push
 *     Source de vérité Section 5 (Pronos Abonnés) côté UI = colonne
 *     channel_push de tipster_notif_prefs. Avant ce fix, l'activation push
 *     globale ne touchait QUE users.notify_abonnes_push, donc la Section 5
 *     affichait toujours OFF même après activation. Maintenant on upsert
 *     tipster_notif_prefs.channel_push à true (POST) ou false (DELETE).
 *     Le mode 'none' (kill switch) est promu à 'selected' à l'activation
 *     pour que les notifs puissent réellement partir. 'all' est préservé.
 *   - Bug #5 : endpoint_domain stocke maintenant le vrai hostname
 *     (push.apple.com, fcm.googleapis.com, etc.) au lieu de dupliquer
 *     la valeur platform.
 *
 * Path : src/app/api/notifications/subscribe/route.ts
 * ═══════════════════════════════════════════════════════════════════
 */

import { requireAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

function detectPlatform(endpoint: string): string {
  if (endpoint.includes("push.apple.com")) return "ios";
  if (endpoint.includes("fcm.googleapis.com")) return "android";
  if (endpoint.includes("mozilla.com")) return "firefox";
  if (endpoint.includes("windows.com")) return "windows";
  return "other";
}

function extractEndpointHostname(endpoint: string): string {
  try {
    return new URL(endpoint).hostname;
  } catch {
    return "unknown";
  }
}

export async function POST(request: Request) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subscription = await request.json();

  if (!subscription || typeof subscription !== "object" || !subscription.endpoint) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  // ─── 1. UPDATE users : subscription + flags catégorie ───
  const { error: userErr } = await supabaseAdmin
    .from("users")
    .update({
      push_subscription: subscription,
      notify_push: true,
      notify_tipster_push: true,
      notify_abonnes_push: true,
    })
    .eq("id", user.id);

  if (userErr) {
    return NextResponse.json({ error: userErr.message }, { status: 500 });
  }

  // ─── 2. Fix bug #1 — Sync tipster_notif_prefs.channel_push ───
  // Source de vérité Section 5 côté UI. Upsert manuel (Supabase n'a pas onConflict
  // simple sur user_id ici sans contrainte unique nommée — on check d'abord).
  try {
    const { data: existing } = await supabaseAdmin
      .from("tipster_notif_prefs")
      .select("user_id, mode")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      // Ligne existante : update channel_push + remonter mode si 'none'
      await supabaseAdmin
        .from("tipster_notif_prefs")
        .update({
          channel_push: true,
          // Si l'utilisateur avait 'none' (kill switch global), on remonte
          // à 'selected' pour que les notifs puissent partir. Si 'all', on garde.
          mode: existing.mode === "none" ? "selected" : existing.mode,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
    } else {
      // Pas de ligne : insert avec defaults sensés
      await supabaseAdmin
        .from("tipster_notif_prefs")
        .insert({
          user_id: user.id,
          mode: "selected",
          channel_email: true,
          channel_telegram: false,
          channel_push: true,
        });
    }
  } catch (e) {
    // Erreur non fatale : la souscription push reste valide même si tipster_notif_prefs
    // n'a pas pu être mis à jour. On log et on continue.
    console.error("[subscribe] tipster_notif_prefs sync failed", e);
  }

  // ─── 3. Log de souscription ───
  const platform = detectPlatform(subscription.endpoint);
  const endpointDomain = extractEndpointHostname(subscription.endpoint);

  await supabaseAdmin.from("notification_logs").insert({
    pick_id: null,
    user_id: user.id,
    channel: "subscribe",
    status: "sent",
    sent_at: new Date().toISOString(),
    error: null,
    platform,
    endpoint_domain: endpointDomain,
    status_code: 200,
  });

  return NextResponse.json({ ok: true, platform });
}

export async function DELETE() {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ─── 1. UPDATE users : effacer subscription + couper flags catégorie ───
  const { error: userErr } = await supabaseAdmin
    .from("users")
    .update({
      push_subscription: null,
      notify_push: false,
      notify_tipster_push: false,
      notify_abonnes_push: false,
    })
    .eq("id", user.id);

  if (userErr) {
    return NextResponse.json({ error: userErr.message }, { status: 500 });
  }

  // ─── 2. Fix bug #1 — Sync tipster_notif_prefs.channel_push = false ───
  // On ne touche QUE channel_push : on préserve mode, channel_email, channel_telegram
  // (l'utilisateur peut vouloir garder ses prefs email/telegram et juste couper le push).
  // Si la ligne n'existe pas, on ne fait rien : défaut DB est false de toute façon.
  try {
    await supabaseAdmin
      .from("tipster_notif_prefs")
      .update({
        channel_push: false,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);
  } catch (e) {
    console.error("[unsubscribe] tipster_notif_prefs sync failed", e);
  }

  // ─── 3. Log de désinscription ───
  await supabaseAdmin.from("notification_logs").insert({
    pick_id: null,
    user_id: user.id,
    channel: "unsubscribe",
    status: "sent",
    sent_at: new Date().toISOString(),
    error: null,
    platform: null,
    endpoint_domain: null,
    status_code: 200,
  });

  return NextResponse.json({ ok: true });
}