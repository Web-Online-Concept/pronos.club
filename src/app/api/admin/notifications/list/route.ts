// src/app/api/admin/notifications/list/route.ts
//
// V2 (11/05/2026) — Migration vers la table push_subscriptions :
//   - Avant on listait `users.push_subscription IS NOT NULL`. Cette
//     colonne legacy va être DROP le 25/05/2026.
//   - Maintenant on liste les users distincts présents dans la table
//     push_subscriptions (multi-device : un user peut avoir N entrées,
//     on dédupe en gardant le device le plus récent pour la plateforme
//     affichée).
//   - Compteur "Nombre d'appareils" ajouté en bonus.

import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ─── 1. Récupérer toutes les subs (avec user_id pour join + last_seen pour tri) ───
  const { data: allSubs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("user_id, platform, last_seen_at")
    .order("last_seen_at", { ascending: false });

  // ─── 2. Agréger par user : platform du device le plus récent + total devices ───
  type UserSubAggregate = { platform: string; deviceCount: number };
  const userMap = new Map<string, UserSubAggregate>();

  for (const sub of allSubs || []) {
    if (!sub.user_id) continue;
    const existing = userMap.get(sub.user_id);
    if (existing) {
      existing.deviceCount++;
    } else {
      // 1er rencontré = le plus récent (tri DESC sur last_seen_at)
      userMap.set(sub.user_id, {
        platform: sub.platform || "other",
        deviceCount: 1,
      });
    }
  }

  const userIds = Array.from(userMap.keys());

  // ─── 3. Joindre les infos users ───
  let users: Array<{
    id: string;
    email: string;
    pseudo: string | null;
    platform: string;
    deviceCount: number;
    notify_push: boolean;
    subscription_status: string;
  }> = [];

  if (userIds.length > 0) {
    const { data: usersData } = await supabaseAdmin
      .from("users")
      .select("id, email, pseudo, notify_push, subscription_status")
      .in("id", userIds)
      .eq("notify_push", true);

    users = (usersData || []).map((u) => {
      const agg = userMap.get(u.id)!;
      return {
        id: u.id,
        email: u.email,
        pseudo: u.pseudo,
        platform: agg.platform,
        deviceCount: agg.deviceCount,
        notify_push: u.notify_push,
        subscription_status: u.subscription_status,
      };
    });
  }

  // ─── 4. 50 derniers notification_logs avec emails ───
  const { data: logsRaw } = await supabaseAdmin
    .from("notification_logs")
    .select("id, sent_at, user_id, channel, status, platform, status_code, error")
    .order("sent_at", { ascending: false })
    .limit(50);

  const logUserIds = Array.from(new Set((logsRaw ?? []).map((l) => l.user_id).filter(Boolean)));
  let emailMap: Record<string, string> = {};
  if (logUserIds.length > 0) {
    const { data: usersForLogs } = await supabaseAdmin
      .from("users")
      .select("id, email")
      .in("id", logUserIds);
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