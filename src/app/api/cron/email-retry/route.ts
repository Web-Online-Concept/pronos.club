/**
 * ═══════════════════════════════════════════════════════════════════
 * /api/cron/email-retry (Niveau 2 retry queue — 11/05/2026)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Cron toutes les 15 minutes qui dépile email_retry_queue.
 *
 * Backoff exponentiel :
 *   - attempts=0 → tentative #1 (planifiée à T+15min depuis l'enqueue)
 *   - attempts=1 → tentative #2 (planifiée à T+1h après la 1ère)
 *   - attempts=2 → tentative #3 (planifiée à T+6h après la 2ème)
 *   - attempts=3 → abandon définitif (DELETE row + log failed_permanent)
 *
 * Soit 4 essais cumulés avec le retry inline (3 inline + 3 queue retries).
 *
 * Auth : Bearer CRON_SECRET (standard Vercel).
 *
 * Path : src/app/api/cron/email-retry/route.ts
 * ═══════════════════════════════════════════════════════════════════
 */

import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendEmailFromQueue } from "@/lib/emails";
import { NextResponse } from "next/server";

export const maxDuration = 60;

const BACKOFF_MS = [
  15 * 60 * 1000,      // attempts 0 → next: T+15min
  60 * 60 * 1000,      // attempts 1 → next: T+1h
  6 * 60 * 60 * 1000,  // attempts 2 → next: T+6h
];
const MAX_QUEUE_ATTEMPTS = 3; // 3 retries cron max → abandon

type QueueRow = {
  id: string;
  user_id: string | null;
  email: string;
  subject: string;
  html: string;
  category: string;
  locale: string | null;
  attempts: number;
  last_error: string | null;
  next_retry_at: string;
  created_at: string;
};

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // ─── 1. Récupérer les rows prêtes à être retentées ───
  // Limite à 50 par run pour éviter de saturer le SMTP Brevo en cas
  // d'incident massif. Si la queue grossit > 50, les suivants attendront
  // le prochain run (15 min plus tard).
  const { data: rows, error: selErr } = await supabaseAdmin
    .from("email_retry_queue")
    .select("*")
    .lte("next_retry_at", now.toISOString())
    .order("next_retry_at", { ascending: true })
    .limit(50);

  if (selErr) {
    console.error("[email-retry] select failed", selErr);
    return NextResponse.json({ error: selErr.message }, { status: 500 });
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({
      ok: true,
      timestamp: now.toISOString(),
      processed: 0,
      sent: 0,
      failed: 0,
      abandoned: 0,
    });
  }

  let sent = 0;
  let failedRetry = 0;
  let abandoned = 0;

  // ─── 2. Pour chaque row : tenter l'envoi ───
  for (const row of rows as QueueRow[]) {
    const result = await sendEmailFromQueue(
      row.email,
      row.subject,
      row.html,
      {
        category: row.category,
        userId: row.user_id,
        locale: (row.locale as "fr" | "en" | "es" | null) || null,
      }
    );

    if (result.success) {
      // SUCCÈS → DELETE row (l'envoi est déjà logué dans email_logs par sendEmailFromQueue)
      await supabaseAdmin.from("email_retry_queue").delete().eq("id", row.id);
      sent++;
    } else {
      const newAttempts = row.attempts + 1;

      if (newAttempts >= MAX_QUEUE_ATTEMPTS || !result.transient) {
        // ABANDON : trop de retries OU erreur devenue définitive
        await supabaseAdmin.from("email_retry_queue").delete().eq("id", row.id);

        // Log abandon final
        try {
          await supabaseAdmin.from("email_logs").insert({
            user_id: row.user_id,
            email: row.email,
            category: row.category + "_abandoned",
            subject: row.subject ? row.subject.slice(0, 500) : null,
            locale: row.locale,
            status: "failed_permanent",
            error: `Abandoned after ${newAttempts} retries: ${result.error || "unknown"}`.slice(0, 500),
            brevo_message_id: null,
            sent_at: new Date().toISOString(),
          });
        } catch (e) {
          console.error("[email-retry] abandon log failed", e);
        }
        abandoned++;
      } else {
        // RETRY : update attempts + next_retry_at avec backoff
        const nextDelayMs = BACKOFF_MS[newAttempts] || BACKOFF_MS[BACKOFF_MS.length - 1];
        const nextRetry = new Date(Date.now() + nextDelayMs).toISOString();

        await supabaseAdmin
          .from("email_retry_queue")
          .update({
            attempts: newAttempts,
            last_error: result.error ? result.error.slice(0, 500) : null,
            next_retry_at: nextRetry,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        failedRetry++;
      }
    }
  }

  // ─── 3. Reporting ───
  return NextResponse.json({
    ok: true,
    timestamp: now.toISOString(),
    processed: rows.length,
    sent,
    failed: failedRetry,
    abandoned,
  });
}