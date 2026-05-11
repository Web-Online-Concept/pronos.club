// src/app/api/admin/push-test/route.ts
//
// V2 (11/05/2026) — Nettoyage legacy :
//   - deleteOneDeadSub ne touche plus à users.push_subscription
//     (colonne orpheline, DROP COLUMN prévu 25/05/2026).
//   - Utilise sub.platform stocké au subscribe (cohérent V4 send/route).
//
// V3.6 (11/05/2026) — Multi-device : envoie sur TOUS les devices du user.

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

function extractEndpointHostname(endpoint: string): string {
  try {
    return new URL(endpoint).hostname;
  } catch {
    return "unknown";
  }
}

// ─── V2 — Cleanup d'UNE sub par endpoint, sans toucher users.push_subscription ───
async function deleteOneDeadSub(userId: string, endpoint: string) {
  await supabaseAdmin
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint);

  const { count } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if ((count || 0) === 0) {
    // Plus aucune sub : cleanup complet via le helper partagé
    await cleanupDeadSubscription(userId);
  }
  // V2 — Sinon, plus rien à faire (avant on rafraîchissait users.push_subscription)
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

  const query = supabaseAdmin
    .from("users")
    .select("id, email, notify_push, subscription_status");

  const { data: user } = userId
    ? await query.eq("id", userId).single()
    : await query.eq("email", email).single();

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

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

  const deviceResults: Array<{
    platform: string;
    success: boolean;
    statusCode: number;
    error: string | null;
    cleaned: boolean;
  }> = [];

  await Promise.allSettled(
    subList.map(async (sub) => {
      // V2 — on lit sub.platform (déjà détecté au subscribe avec endpoint + UA)
      const platform = sub.platform || "other";
      const domain = extractEndpointHostname(sub.endpoint);

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