/**
 * ═══════════════════════════════════════════════════════════════════
 * /api/webhooks/brevo (Phase C — 11/05/2026)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Reçoit les événements transactionnels de Brevo :
 *   - delivered, opened, click : update email_logs.status (analytics)
 *   - hard_bounce, blocked, invalid_email, spam, unsubscribed : update
 *     email_logs + désactive notify_*_email du user concerné (protection
 *     réputation domaine)
 *
 * Authentification : Bearer token dans header Authorization.
 * Le token doit être configuré côté Brevo (Méthode d'auth = Token) ET
 * dans Vercel env vars (BREVO_WEBHOOK_TOKEN).
 *
 * Path : src/app/api/webhooks/brevo/route.ts
 * ═══════════════════════════════════════════════════════════════════
 */

import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

// Map des events Brevo → status email_logs
const EVENT_TO_STATUS: Record<string, string> = {
  // Délivrabilité
  delivered: "delivered",
  opened: "opened",
  click: "clicked",
  uniqueOpened: "opened",

  // Échecs → cleanup
  hard_bounce: "hard_bounce",
  hardBounce: "hard_bounce",
  invalid_email: "invalid_email",
  invalidEmail: "invalid_email",
  blocked: "blocked",
  spam: "spam",
  unsubscribed: "unsubscribed",
  deferred: "soft_bounce",
  soft_bounce: "soft_bounce",
  softBounce: "soft_bounce",
};

// Events qui doivent désactiver les emails pour cet utilisateur
const DEAD_EVENTS = new Set([
  "hard_bounce",
  "invalid_email",
  "blocked",
  "spam",
  "unsubscribed",
]);

function normalizeEvent(raw: string): string {
  return EVENT_TO_STATUS[raw] || raw.toLowerCase().replace(/[^a-z0-9_]/g, "_");
}

export async function POST(request: Request) {
  // ─── 1. Vérification Bearer token ───
  const authHeader = request.headers.get("authorization") || "";
  const expectedToken = process.env.BREVO_WEBHOOK_TOKEN;

  if (!expectedToken) {
    console.error("[brevo-webhook] BREVO_WEBHOOK_TOKEN env var missing");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  // Brevo envoie soit "Bearer <token>" soit juste "<token>" selon la version
  const providedToken = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!providedToken || providedToken !== expectedToken) {
    console.warn("[brevo-webhook] Unauthorized attempt", {
      hasAuthHeader: !!authHeader,
      tokenLength: providedToken.length,
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ─── 2. Parse le payload ───
  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Brevo peut envoyer soit un objet unique, soit un tableau d'events
  const events: any[] = Array.isArray(payload) ? payload : [payload];

  let processed = 0;
  let errors = 0;
  const usersToCleanup = new Set<string>();

  // ─── 3. Traiter chaque event ───
  for (const event of events) {
    try {
      // Brevo envoie typiquement : event, email, date, ts, message-id, subject, ...
      // Champ qu'on peut recevoir selon les versions : "message-id", "messageId", "message_id"
      const rawEvent: string = String(event.event || event.type || "").trim();
      const recipientEmail: string = String(event.email || "").toLowerCase().trim();
      const messageId: string | null =
        event["message-id"] || event.messageId || event.message_id || null;

      if (!rawEvent || !recipientEmail) {
        console.warn("[brevo-webhook] event without event/email", event);
        continue;
      }

      const newStatus = normalizeEvent(rawEvent);
      const isDead = DEAD_EVENTS.has(newStatus);

      // ─── 3a. Update email_logs ───
      // On cible par brevo_message_id si dispo (plus précis), sinon par email
      // + sent_at récent (les 7 derniers jours).
      const updateData = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      if (messageId) {
        // Stratégie 1 : match exact par message-id
        await supabaseAdmin
          .from("email_logs")
          .update(updateData)
          .eq("brevo_message_id", messageId);
      } else {
        // Stratégie 2 : fallback par email + sent récent
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        await supabaseAdmin
          .from("email_logs")
          .update(updateData)
          .eq("email", recipientEmail)
          .gte("sent_at", sevenDaysAgo);
      }

      // ─── 3b. Si event "mort" : retrouver le user concerné pour cleanup ───
      if (isDead) {
        const { data: user } = await supabaseAdmin
          .from("users")
          .select("id")
          .eq("email", recipientEmail)
          .maybeSingle();

        if (user?.id) {
          usersToCleanup.add(user.id);
        }
      }

      processed++;
    } catch (e) {
      console.error("[brevo-webhook] event processing failed", e);
      errors++;
    }
  }

  // ─── 4. Cleanup batch des users avec event "mort" ───
  // On désactive tous les flags email (tipster + abonnes + bilan + global)
  // pour protéger notre réputation. L'user peut se réabonner depuis sa page
  // notifications quand son email est de nouveau valide.
  if (usersToCleanup.size > 0) {
    const userIds = Array.from(usersToCleanup);
    await supabaseAdmin
      .from("users")
      .update({
        notify_email: false,
        notify_tipster_email: false,
        notify_abonnes_email: false,
        notify_bilan: false,
      })
      .in("id", userIds);

    // Miroir tipster_notif_prefs.channel_email = false
    await supabaseAdmin
      .from("tipster_notif_prefs")
      .update({
        channel_email: false,
        updated_at: new Date().toISOString(),
      })
      .in("user_id", userIds);
  }

  return NextResponse.json({
    ok: true,
    processed,
    errors,
    cleanedUsers: usersToCleanup.size,
  });
}

// ─── GET : utilitaire de test (vérifier que la route répond) ───
// Sans auth, retourne juste un message pour vérifier que l'endpoint est joignable.
export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Brevo webhook endpoint is alive. Use POST with Authorization: Bearer <BREVO_WEBHOOK_TOKEN> to deliver events.",
  });
}