import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-12-18.acacia" });

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get stripe customer id
  const { data: profile } = await supabase
    .from("users")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  // Cancel all active Stripe subscriptions
  if (profile?.stripe_customer_id) {
    try {
      const subs = await stripe.subscriptions.list({
        customer: profile.stripe_customer_id,
        status: "active",
      });
      for (const sub of subs.data) {
        await stripe.subscriptions.cancel(sub.id);
      }
    } catch {
      // Continue even if Stripe fails
    }
  }

  // Delete user picks tracking
  await supabaseAdmin.from("user_picks").delete().eq("user_id", user.id);

  // Delete from users table
  await supabaseAdmin.from("users").delete().eq("id", user.id);

  // Delete auth user
  await supabaseAdmin.auth.admin.deleteUser(user.id);

  return NextResponse.json({ success: true });
}