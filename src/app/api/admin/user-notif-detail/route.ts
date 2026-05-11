/**
 * ═══════════════════════════════════════════════════════════════════
 * /api/admin/user-notif-detail (Dashboard observability — 11/05/2026)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Retourne tout ce qu'il faut savoir sur les notifs d'un user spécifique :
 *   - User info + flags notify_*
 *   - Tipster_notif_prefs (Section 5)
 *   - push_subscriptions actives
 *   - 30 derniers emails reçus
 *   - 30 dernières notifs push
 *
 * Usage : GET ?email=user@example.com (ou ?userId=uuid)
 *
 * Path : src/app/api/admin/user-notif-detail/route.ts
 * ═══════════════════════════════════════════════════════════════════
 */

import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email")?.toLowerCase().trim();
  const userId = searchParams.get("userId");

  if (!email && !userId) {
    return NextResponse.json({ error: "email or userId required" }, { status: 400 });
  }

  // ─── 1. Trouver le user ───
  const userQuery = supabaseAdmin
    .from("users")
    .select(
      "id, email, pseudo, display_name, locale, subscription_status, telegram_user_id, notify_email, notify_push, notify_bilan, notify_tipster_push, notify_tipster_email, notify_abonnes_push, notify_abonnes_email, created_at"
    );

  const { data: user } = userId
    ? await userQuery.eq("id", userId).maybeSingle()
    : await userQuery.eq("email", email!).maybeSingle();

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // ─── 2. tipster_notif_prefs ───
  const { data: prefs } = await supabaseAdmin
    .from("tipster_notif_prefs")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  // ─── 3. push_subscriptions ───
  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select(
      "id, endpoint, platform, user_agent, created_at, last_seen_at, last_success_at, last_failure_at, consecutive_failures"
    )
    .eq("user_id", user.id)
    .order("last_seen_at", { ascending: false });

  // ─── 4. 30 derniers email_logs ───
  const { data: emailLogs } = await supabaseAdmin
    .from("email_logs")
    .select("id, category, status, subject, locale, error, sent_at, updated_at, brevo_message_id")
    .eq("user_id", user.id)
    .order("sent_at", { ascending: false })
    .limit(30);

  // ─── 5. 30 derniers notification_logs ───
  const { data: pushLogs } = await supabaseAdmin
    .from("notification_logs")
    .select("id, channel, status, platform, endpoint_domain, status_code, error, sent_at, pick_id")
    .eq("user_id", user.id)
    .order("sent_at", { ascending: false })
    .limit(30);

  // ─── 6. Stats rapides ───
  const emailStats = {
    total: (emailLogs || []).length,
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    failed: 0,
  };
  for (const log of emailLogs || []) {
    if (log.status === "sent") emailStats.sent++;
    else if (log.status === "delivered") emailStats.delivered++;
    else if (log.status === "opened") emailStats.opened++;
    else if (log.status === "clicked") emailStats.clicked++;
    else emailStats.failed++;
  }

  const pushStats = {
    total: (pushLogs || []).length,
    sent: 0,
    failed: 0,
  };
  for (const log of pushLogs || []) {
    if (log.status === "sent") pushStats.sent++;
    else pushStats.failed++;
  }

  // Endpoint courts pour affichage
  const subsEnriched = (subs || []).map((s) => ({
    ...s,
    endpoint_short: s.endpoint ? s.endpoint.slice(0, 80) + "..." : null,
  }));

  return NextResponse.json({
    user,
    prefs: prefs || null,
    subs: subsEnriched,
    emailLogs: emailLogs || [],
    pushLogs: pushLogs || [],
    emailStats,
    pushStats,
  });
}