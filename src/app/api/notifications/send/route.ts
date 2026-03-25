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

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { title, body, url, pickId, sport, isPremium } = await request.json();

  // Get all users with push enabled
  let pushQuery = supabaseAdmin
    .from("users")
    .select("id, push_subscription")
    .eq("notify_push", true)
    .not("push_subscription", "is", null);

  if (isPremium) {
    pushQuery = pushQuery.eq("subscription_status", "active");
  }

  const { data: pushUsers } = await pushQuery;

  // Get all users with email enabled
  let emailQuery = supabaseAdmin
    .from("users")
    .select("id, email")
    .eq("notify_email", true);

  if (isPremium) {
    emailQuery = emailQuery.eq("subscription_status", "active");
  }

  const { data: emailUsers } = await emailQuery;

  let pushSent = 0;
  let pushFailed = 0;
  let emailSent = 0;

  // Send push notifications
  if (pushUsers) {
    const payload = JSON.stringify({
      title: "🔔 Nouveau pronostic disponible",
      body: "Un nouveau pick vient d'être publié. Consultez-le sur PRONOS.CLUB",
      url: "/fr/pronostics",
    });

    await Promise.allSettled(
      pushUsers.map(async (user) => {
        try {
          await webpush.sendNotification(
            user.push_subscription as webpush.PushSubscription,
            payload
          );
          pushSent++;
        } catch (err: unknown) {
          pushFailed++;
          if (err && typeof err === "object" && "statusCode" in err && (err as { statusCode: number }).statusCode === 410) {
            await supabaseAdmin
              .from("users")
              .update({ push_subscription: null, notify_push: false })
              .eq("id", user.id);
          }
        }
      })
    );
  }

  // Send emails via centralized template
  if (emailUsers) {
    await Promise.allSettled(
      emailUsers.map(async (user) => {
        try {
          const sent = await sendNewPickEmail(user.email, sport, isPremium);
          if (sent) emailSent++;
        } catch {
          // Silent fail for individual emails
        }
      })
    );
  }

  // Send Telegram notification
  let telegramSent = false;
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHANNEL_ID) {
    try {
      const sportLabel = sport ? ` — ${sport}` : "";
      const accessLabel = isPremium ? "🔒 Premium" : "🆓 Gratuit";
      const telegramMessage = `🔔 Nouveau pronostic publié sur PRONOS.CLUB${sportLabel}\n${accessLabel}\n\n👉 ${process.env.NEXT_PUBLIC_SITE_URL}/fr/pronostics`;

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
      // Silent fail for Telegram
    }
  }

  // Mark pick as notified
  if (pickId) {
    await supabaseAdmin
      .from("picks")
      .update({ notify_sent: true })
      .eq("id", pickId);
  }

  // Log
  await supabaseAdmin.from("notification_logs").insert({
    channel: "push",
    title,
    body,
    recipients_count: pushSent + emailSent,
    metadata: { pushSent, pushFailed, emailSent, telegramSent },
  });

  return NextResponse.json({ pushSent, pushFailed, emailSent, telegramSent });
}