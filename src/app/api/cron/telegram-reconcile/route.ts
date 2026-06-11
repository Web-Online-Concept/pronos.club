// src/app/api/cron/telegram-reconcile/route.ts
//
// FILET DE SÉCURITÉ — Réconciliation groupe Telegram Premium ⇆ abonnements.
//
// Pourquoi ce cron existe :
// Même avec les webhooks Stripe corrigés, un kick peut échouer ponctuellement
// (webhook manqué, panne réseau Telegram, retry épuisé). Ce cron rattrape tout
// abonné qui n'est PLUS premium mais qui a encore un `telegram_user_id`
// renseigné — donc potentiellement encore dans le groupe — et le kicke.
//
// Il NE peut PAS lister les membres du groupe via l'API Bot (limite Telegram :
// getChatMembers n'existe pas pour les groupes). Il travaille donc sur la base
// des `telegram_user_id` connus. Les "fantômes" sans ID en base doivent être
// retirés manuellement une fois (voir la requête SQL fournie), après quoi la
// capture d'ID corrigée empêche d'en recréer.
//
// Déclenchement :
//   - Automatique : Vercel Cron (voir vercel.json), 1×/jour.
//   - Manuel : GET avec header Authorization: Bearer <CRON_SECRET>.
//
// Sécurité : protégé par CRON_SECRET (même convention que les autres crons).

import { supabaseAdmin } from "@/lib/supabase/admin";
import { kickMember, revokeInviteLink, isUserInGroup } from "@/lib/telegram";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type ReconcileUser = {
  id: string;
  email: string | null;
  pseudo: string | null;
  telegram_user_id: number | null;
  telegram_invite_link: string | null;
  subscription_status: string | null;
  subscription_end: string | null;
};

export async function GET(request: Request) {
  // ── Auth ──────────────────────────────────────────────────────────
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const nowISO = new Date().toISOString();
  const results = {
    checked: 0,
    kicked: 0,
    alreadyGone: 0,
    skipped: 0,
    errors: 0,
    details: [] as Array<{ userId: string; action: string; reason?: string }>,
  };

  try {
    // Cible : utilisateurs avec un telegram_user_id renseigné (donc
    // théoriquement dans le groupe) MAIS qui ne sont plus premium actifs.
    // "plus premium actif" = statut non actif/trialing OU date d'échéance passée.
    const { data: candidates, error } = await supabaseAdmin
      .from("users")
      .select(
        "id, email, pseudo, telegram_user_id, telegram_invite_link, subscription_status, subscription_end"
      )
      .not("telegram_user_id", "is", null);

    if (error) {
      console.error("[reconcile] DB query failed:", error);
      return NextResponse.json({ error: "DB query failed" }, { status: 500 });
    }

    const users = (candidates ?? []) as ReconcileUser[];

    for (const user of users) {
      results.checked++;

      const statusActive =
        user.subscription_status === "active" ||
        user.subscription_status === "trialing";
      const notExpired =
        user.subscription_end != null && user.subscription_end > nowISO;

      const isStillPremium = statusActive && notExpired;

      // Abonné encore valide → on ne touche à rien.
      if (isStillPremium) {
        results.skipped++;
        continue;
      }

      // Plus premium mais ID Telegram présent → candidat au kick.
      const tgId = user.telegram_user_id as number;

      // Vérifier la présence réelle pour ne pas kicker dans le vide.
      const present = await isUserInGroup(tgId);

      if (present === false) {
        // Déjà parti : on nettoie juste la BDD.
        await supabaseAdmin
          .from("users")
          .update({ telegram_user_id: null, telegram_invite_link: null })
          .eq("id", user.id);
        results.alreadyGone++;
        results.details.push({ userId: user.id, action: "already_gone_cleaned" });
        continue;
      }

      // present === true OU null (incertain) → on tente le kick (idempotent).
      const kicked = await kickMember(tgId);

      if (user.telegram_invite_link) {
        await revokeInviteLink(user.telegram_invite_link).catch(() => {});
      }

      if (kicked) {
        await supabaseAdmin
          .from("users")
          .update({ telegram_user_id: null, telegram_invite_link: null })
          .eq("id", user.id);
        results.kicked++;
        results.details.push({ userId: user.id, action: "kicked" });
      } else {
        results.errors++;
        results.details.push({
          userId: user.id,
          action: "kick_failed",
          reason: "banChatMember returned false (admin? already left?)",
        });
      }
    }

    console.log(
      `[reconcile] done — checked:${results.checked} kicked:${results.kicked} ` +
      `alreadyGone:${results.alreadyGone} skipped:${results.skipped} errors:${results.errors}`
    );

    return NextResponse.json({ ok: true, ...results });
  } catch (err) {
    console.error("[reconcile] fatal error:", err);
    return NextResponse.json({ error: "Reconcile failed" }, { status: 500 });
  }
}