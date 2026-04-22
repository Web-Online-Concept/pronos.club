import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendNewPickEmail } from "@/lib/emails";
import { NextResponse } from "next/server";
import webpush from "web-push";

webpush.setVapidDetails(
  "mailto:contact@pronos.club",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

type PushUser = {
  id: string;
  push_subscription: webpush.PushSubscription;
};

function detectPlatform(endpoint: string): { platform: string; domain: string } {
  if (endpoint.includes("push.apple.com")) return { platform: "ios", domain: "apple" };
  if (endpoint.includes("fcm.googleapis.com")) return { platform: "android", domain: "fcm" };
  if (endpoint.includes("mozilla.com")) return { platform: "firefox", domain: "mozilla" };
  if (endpoint.includes("windows.com")) return { platform: "windows", domain: "wns" };
  return { platform: "other", domain: "unknown" };
}

async function sendSinglePush(
  user: PushUser,
  payload: string,
  pickId: string | null
): Promise<{ status: "sent" | "failed"; statusCode: number; error: string | null; platform: string; domain: string; shouldCleanup: boolean }> {
  const endpoint = user.push_subscription.endpoint;
  const { platform, domain } = detectPlatform(endpoint);

  try {
    await webpush.sendNotification(user.push_subscription, payload);
    return { status: "sent", statusCode: 201, error: null, platform, domain, shouldCleanup: false };
  } catch (err: unknown) {
    let statusCode = 0;
    let errorMsg = "unknown";
    let shouldCleanup = false;

    if (err && typeof err === "object") {
      if ("statusCode" in err) statusCode = (err as { statusCode: number }).statusCode;
      if ("message" in err) errorMsg = String((err as { message: string }).message).slice(0, 500);
      if ("body" in err) errorMsg = String((err as { body: string }).body).slice(0, 500);
    }

    // Subscription invalide definitivement : on nettoie
    if (statusCode === 404 || statusCode === 410) {
      shouldCleanup = true;
    }
    // 403 = VAPID mismatch OU subscription expirée côté Apple : on nettoie aussi
    if (statusCode === 403) {
      shouldCleanup = true;
    }

    return { status: "failed", statusCode, error: errorMsg, platform, domain, shouldCleanup };
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { pickId, pickNumber, sport, isPremium } = await request.json();

  // Get all users with push enabled
  let pushQuery = supabaseAdmin
    .from("users")
    .select("id, push_subscription")
    .eq("notify_push", true)
    .not("push_subscription", "is", null);

  if (isPremium) {
    pushQuery = pushQuery.in("subscription_status", ["active", "trialing"]);
  }

  const { data: pushUsersRaw } = await pushQuery;
  const pushUsers = (pushUsersRaw || []) as PushUser[];

  // Get all users with email enabled
  let emailQuery = supabaseAdmin
    .from("users")
    .select("id, email, locale")
    .eq("notify_email", true);

  if (isPremium) {
    emailQuery = emailQuery.in("subscription_status", ["active", "trialing"]);
  }

  const { data: emailUsers } = await emailQuery;

  let pushSent = 0;
  let pushFailed = 0;
  let pushCleaned = 0;
  let emailSent = 0;

  const payload = JSON.stringify({
    title: pickNumber ? `🔔 #${pickNumber} Nouveau pronostic` : "🔔 Nouveau pronostic disponible",
    body: sport ? `${sport} — Consultez-le sur PRONOS.CLUB` : "Un nouveau pick vient d'être publié",
    url: "/fr/pronostics",
  });

  // Send push notifications with per-user logging
  const logRows: Record<string, unknown>[] = [];
  const cleanupIds: string[] = [];

  await Promise.allSettled(
    pushUsers.map(async (user) => {
      const result = await sendSinglePush(user, payload, pickId || null);

      if (result.status === "sent") {
        pushSent++;
      } else {
        pushFailed++;
        if (result.shouldCleanup) {
          cleanupIds.push(user.id);
          pushCleaned++;
        }
      }

      logRows.push({
        pick_id: pickId || null,
        user_id: user.id,
        channel: "push",
        status: result.status,
        sent_at: new Date().toISOString(),
        error: result.error,
        platform: result.platform,
        endpoint_domain: result.domain,
        status_code: result.statusCode,
      });
    })
  );

  // Cleanup invalid subscriptions (in batch)
  if (cleanupIds.length > 0) {
    await supabaseAdmin
      .from("users")
      .update({ push_subscription: null, notify_push: false })
      .in("id", cleanupIds);
  }

  // Insert all log rows in one batch
  if (logRows.length > 0) {
    await supabaseAdmin.from("notification_logs").insert(logRows);
  }

  // Send emails
  if (emailUsers) {
    await Promise.allSettled(
      emailUsers.map(async (user) => {
        try {
          const locale = (user.locale as "fr" | "en" | "es") || "fr";
          const sent = await sendNewPickEmail(user.email, locale, sport, isPremium, pickNumber);
          if (sent) emailSent++;
        } catch {
          // Silent fail for individual emails
        }
      })
    );
  }

  // Telegram
  let telegramSent = false;
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHANNEL_ID) {
    try {
      const sportLabel = sport ? ` — ${sport}` : "";
      const accessLabel = isPremium ? "🔒 Premium" : "🆓 Gratuit";
      const pickLabel = pickNumber ? `#${pickNumber} ` : "";
      const telegramMessage = `🔔 ${pickLabel}Nouveau pronostic publié sur PRONOS.CLUB${sportLabel}\n${accessLabel}\n\n👉 ${process.env.NEXT_PUBLIC_SITE_URL}/fr/pronostics`;

      const tgRes = await fetch(
        `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: process.env.TELEGRAM_CHANNEL_ID,
            text: telegramMessage,
            parse_mode: "HTML",
            disable_web_page_preview: false,
          }),
        }
      );
      telegramSent = tgRes.ok;
    } catch {
      // Silent fail
    }
  }

  // Mark pick as notified
  if (pickId) {
    await supabaseAdmin
      .from("picks")
      .update({ notify_sent: true })
      .eq("id", pickId);
  }

  return NextResponse.json({
    pushSent,
    pushFailed,
    pushCleaned,
    emailSent,
    telegramSent,
    totalPushTargets: pushUsers.length,
  });
}