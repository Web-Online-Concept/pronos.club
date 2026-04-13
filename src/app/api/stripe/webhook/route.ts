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

        const sub = subscription as unknown as Record<string, unknown>;
        const subStatus = subscription.status === "trialing" ? "trialing" : "active";
        const periodEnd = toISO(sub.current_period_end);
        const periodStart = toISO(sub.current_period_start);

        await supabaseAdmin
          .from("users")
          .update({
            subscription_status: subStatus,
            subscription_end: periodEnd,
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
            current_period_end: periodEnd,
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

          const periodEnd = toISO(sub.current_period_end);

          await supabaseAdmin
            .from("users")
            .update({
              subscription_status: status,
              subscription_end: periodEnd,
            })
            .eq("id", userId);

          await supabaseAdmin
            .from("subscriptions")
            .update({
              status,
              current_period_end: periodEnd,
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
          await supabaseAdmin
            .from("users")
            .update({ subscription_status: "canceled" })
            .eq("id", userId);

          await supabaseAdmin
            .from("subscriptions")
            .update({ status: "canceled" })
            .eq("stripe_subscription_id", subscription.id);

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