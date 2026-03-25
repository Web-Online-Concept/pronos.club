import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendWinbackDay7Email, sendWinbackDay30Email, sendPremiumExpiringEmail, sendInactivityEmail } from "@/lib/emails";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  // Verify cron secret
  const cronSecret = request.headers.get("x-vercel-cron") || request.headers.get("authorization");
  if (cronSecret !== "1" && cronSecret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  let winback7Sent = 0;
  let winback30Sent = 0;
  let expiringSent = 0;
  let inactivitySent = 0;

  // ═══════════ WINBACK J+7 — résiliés il y a 7 jours ═══════════
  const day7Ago = new Date(now.getTime() - 7 * 86400000).toISOString().split("T")[0];
  const day8Ago = new Date(now.getTime() - 8 * 86400000).toISOString().split("T")[0];

  const { data: winback7Users } = await supabaseAdmin
    .from("users")
    .select("id, email, pseudo, display_name, subscription_status, subscription_end")
    .eq("subscription_status", "canceled")
    .eq("notify_email", true)
    .gte("subscription_end", day8Ago)
    .lt("subscription_end", day7Ago);

  if (winback7Users) {
    for (const user of winback7Users) {
      if (!user.email) continue;
      const name = user.pseudo || user.display_name || user.email.split("@")[0];
      const sent = await sendWinbackDay7Email(user.email, name);
      if (sent) winback7Sent++;
    }
  }

  // ═══════════ WINBACK J+30 — résiliés il y a 30 jours ═══════════
  const day30Ago = new Date(now.getTime() - 30 * 86400000).toISOString().split("T")[0];
  const day31Ago = new Date(now.getTime() - 31 * 86400000).toISOString().split("T")[0];

  const { data: winback30Users } = await supabaseAdmin
    .from("users")
    .select("id, email, pseudo, display_name, subscription_status, subscription_end")
    .eq("subscription_status", "canceled")
    .eq("notify_email", true)
    .gte("subscription_end", day31Ago)
    .lt("subscription_end", day30Ago);

  if (winback30Users) {
    // Get last month stats
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const from = lastMonth.toISOString().split("T")[0];
    const to = lastMonthEnd.toISOString().split("T")[0];

    const { data: monthPicks } = await supabaseAdmin
      .from("picks")
      .select("status, profit, stake")
      .neq("status", "pending")
      .gte("event_date", from)
      .lte("event_date", to);

    const picks = monthPicks ?? [];
    const totalPicks = picks.length;
    const won = picks.filter((p) => p.status === "won" || p.status === "half_won").length;
    const resolved = picks.filter((p) => p.status !== "void").length;
    const winRate = resolved > 0 ? Math.round((won / resolved) * 100) : 0;
    const profit = Math.round(picks.reduce((s, p) => s + (p.profit ?? 0), 0) * 10) / 10;

    for (const user of winback30Users) {
      if (!user.email) continue;
      const name = user.pseudo || user.display_name || user.email.split("@")[0];
      const sent = await sendWinbackDay30Email(user.email, name, profit, winRate, totalPicks);
      if (sent) winback30Sent++;
    }
  }

  // ═══════════ PREMIUM EXPIRING — expire demain (premiums offerts) ═══════════
  const tomorrow = new Date(now.getTime() + 86400000).toISOString().split("T")[0];
  const dayAfter = new Date(now.getTime() + 2 * 86400000).toISOString().split("T")[0];

  const { data: expiringUsers } = await supabaseAdmin
    .from("users")
    .select("id, email, pseudo, display_name, subscription_status, subscription_end, stripe_customer_id")
    .eq("subscription_status", "active")
    .is("stripe_customer_id", null)  // Only gifted premiums (no Stripe = gifted by admin)
    .eq("notify_email", true)
    .gte("subscription_end", tomorrow)
    .lt("subscription_end", dayAfter);

  if (expiringUsers) {
    for (const user of expiringUsers) {
      if (!user.email) continue;
      const name = user.pseudo || user.display_name || user.email.split("@")[0];
      const endDate = new Date(user.subscription_end!).toLocaleDateString("fr-FR", {
        day: "numeric", month: "long", year: "numeric",
      });
      const sent = await sendPremiumExpiringEmail(user.email, name, endDate);
      if (sent) expiringSent++;
    }
  }

  // ═══════════ INACTIVITÉ — premium pas connecté depuis 15 jours ═══════════
  // Note: requires a last_seen_at column on users. Skip if not available.
  // TODO: add last_seen_at tracking in middleware

  return NextResponse.json({
    winback7Sent,
    winback30Sent,
    expiringSent,
    inactivitySent,
    timestamp: now.toISOString(),
  });
}