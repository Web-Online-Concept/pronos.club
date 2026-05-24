// src/app/api/stripe/webhook/route.ts
// Webhook Stripe avec idempotence (évite de traiter le même event 2 fois)

import { stripe } from "@/lib/stripe/config";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { onPremiumActivated, onPremiumRevoked } from "@/lib/telegram-hooks";
import { sendAdminAlert } from "@/lib/admin-alerts";
import { NextResponse } from "next/server";

// ── Idempotence : tracker les event IDs déjà traités ──
const processedEvents = new Map<string, number>();
const MAX_PROCESSED = 5000;

function isAlreadyProcessed(eventId: string): boolean {
  const now = Date.now();

  // Nettoyage périodique
  if (processedEvents.size > MAX_PROCESSED) {
    for (const [id, timestamp] of processedEvents) {
      if (now - timestamp > 24 * 60 * 60 * 1000) processedEvents.delete(id);
    }
  }

  if (processedEvents.has(eventId)) return true;
  processedEvents.set(eventId, now);
  return false;
}

// Safe timestamp conversion — Stripe sends Unix seconds, can be null/undefined
function toISO(timestamp: unknown): string | null {
  if (timestamp == null) return null;
  const num = typeof timestamp === "number" ? timestamp : Number(timestamp);
  if (isNaN(num) || num <= 0) return null;
  const ms = num > 1e12 ? num : num * 1000;
  const d = new Date(ms);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// ── Extraction robuste de current_period_end / start ──
//
// IMPORTANT : depuis une MAJ de l'API Stripe (2025), current_period_end
// et current_period_start ne sont PLUS a la racine de l'objet subscription.
// Ils sont desormais sur les ITEMS : subscription.items.data[0].current_period_end
//
// Cette fonction lit la valeur au bon endroit, avec fallback sur l'ancienne
// position pour rester compatible avec les anciens abonnements / anciennes
// versions d'API.
function getSubscriptionPeriod(
  subscription: unknown
): { periodStart: string | null; periodEnd: string | null } {
  const sub = subscription as Record<string, unknown>;

  // 1. Tentative NOUVELLE position : items.data[0].current_period_*
  const items = sub.items as Record<string, unknown> | undefined;
  const itemsData = (items?.data ?? []) as Array<Record<string, unknown>>;
  const firstItem = itemsData[0];

  let periodEnd: string | null = null;
  let periodStart: string | null = null;

  if (firstItem) {
    periodEnd = toISO(firstItem.current_period_end);
    periodStart = toISO(firstItem.current_period_start);
  }

  // 2. Fallback ANCIENNE position : racine de subscription
  if (periodEnd == null) {
    periodEnd = toISO(sub.current_period_end);
  }
  if (periodStart == null) {
    periodStart = toISO(sub.current_period_start);
  }

  return { periodStart, periodEnd };
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // ── Idempotence : ignorer les events déjà traités ──
  if (isAlreadyProcessed(event.id)) {
    return NextResponse.json({ received: true, skipped: "already_processed" });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const userId = subscription.metadata.supabase_user_id;

        if (!userId || !["active", "trialing"].includes(subscription.status)) {
          console.log(`[webhook] checkout.session.completed ignored — sub status: ${subscription.status}, userId: ${userId}`);
          break;
        }

        const subStatus = subscription.status === "trialing" ? "trialing" : "active";
        const { periodStart, periodEnd } = getSubscriptionPeriod(subscription);

        // Garde-fou : si Stripe ne renvoie toujours pas de periode, on calcule
        // une echeance par defaut (+1 mois) pour ne JAMAIS laisser un abonne
        // actif avec subscription_end = null (sinon il se fait kicker du Telegram).
        const safePeriodEnd = periodEnd ?? new Date(
          Date.now() + 31 * 24 * 60 * 60 * 1000
        ).toISOString();

        await supabaseAdmin
          .from("users")
          .update({
            subscription_status: subStatus,
            subscription_end: safePeriodEnd,
            stripe_customer_id: customerId,
            ...(subStatus === "trialing" ? { has_used_trial: true } : {}),
          })
          .eq("id", userId);

        await supabaseAdmin.from("subscriptions").upsert(
          {
            user_id: userId,
            stripe_subscription_id: subscriptionId,
            stripe_price_id: subscription.items.data[0]?.price.id,
            plan: "premium",
            status: subStatus,
            amount: 2000,
            currency: "eur",
            current_period_start: periodStart,
            current_period_end: safePeriodEnd,
          },
          { onConflict: "stripe_subscription_id" }
        );

        onPremiumActivated(userId).catch(() => {});

        const { data: premiumUser } = await supabaseAdmin
          .from("users")
          .select("email, display_name")
          .eq("id", userId)
          .single();
        if (premiumUser) {
          sendAdminAlert("new_premium", {
            email: premiumUser.email,
            name: premiumUser.display_name,
          }).catch(() => {});
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const userId = subscription.metadata.supabase_user_id;

        if (userId) {
          const sub = subscription as unknown as Record<string, unknown>;
          const status =
            subscription.status === "active" ? "active" :
            subscription.status === "trialing" ? "trialing" :
            subscription.status === "past_due" ? "past_due" : "canceled";

          const { periodEnd } = getSubscriptionPeriod(subscription);

          // Pour un abonnement actif/trialing, on ne veut JAMAIS ecrire null.
          // Si Stripe ne donne pas de periode, on garde la date existante en BDD
          // (on ne l'ecrase pas avec null).
          const isActiveLike = status === "active" || status === "trialing";
          const updatePayload: Record<string, unknown> = {
            subscription_status: status,
          };
          if (periodEnd != null) {
            updatePayload.subscription_end = periodEnd;
          } else if (isActiveLike) {
            // periodEnd introuvable mais abonne actif : fallback +1 mois
            updatePayload.subscription_end = new Date(
              Date.now() + 31 * 24 * 60 * 60 * 1000
            ).toISOString();
          }

          await supabaseAdmin
            .from("users")
            .update(updatePayload)
            .eq("id", userId);

          await supabaseAdmin
            .from("subscriptions")
            .update({
              status,
              ...(periodEnd != null ? { current_period_end: periodEnd } : {}),
              canceled_at: sub.canceled_at ? toISO(sub.canceled_at) : null,
            })
            .eq("stripe_subscription_id", subscription.id);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const userId = subscription.metadata.supabase_user_id;

        if (userId) {
          // Cet abonnement-ci est annule : on le marque canceled dans `subscriptions`.
          await supabaseAdmin
            .from("subscriptions")
            .update({ status: "canceled" })
            .eq("stripe_subscription_id", subscription.id);

          // ── GARDE-FOU DOUBLON ──────────────────────────────────────────
          // AVANT de revoquer le premium du user, on verifie s'il lui reste
          // un AUTRE abonnement actif chez Stripe. Cas typique : un abonne
          // avait 2 abonnements en parallele (doublon), on en annule 1, mais
          // il doit garder son acces grace a l'autre.
          let hasAnotherActiveSub = false;
          try {
            const customerId = subscription.customer as string;
            const otherSubs = await stripe.subscriptions.list({
              customer: customerId,
              status: "active",
              limit: 10,
            });
            // On cherche un abonnement actif DIFFERENT de celui qu'on annule
            hasAnotherActiveSub = otherSubs.data.some(
              (s) => s.id !== subscription.id
            );

            // On verifie aussi les abonnements "trialing" (essai en cours)
            if (!hasAnotherActiveSub) {
              const trialingSubs = await stripe.subscriptions.list({
                customer: customerId,
                status: "trialing",
                limit: 10,
              });
              hasAnotherActiveSub = trialingSubs.data.some(
                (s) => s.id !== subscription.id
              );
            }
          } catch (err) {
            // Si l'appel Stripe echoue, on reste prudent : on NE revoque PAS
            // (mieux vaut un acces de trop qu'un abonne paye vire par erreur).
            console.error("[webhook] deleted — check other subs failed:", err);
            hasAnotherActiveSub = true;
          }

          if (hasAnotherActiveSub) {
            // L'utilisateur garde un autre abonnement actif : on NE touche
            // PAS a son statut premium, on ne le kicke PAS du Telegram.
            console.log(
              `[webhook] subscription ${subscription.id} deleted but user ${userId} ` +
              `still has another active subscription — premium preserved.`
            );
            break;
          }

          // Aucun autre abonnement actif : revocation normale du premium.
          await supabaseAdmin
            .from("users")
            .update({ subscription_status: "canceled" })
            .eq("id", userId);

          onPremiumRevoked(userId).catch(() => {});

          const { data: canceledUser } = await supabaseAdmin
            .from("users")
            .select("email, display_name")
            .eq("id", userId)
            .single();
          if (canceledUser) {
            sendAdminAlert("cancellation", {
              email: canceledUser.email,
              name: canceledUser.display_name,
            }).catch(() => {});
          }
        }
        break;
      }

      case "invoice.payment_succeeded":
      case "invoice.paid": {
        const invoice = event.data.object;
        const invoiceAny = invoice as unknown as Record<string, unknown>;
        const customerId = invoiceAny.customer as string;
        const amountPaid = (invoiceAny.amount_paid ?? 0) as number;

        if (amountPaid === 0) break;

        const stripeFee = Math.round(amountPaid * 0.015 + 25);
        const netAmount = amountPaid - stripeFee;

        const { data: user } = await supabaseAdmin
          .from("users")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (user) {
          await supabaseAdmin.from("payments").upsert(
            {
              user_id: user.id,
              stripe_payment_id: (invoiceAny.payment_intent ?? "") as string,
              stripe_invoice_id: invoice.id,
              amount: amountPaid,
              currency: (invoiceAny.currency ?? "eur") as string,
              stripe_fee: stripeFee,
              net_amount: netAmount,
              status: "succeeded",
              paid_at: new Date().toISOString(),
            },
            { onConflict: "stripe_invoice_id" }
          );
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const invoiceAny = invoice as unknown as Record<string, unknown>;
        const customerId = invoiceAny.customer as string;

        const { data: user } = await supabaseAdmin
          .from("users")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (user) {
          await supabaseAdmin.from("payments").insert({
            user_id: user.id,
            stripe_payment_id: (invoiceAny.payment_intent ?? "") as string,
            stripe_invoice_id: invoice.id,
            amount: (invoiceAny.amount_due ?? 0) as number,
            currency: (invoiceAny.currency ?? "eur") as string,
            stripe_fee: 0,
            net_amount: 0,
            status: "failed",
            paid_at: new Date().toISOString(),
          });
        }
        break;
      }
    }
  } catch (err) {
    console.error(`[webhook] Error processing ${event.type}:`, err);
    return NextResponse.json({ error: "Webhook processing error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}