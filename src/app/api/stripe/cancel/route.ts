import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Stripe from "stripe";
import nodemailer from "nodemailer";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-02-25.clover" });

const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  auth: {
    user: process.env.BREVO_SMTP_USER,
    pass: process.env.BREVO_SMTP_PASS,
  },
});

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
    const endDate = new Date(sub.currentPeriodEnd * 1000).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const displayName = profile.pseudo || user.email?.split("@")[0] || "Membre";

    // Send confirmation email via Brevo
    await transporter.sendMail({
      from: '"PRONOS.CLUB" <noreply@pronos.club>',
      to: user.email!,
      subject: "Confirmation de résiliation — PRONOS.CLUB",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; padding: 30px 20px; background: linear-gradient(135deg, #0a0a0a, #062e1f); border-radius: 16px;">
            <h1 style="color: white; font-size: 22px; margin: 0;">PRONOS.CLUB</h1>
            <p style="color: rgba(255,255,255,0.5); font-size: 14px; margin: 8px 0 0;">Confirmation de résiliation</p>
          </div>
          
          <div style="padding: 30px 0;">
            <p style="font-size: 15px; color: #333;">Bonjour ${displayName},</p>
            
            <p style="font-size: 15px; color: #333; line-height: 1.6;">
              Votre demande de résiliation a bien été prise en compte.
            </p>
            
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px; color: #92400e;">
                <strong>Votre accès Premium reste actif jusqu'au ${endDate}.</strong>
              </p>
            </div>
            
            <p style="font-size: 15px; color: #333; line-height: 1.6;">
              Après cette date, votre compte repassera automatiquement en <strong>version gratuite</strong>. 
              Aucune donnée ne sera supprimée : votre historique, vos statistiques personnelles et vos préférences seront conservés.
            </p>
            
            <p style="font-size: 15px; color: #333; line-height: 1.6;">
              Vous pourrez vous réabonner à tout moment depuis votre espace personnel.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://pronos.club/fr/espace" style="display: inline-block; background: #059669; color: white; padding: 12px 30px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 14px;">
                Accéder à mon espace
              </a>
            </div>
            
            <p style="font-size: 13px; color: #999; line-height: 1.5;">
              Si vous avez des questions, n'hésitez pas à nous contacter en répondant à cet email.
            </p>
          </div>
          
          <div style="border-top: 1px solid #eee; padding-top: 20px; text-align: center;">
            <p style="font-size: 12px; color: #999; margin: 0;">PRONOS.CLUB — Pronostics sportifs professionnels</p>
          </div>
        </div>
      `,
    }).catch(() => {});

    return NextResponse.json({ success: true, endDate });
  } catch {
    return NextResponse.json({ error: "Failed to cancel" }, { status: 500 });
  }
}