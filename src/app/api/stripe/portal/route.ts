import { stripe } from "@/lib/stripe/config";
import { requireAuth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST() {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!user.stripe_customer_id) {
    return NextResponse.json({ error: "No subscription found" }, { status: 400 });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/fr/espace/abonnement`,
  });

  return NextResponse.json({ url: session.url });
}
