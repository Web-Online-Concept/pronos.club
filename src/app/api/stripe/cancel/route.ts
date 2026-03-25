import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/config";
import { sendCancellationEmail } from "@/lib/emails";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("stripe_customer_id, pseudo")
    .eq("id", user.id)
    .single();

  if (!profile?.stripe_customer_id) {
    return NextResponse.json({ error: "No Stripe customer" }, { status: 400 });
  }

  try {
    const subs = await stripe.subscriptions.list({
      customer: profile.stripe_customer_id,
      status: "active",
      limit: 1,
    });

    if (subs.data.length === 0) {
      return NextResponse.json({ error: "No active subscription" }, { status: 400 });
    }

    const sub = subs.data[0];

    // Cancel at period end
    await stripe.subscriptions.update(sub.id, {
      cancel_at_period_end: true,
    });

    // Format end date
    const subAny = sub as unknown as Record<string, unknown>;
    const periodEnd = (subAny.current_period_end ?? subAny.currentPeriodEnd ?? 0) as number;
    const endDate = new Date(periodEnd * 1000).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const displayName = profile.pseudo || user.email?.split("@")[0] || "Membre";

    // Send cancellation email
    await sendCancellationEmail(user.email!, displayName, endDate).catch(() => {});

    return NextResponse.json({ success: true, endDate });
  } catch {
    return NextResponse.json({ error: "Failed to cancel" }, { status: 500 });
  }
}