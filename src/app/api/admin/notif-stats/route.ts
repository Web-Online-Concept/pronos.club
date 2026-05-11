/**
 * ═══════════════════════════════════════════════════════════════════
 * /api/admin/notif-stats (Dashboard observability — 11/05/2026)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Retourne les stats agrégées emails + push pour les 30 derniers jours :
 *   - Compteurs par catégorie et status (emails)
 *   - Compteurs par platform et status_code (push)
 *   - 50 derniers échecs de chaque côté
 *   - Subscriptions push avec consecutive_failures > 0
 *
 * Consommé par /fr/admin/emails (page dashboard refondue).
 *
 * Path : src/app/api/admin/notif-stats/route.ts
 * ═══════════════════════════════════════════════════════════════════
 */

import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // ═════════════════════════════════════════════════════════════
  // EMAILS — 30 derniers jours
  // ═════════════════════════════════════════════════════════════
  const { data: emailLogs } = await supabaseAdmin
    .from("email_logs")
    .select("category, status")
    .gte("sent_at", thirtyDaysAgo);

  const emailByCategoryStatus: Record<string, Record<string, number>> = {};
  const emailByStatus: Record<string, number> = {};
  let emailTotal = 0;

  for (const log of emailLogs || []) {
    const cat = log.category || "unknown";
    const stat = log.status || "unknown";
    emailTotal++;
    emailByStatus[stat] = (emailByStatus[stat] || 0) + 1;
    if (!emailByCategoryStatus[cat]) emailByCategoryStatus[cat] = {};
    emailByCategoryStatus[cat][stat] = (emailByCategoryStatus[cat][stat] || 0) + 1;
  }

  // Derniers échecs emails (50)
  const FAIL_STATUSES = ["failed", "hard_bounce", "soft_bounce", "invalid_email", "blocked", "spam"];
  const { data: emailFailures } = await supabaseAdmin
    .from("email_logs")
    .select("id, email, category, status, error, sent_at, updated_at")
    .in("status", FAIL_STATUSES)
    .gte("sent_at", thirtyDaysAgo)
    .order("sent_at", { ascending: false })
    .limit(50);

  // ═════════════════════════════════════════════════════════════
  // PUSH — 30 derniers jours (notification_logs channel='push')
  // ═════════════════════════════════════════════════════════════
  const { data: pushLogs } = await supabaseAdmin
    .from("notification_logs")
    .select("platform, status, status_code")
    .eq("channel", "push")
    .gte("sent_at", thirtyDaysAgo);

  const pushByPlatform: Record<string, Record<string, number>> = {};
  const pushByStatusCode: Record<string, number> = {};
  let pushTotal = 0;
  let pushSent = 0;
  let pushFailed = 0;

  for (const log of pushLogs || []) {
    const plat = log.platform || "unknown";
    const stat = log.status || "unknown";
    const code = log.status_code != null ? String(log.status_code) : "0";

    pushTotal++;
    if (stat === "sent") pushSent++;
    else pushFailed++;

    if (!pushByPlatform[plat]) pushByPlatform[plat] = { sent: 0, failed: 0 };
    if (stat === "sent") pushByPlatform[plat].sent++;
    else pushByPlatform[plat].failed++;

    pushByStatusCode[code] = (pushByStatusCode[code] || 0) + 1;
  }

  // Derniers échecs push (50)
  const { data: pushFailures } = await supabaseAdmin
    .from("notification_logs")
    .select("id, user_id, platform, endpoint_domain, status, status_code, error, sent_at")
    .eq("channel", "push")
    .eq("status", "failed")
    .gte("sent_at", thirtyDaysAgo)
    .order("sent_at", { ascending: false })
    .limit(50);

  // Subs push en cours d'échec (consecutive_failures > 0)
  const { data: subsAtRisk } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, user_id, platform, endpoint, consecutive_failures, last_failure_at, last_success_at, created_at")
    .gt("consecutive_failures", 0)
    .order("consecutive_failures", { ascending: false })
    .limit(50);

  // Pour les subs à risque, on enrichit avec l'email du user
  const userIds = Array.from(new Set((subsAtRisk || []).map((s) => s.user_id).filter(Boolean)));
  let userMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: users } = await supabaseAdmin
      .from("users")
      .select("id, email")
      .in("id", userIds);
    for (const u of users || []) {
      userMap[u.id] = u.email || "";
    }
  }

  const subsAtRiskEnriched = (subsAtRisk || []).map((s) => ({
    ...s,
    user_email: userMap[s.user_id] || null,
    // Tronque l'endpoint pour l'affichage
    endpoint_short: s.endpoint ? s.endpoint.slice(0, 60) + "..." : null,
  }));

  // Idem pour les pushFailures : enrichissement email
  const failUserIds = Array.from(new Set((pushFailures || []).map((f) => f.user_id).filter(Boolean)));
  if (failUserIds.length > 0) {
    const { data: users } = await supabaseAdmin
      .from("users")
      .select("id, email")
      .in("id", failUserIds);
    for (const u of users || []) {
      userMap[u.id] = u.email || "";
    }
  }
  const pushFailuresEnriched = (pushFailures || []).map((f) => ({
    ...f,
    user_email: f.user_id ? userMap[f.user_id] || null : null,
  }));

  // ═════════════════════════════════════════════════════════════
  // TOTAUX globaux push_subscriptions (snapshot actuel, pas 30j)
  // ═════════════════════════════════════════════════════════════
  const { count: totalSubs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true });

  const { data: subsByPlatformRaw } = await supabaseAdmin
    .from("push_subscriptions")
    .select("platform");

  const subsByPlatform: Record<string, number> = {};
  for (const s of subsByPlatformRaw || []) {
    const p = s.platform || "unknown";
    subsByPlatform[p] = (subsByPlatform[p] || 0) + 1;
  }

  return NextResponse.json({
    period: {
      from: thirtyDaysAgo,
      to: new Date().toISOString(),
    },
    emails: {
      total: emailTotal,
      byStatus: emailByStatus,
      byCategory: emailByCategoryStatus,
      recentFailures: emailFailures || [],
    },
    push: {
      total: pushTotal,
      sent: pushSent,
      failed: pushFailed,
      byPlatform: pushByPlatform,
      byStatusCode: pushByStatusCode,
      recentFailures: pushFailuresEnriched,
      subsAtRisk: subsAtRiskEnriched,
    },
    subs: {
      total: totalSubs || 0,
      byPlatform: subsByPlatform,
    },
  });
}