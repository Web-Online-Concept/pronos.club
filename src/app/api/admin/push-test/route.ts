// src/app/api/admin/push-test/route.ts
// Route admin pour envoyer une notification push test à un user spécifique
// Usage: POST /api/admin/push-test avec body { userId: "xxx" } ou { email: "xxx" }
//
// V3.6 (11/05/2026) — Multi-device :
//   - Envoie la notif test sur TOUS les devices du user (PC + mobile PWA).
//   - Retourne le détail par device (sent/failed + cleanup auto sur 410).
//   - Si aucune sub trouvée, on retourne une erreur explicite.

import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { cleanupDeadSubscription } from "@/lib/tipster-notifications";
import { NextResponse } from "next/server";
import webpush from "web-push";

webpush.setVapidDetails(
  "mailto:contact@pronos.club",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

type SubRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  platform: string | null;
};

function detectPlatformFromEndpoint(endpoint: string): { platform: string; domain: string } {
  try {
    const hostname = new URL(endpoint).hostname;
    if (endpoint.includes("push.apple.com"))     return { platform: "ios",     domain: hostname };
    if (endpoint.includes("fcm.googleapis.com")) return { platform: "android", domain: hostname };
    if (endpoint.includes("mozilla.com"))        return { platform: "firefox", domain: hostname };
    if (endpoint.includes("windows.com"))        return { platform: "windows", domain: hostname };
    return { platform: "other", domain: hostname };
  } catch {
    return { platform: "other", domain: "unknown" };
  }
}

// ─── Cleanup d'UNE sub par endpoint (sans toucher aux autres devices) ───
async function deleteOneDeadSub(userId: string, endpoint: string) {
  await supabaseAdmin
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint);

  // Si plus aucune sub : cleanup complet via le helper partagé
  const { count } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if ((count || 0) === 0) {
    await cleanupDeadSubscription(userId);
  } else {
    // Il reste des subs : rafraîchir le miroir users.push_subscription
    const { data: remaining } = await supabaseAdmin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth, expiration_time")
      .eq("user_id", userId)
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
        .eq("id", userId);
    }
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { userId, email } = body;

  if (!userId && !email) {
    return NextResponse.json({ error: "userId or email required" }, { status: 400 });
  }

  // Find user
  const query = supabaseAdmin
    .from("users")
    .select("id, email, notify_push, subscription_status");

  const { data: user } = userId
    ? await query.eq("id", userId).single()
    : await query.eq("email", email).single();

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // V3.6 — récupérer TOUTES les subs du user
  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, platform")
    .eq("user_id", user.id);

  const subList = (subs || []) as SubRow[];

  if (subList.length === 0) {
    return NextResponse.json({
      error: "User has no push subscription",
      user: { id: user.id, email: user.email, notify_push: user.notify_push },
    }, { status: 400 });
  }

  const payload = JSON.stringify({
    title: "🧪 Test notification PRONOS.CLUB",
    body: `Si vous voyez ceci, vos notifications fonctionnent ! (${new Date().toLocaleTimeString("fr-FR")})`,
    url: "/fr/espace",
  });

  // ─── Envoi en parallèle sur toutes les subs du user ───
  const deviceResults: Array<{
    platform: string;
    success: boolean;
    statusCode: number;
    error: string | null;
    cleaned: boolean;
  }> = [];

  await Promise.allSettled(
    subList.map(async (sub) => {
      const { platform, domain } = detectPlatformFromEndpoint(sub.endpoint);

      const webpushSub: webpush.PushSubscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      };

      try {
        await webpush.sendNotification(webpushSub, payload);

        await supabaseAdmin
          .from("push_subscriptions")
          .update({
            last_success_at: new Date().toISOString(),
            last_seen_at: new Date().toISOString(),
            consecutive_failures: 0,
          })
          .eq("id", sub.id);

        await supabaseAdmin.from("notification_logs").insert({
          pick_id: null,
          user_id: user.id,
          channel: "test",
          status: "sent",
          sent_at: new Date().toISOString(),
          error: null,
          platform,
          endpoint_domain: domain,
          status_code: 201,
        });

        deviceResults.push({
          platform,
          success: true,
          statusCode: 201,
          error: null,
          cleaned: false,
        });
      } catch (err: unknown) {
        let statusCode = 0;
        let errorMsg = "unknown";

        if (err && typeof err === "object") {
          if ("statusCode" in err) statusCode = (err as { statusCode: number }).statusCode;
          if ("message" in err) errorMsg = String((err as { message: string }).message);
          if ("body" in err) errorMsg = String((err as { body: string }).body);
        }

        const isDead = statusCode === 404 || statusCode === 410 || statusCode === 403;
        let cleaned = false;

        await supabaseAdmin.from("notification_logs").insert({
          pick_id: null,
          user_id: user.id,
          channel: "test",
          status: "failed",
          sent_at: new Date().toISOString(),
          error: errorMsg.slice(0, 500),
          platform,
          endpoint_domain: domain,
          status_code: statusCode,
        });

        if (isDead) {
          try {
            await deleteOneDeadSub(user.id, sub.endpoint);
            cleaned = true;
          } catch (cleanupErr) {
            console.error("[push-test] cleanup failed", cleanupErr);
          }
        }

        deviceResults.push({
          platform,
          success: false,
          statusCode,
          error: errorMsg,
          cleaned,
        });
      }
    })
  );

  const successCount = deviceResults.filter((r) => r.success).length;
  const failedCount = deviceResults.length - successCount;

  return NextResponse.json({
    success: successCount > 0,
    user: { id: user.id, email: user.email },
    totalDevices: deviceResults.length,
    successCount,
    failedCount,
    devices: deviceResults,
  });
}