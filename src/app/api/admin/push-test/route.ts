// src/app/api/admin/push-test/route.ts
// Route admin pour envoyer une notification push test à un user spécifique
// Usage: POST /api/admin/push-test avec body { userId: "xxx" } ou { email: "xxx" }

import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import webpush from "web-push";

webpush.setVapidDetails(
  "mailto:contact@pronos.club",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

function detectPlatform(endpoint: string): string {
  if (endpoint.includes("push.apple.com")) return "ios";
  if (endpoint.includes("fcm.googleapis.com")) return "android";
  if (endpoint.includes("mozilla.com")) return "firefox";
  if (endpoint.includes("windows.com")) return "windows";
  return "other";
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
    .select("id, email, push_subscription, notify_push, subscription_status");

  const { data: user } = userId
    ? await query.eq("id", userId).single()
    : await query.eq("email", email).single();

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (!user.push_subscription) {
    return NextResponse.json({
      error: "User has no push subscription",
      user: { id: user.id, email: user.email, notify_push: user.notify_push },
    }, { status: 400 });
  }

  const endpoint = (user.push_subscription as { endpoint: string }).endpoint;
  const platform = detectPlatform(endpoint);

  const payload = JSON.stringify({
    title: "🧪 Test notification PRONOS.CLUB",
    body: `Si vous voyez ceci, vos notifications fonctionnent ! (${new Date().toLocaleTimeString("fr-FR")})`,
    url: "/fr/espace",
  });

  try {
    await webpush.sendNotification(user.push_subscription as webpush.PushSubscription, payload);

    // Log
    await supabaseAdmin.from("notification_logs").insert({
      pick_id: null,
      user_id: user.id,
      channel: "test",
      status: "sent",
      sent_at: new Date().toISOString(),
      error: null,
      platform,
      endpoint_domain: platform,
      status_code: 201,
    });

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, platform },
    });
  } catch (err: unknown) {
    let statusCode = 0;
    let errorMsg = "unknown";

    if (err && typeof err === "object") {
      if ("statusCode" in err) statusCode = (err as { statusCode: number }).statusCode;
      if ("message" in err) errorMsg = String((err as { message: string }).message);
      if ("body" in err) errorMsg = String((err as { body: string }).body);
    }

    // Log
    await supabaseAdmin.from("notification_logs").insert({
      pick_id: null,
      user_id: user.id,
      channel: "test",
      status: "failed",
      sent_at: new Date().toISOString(),
      error: errorMsg.slice(0, 500),
      platform,
      endpoint_domain: platform,
      status_code: statusCode,
    });

    return NextResponse.json({
      success: false,
      error: errorMsg,
      statusCode,
      platform,
      user: { id: user.id, email: user.email },
      shouldCleanup: statusCode === 404 || statusCode === 410 || statusCode === 403,
    }, { status: 200 }); // 200 car on a bien traité la requête, c'est le push qui a foiré
  }
}