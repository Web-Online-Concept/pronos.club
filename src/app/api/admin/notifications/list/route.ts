// src/app/api/admin/notifications/list/route.ts
import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

function detectPlatform(endpoint: string): "ios" | "android" | "firefox" | "windows" | "other" {
  if (endpoint.includes("push.apple.com")) return "ios";
  if (endpoint.includes("fcm.googleapis.com")) return "android";
  if (endpoint.includes("mozilla.com")) return "firefox";
  if (endpoint.includes("windows.com")) return "windows";
  return "other";
}

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Users avec push actif
  const { data: usersRaw } = await supabaseAdmin
    .from("users")
    .select("id, email, pseudo, push_subscription, notify_push, subscription_status")
    .eq("notify_push", true)
    .not("push_subscription", "is", null);

  const users = (usersRaw ?? []).map((u: { id: string; email: string; pseudo: string | null; push_subscription: { endpoint: string }; notify_push: boolean; subscription_status: string }) => {
    const endpoint = u.push_subscription?.endpoint ?? "";
    return {
      id: u.id,
      email: u.email,
      pseudo: u.pseudo,
      platform: detectPlatform(endpoint),
      notify_push: u.notify_push,
      subscription_status: u.subscription_status,
    };
  });

  // 50 derniers logs avec email
  const { data: logsRaw } = await supabaseAdmin
    .from("notification_logs")
    .select("id, sent_at, user_id, channel, status, platform, status_code, error")
    .order("sent_at", { ascending: false })
    .limit(50);

  // Get emails for logs user_ids
  const userIds = Array.from(new Set((logsRaw ?? []).map((l) => l.user_id).filter(Boolean)));
  let emailMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: usersForLogs } = await supabaseAdmin
      .from("users")
      .select("id, email")
      .in("id", userIds);
    emailMap = (usersForLogs ?? []).reduce<Record<string, string>>((acc, u) => {
      acc[u.id] = u.email;
      return acc;
    }, {});
  }

  const logs = (logsRaw ?? []).map((l) => ({
    id: l.id,
    sent_at: l.sent_at,
    user_email: l.user_id ? emailMap[l.user_id] ?? null : null,
    channel: l.channel,
    status: l.status,
    platform: l.platform,
    status_code: l.status_code,
    error: l.error,
  }));

  return NextResponse.json({ users, logs });
}