import { stripe } from "@/lib/stripe/config";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { onPremiumActivated, onPremiumRevoked } from "@/lib/telegram-hooks";
import { NextResponse } from "next/server";

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

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const userId = subscription.metadata.supabase_user_id;

      if (userId) {
        await supabaseAdmin
          .from("users")
          .update({
            subscription_status: "active",
            subscription_end: new Date(
              (subscription as unknown as Record<string, unknown>).current_period_end as number * 1000
            ).toISOString(),
            stripe_customer_id: customerId,
          })
          .eq("id", userId);

        await supabaseAdmin.from("subscriptions").insert({
          user_id: userId,
          stripe_subscription_id: subscriptionId,
          stripe_price_id: subscription.items.data[0]?.price.id,
          plan: "premium",
          status: "active",
          amount: 2000,
          currency: "eur",
          current_period_start: new Date(
            (subscription as unknown as Record<string, unknown>).current_period_start as number * 1000
          ).toISOString(),
          current_period_end: new Date(
            (subscription as unknown as Record<string, unknown>).current_period_end as number * 1000
          ).toISOString(),
        });

        onPremiumActivated(userId).catch(() => {});
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object;
      const userId = subscription.metadata.supabase_user_id;

      if (userId) {
        const status =
          subscription.status === "active" ? "active" :
          subscription.status === "past_due" ? "past_due" : "canceled";

        await supabaseAdmin
          .from("users")
          .update({
            subscription_status: status,
            subscription_end: new Date(
              (subscription as unknown as Record<string, unknown>).current_period_end as number * 1000
            ).toISOString(),
          })
          .eq("id", userId);

        await supabaseAdmin
          .from("subscriptions")
          .update({
            status,
            current_period_end: new Date(
              (subscription as unknown as Record<string, unknown>).current_period_end as number * 1000
            ).toISOString(),
            canceled_at: (subscription as unknown as Record<string, unknown>).canceled_at
              ? new Date(((subscription as unknown as Record<string, unknown>).canceled_at as number) * 1000).toISOString()
              : null,
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
      }
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object;
      const invoiceAny = invoice as unknown as Record<string, unknown>;
      const customerId = invoiceAny.customer as string;
      const amountPaid = (invoiceAny.amount_paid ?? 0) as number;

      // Calculate Stripe fees: 1.5% + 0.25€ for EU cards (average)
      // Stripe actual fee can be retrieved from balance transaction if needed
      const stripeFee = Math.round(amountPaid * 0.015 + 25); // 1.5% + 0.25€ in cents
      const netAmount = amountPaid - stripeFee;

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
          amount: amountPaid,
          currency: (invoiceAny.currency ?? "eur") as string,
          stripe_fee: stripeFee,
          net_amount: netAmount,
          status: "paid",
          paid_at: new Date().toISOString(),
        });
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

  return NextResponse.json({ received: true });
}