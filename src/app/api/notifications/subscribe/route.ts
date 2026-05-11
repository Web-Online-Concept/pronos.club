/**
 * ═══════════════════════════════════════════════════════════════════
 * /api/notifications/subscribe (V3.6 multi-device — 11/05/2026)
 * ═══════════════════════════════════════════════════════════════════
 *
 * V3.6 (11/05/2026) — Multi-device :
 *   - POST : UPSERT dans push_subscriptions par endpoint. Permet à un user
 *     d'avoir plusieurs subs simultanées (PC + Android PWA + iOS PWA).
 *   - DELETE : supprime UNIQUEMENT la sub courante (par endpoint fourni
 *     dans le body) ou TOUTES les subs du user si pas d'endpoint fourni
 *     (cas legacy : ancien PushToggle).
 *   - Miroir users.push_subscription maintenu pour rétrocompat des envoyeurs
 *     actuels (sera supprimé après refonte des envoyeurs).
 *     · POST : stocke la dernière sub créée comme "représentative" (legacy)
 *     · DELETE : si plus aucune sub côté push_subscriptions, on coupe aussi
 *       le miroir + les flags catégories.
 *
 * V3.5 Lot 14 (10/05/2026) — historique :
 *   - 1 push global, granularité par catégorie via notify_tipster_push /
 *     notify_abonnes_push et tipster_notif_prefs.channel_push.
 *
 * Fix bugs notif (11/05/2026) — historique :
 *   - Sync tipster_notif_prefs.channel_push à la souscription/désinscription
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

// ═══════════════════════════════════════════════════════════════════
// POST : abonner le device courant
// Body : { endpoint, keys: { p256dh, auth }, expirationTime? }
//        (PushSubscription.toJSON() côté browser)
// ═══════════════════════════════════════════════════════════════════
export async function POST(request: Request) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subscription = await request.json();

  if (
    !subscription ||
    typeof subscription !== "object" ||
    !subscription.endpoint ||
    !subscription.keys?.p256dh ||
    !subscription.keys?.auth
  ) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  const endpoint: string = subscription.endpoint;
  const p256dh: string = subscription.keys.p256dh;
  const auth: string = subscription.keys.auth;
  const platform = detectPlatform(endpoint);
  const userAgent = request.headers.get("user-agent")?.slice(0, 500) || null;

  // expirationTime peut être un nombre (ms epoch) ou null
  let expirationTime: string | null = null;
  if (subscription.expirationTime && typeof subscription.expirationTime === "number") {
    expirationTime = new Date(subscription.expirationTime).toISOString();
  }

  // ─── 1. UPSERT push_subscriptions par endpoint ───
  // Si l'endpoint existe déjà (chez un autre user ou le même), on UPDATE :
  // - user_id (au cas où un autre user s'est logué sur ce device)
  // - keys (au cas où le provider les a régénérées)
  // - last_seen_at (toujours)
  // - consecutive_failures remis à 0 (re-abonnement = sub vivante)
  const { error: subErr } = await supabaseAdmin
    .from("push_subscriptions")
    .upsert(
      {
        user_id: user.id,
        endpoint,
        p256dh,
        auth,
        expiration_time: expirationTime,
        platform,
        user_agent: userAgent,
        last_seen_at: new Date().toISOString(),
        consecutive_failures: 0,
      },
      { onConflict: "endpoint" }
    );

  if (subErr) {
    console.error("[subscribe] upsert push_subscriptions failed", subErr);
    return NextResponse.json({ error: subErr.message }, { status: 500 });
  }

  // ─── 2. Miroir users (rétrocompat envoyeurs actuels) ───
  // Tant que les envoyeurs lisent users.push_subscription, on maintient
  // ce champ avec la dernière sub créée. Sera supprimé après refonte
  // des envoyeurs.
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
    console.error("[subscribe] miroir users failed", userErr);
    // Non fatal : la sub est bien dans push_subscriptions
  }

  // ─── 3. Sync tipster_notif_prefs.channel_push (fix bug #1) ───
  try {
    const { data: existing } = await supabaseAdmin
      .from("tipster_notif_prefs")
      .select("user_id, mode")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      await supabaseAdmin
        .from("tipster_notif_prefs")
        .update({
          channel_push: true,
          mode: existing.mode === "none" ? "selected" : existing.mode,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
    } else {
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
    console.error("[subscribe] tipster_notif_prefs sync failed", e);
  }

  // ─── 4. Log ───
  const endpointDomain = extractEndpointHostname(endpoint);
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

// ═══════════════════════════════════════════════════════════════════
// DELETE : désabonner le device courant
// Body optionnel : { endpoint } pour supprimer UNE sub spécifique.
// Sans body → supprime TOUTES les subs du user (équivalent legacy).
// ═══════════════════════════════════════════════════════════════════
export async function DELETE(request: Request) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Tenter de lire l'endpoint depuis le body (optionnel)
  let endpoint: string | null = null;
  try {
    const body = await request.json();
    if (body && typeof body === "object" && typeof body.endpoint === "string") {
      endpoint = body.endpoint;
    }
  } catch {
    // Pas de body : on supprime tout (comportement legacy)
  }

  // ─── 1. DELETE dans push_subscriptions ───
  if (endpoint) {
    // Supprime cette sub précise (sécurité : limitée au user courant)
    const { error: subErr } = await supabaseAdmin
      .from("push_subscriptions")
      .delete()
      .eq("user_id", user.id)
      .eq("endpoint", endpoint);

    if (subErr) {
      console.error("[unsubscribe] delete by endpoint failed", subErr);
    }
  } else {
    // Pas d'endpoint fourni : supprime TOUTES les subs du user
    const { error: subErr } = await supabaseAdmin
      .from("push_subscriptions")
      .delete()
      .eq("user_id", user.id);

    if (subErr) {
      console.error("[unsubscribe] delete all failed", subErr);
    }
  }

  // ─── 2. Vérifier s'il reste des subs pour ce user ───
  const { count } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  const hasRemainingSubs = (count || 0) > 0;

  // ─── 3. Si plus aucune sub : couper le miroir users + flags catégories ───
  if (!hasRemainingSubs) {
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
      console.error("[unsubscribe] miroir users failed", userErr);
    }

    // Miroir tipster_notif_prefs
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
  } else if (endpoint) {
    // Il reste des subs : on met à jour le miroir users.push_subscription
    // avec une autre sub encore active (pour que les envoyeurs continuent
    // de fonctionner pendant la transition multi-device).
    const { data: remaining } = await supabaseAdmin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth, expiration_time")
      .eq("user_id", user.id)
      .order("last_seen_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (remaining) {
      const miroirSubscription = {
        endpoint: remaining.endpoint,
        keys: { p256dh: remaining.p256dh, auth: remaining.auth },
        expirationTime: remaining.expiration_time
          ? new Date(remaining.expiration_time).getTime()
          : null,
      };
      await supabaseAdmin
        .from("users")
        .update({ push_subscription: miroirSubscription })
        .eq("id", user.id);
    }
  }

  // ─── 4. Log ───
  await supabaseAdmin.from("notification_logs").insert({
    pick_id: null,
    user_id: user.id,
    channel: "unsubscribe",
    status: "sent",
    sent_at: new Date().toISOString(),
    error: null,
    platform: null,
    endpoint_domain: endpoint ? extractEndpointHostname(endpoint) : null,
    status_code: 200,
  });

  return NextResponse.json({
    ok: true,
    deletedEndpoint: endpoint || "all",
    remainingSubs: count || 0,
  });
}