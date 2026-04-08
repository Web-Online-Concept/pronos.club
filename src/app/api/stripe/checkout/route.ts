import { stripe, PLAN } from "@/lib/stripe/config";
import { requireAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

const PROMO_CODES: Record<string, number> = {
  PRONOS7: 7,
};

export async function POST(request: Request) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse promo code from body (optional)
  let promoCode = "";
  try {
    const body = await request.json();
    promoCode = (body.promoCode || "").trim().toUpperCase();
  } catch {
    // No body or invalid JSON — no promo code, that's fine
  }

  // Validate promo code if provided
  let trialDays = 0;
  if (promoCode) {
    if (!PROMO_CODES[promoCode]) {
      return NextResponse.json({ error: "Code promo invalide" }, { status: 400 });
    }

    // Check if user already used a trial/promo
    const { data: userData } = await supabaseAdmin
      .from("users")
      .select("has_used_trial")
      .eq("id", user.id)
      .single();

    if (userData?.has_used_trial) {
      return NextResponse.json(
        { error: "Vous avez déjà bénéficié d'une offre promotionnelle" },
        { status: 400 }
      );
    }

    trialDays = PROMO_CODES[promoCode];
  }

  // Get or create Stripe customer
  let customerId = user.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;

    await supabaseAdmin
      .from("users")
      .update({ stripe_customer_id: customerId })
      .eq("id", user.id);
  }

  const locale = user.locale || "fr";

  const sessionParams: Record<string, unknown> = {
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price: PLAN.priceId,
        quantity: 1,
      },
    ],
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/${locale}/espace/abonnement?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/${locale}/abonnement?canceled=true`,
    subscription_data: {
      metadata: { supabase_user_id: user.id },
      ...(trialDays > 0 ? { trial_period_days: trialDays } : {}),
    },
  };

  // If no promo code used, allow Stripe's own promotion codes
  if (!trialDays) {
    sessionParams.allow_promotion_codes = true;
  }

  const session = await stripe.checkout.sessions.create(
    sessionParams as Parameters<typeof stripe.checkout.sessions.create>[0]
  );

  return NextResponse.json({ url: session.url });
}