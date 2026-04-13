// src/app/api/account/delete/route.ts
// Suppression de compte avec confirmation par email OTP

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder");

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Exiger une confirmation : l'utilisateur doit envoyer son email dans le body
  let body: { confirmEmail?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Confirmation required" }, { status: 400 });
  }

  if (!body.confirmEmail || body.confirmEmail.toLowerCase() !== user.email?.toLowerCase()) {
    return NextResponse.json(
      { error: "Veuillez confirmer en saisissant votre adresse email." },
      { status: 400 }
    );
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