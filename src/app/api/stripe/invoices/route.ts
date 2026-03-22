import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-12-18.acacia" });

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get stripe customer id from our users table
  const { data: profile } = await supabase
    .from("users")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  if (!profile?.stripe_customer_id) {
    return NextResponse.json({ invoices: [] });
  }

  try {
    const invoices = await stripe.invoices.list({
      customer: profile.stripe_customer_id,
      limit: 24,
    });

    const formatted = invoices.data.map((inv) => ({
      id: inv.id,
      date: inv.created,
      amount: (inv.amount_paid ?? 0) / 100,
      currency: inv.currency?.toUpperCase() ?? "EUR",
      status: inv.status,
      pdf: inv.invoice_pdf,
      number: inv.number,
    }));

    return NextResponse.json({ invoices: formatted });
  } catch {
    return NextResponse.json({ invoices: [] });
  }
}