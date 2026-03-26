import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  auth: {
    user: process.env.BREVO_SMTP_USER,
    pass: process.env.BREVO_SMTP_PASS,
  },
});

const SUBJECT_LABELS: Record<string, string> = {
  question: "Question générale",
  abonnement: "Abonnement Premium",
  technique: "Problème technique",
  suggestion: "Suggestion / Amélioration",
  partenariat: "Partenariat / Affiliation",
  autre: "Autre",
};

export async function POST(request: Request) {
  const { name, email, subject, message } = await request.json();

  if (!name || !email || !subject || !message) {
    return NextResponse.json({ error: "Tous les champs sont requis" }, { status: 400 });
  }

  // Basic anti-spam
  if (message.length > 5000 || name.length > 100) {
    return NextResponse.json({ error: "Message trop long" }, { status: 400 });
  }

  const subjectLabel = SUBJECT_LABELS[subject] || subject;

  try {
    // Send to contact@pronos.club
    await transporter.sendMail({
      from: '"PRONOS.CLUB" <noreply@pronos.club>',
      replyTo: `"${name}" <${email}>`,
      to: "contact@pronos.club",
      subject: `[PRONOS.CLUB] ${subjectLabel} — ${name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="padding: 20px; background: #f8f9fa; border-radius: 12px; border-left: 4px solid #059669;">
            <h2 style="margin: 0 0 16px; font-size: 18px; color: #111;">Nouveau message de contact</h2>
            <p style="margin: 4px 0; font-size: 14px;"><strong>De :</strong> ${name} (${email})</p>
            <p style="margin: 4px 0; font-size: 14px;"><strong>Sujet :</strong> ${subjectLabel}</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
            <div style="font-size: 14px; color: #333; line-height: 1.6; white-space: pre-wrap;">${message}</div>
          </div>
          <p style="margin-top: 16px; font-size: 11px; color: #999;">
            Répondez directement à cet email pour contacter ${name} à ${email}.
          </p>
        </div>
      `,
    });

    // Send confirmation to the sender
    await transporter.sendMail({
      from: '"PRONOS.CLUB" <noreply@pronos.club>',
      replyTo: '"PRONOS.CLUB" <contact@pronos.club>',
      to: email,
      subject: "Nous avons bien reçu votre message — PRONOS.CLUB",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; background-color: #f5f5f5;">
          <div style="text-align: center; padding: 40px 20px 30px; background: linear-gradient(135deg, #0a0a0a, #062e1f); border-radius: 0 0 16px 16px;">
            <img src="https://pronos.club/pronos_club.png" alt="PRONOS.CLUB" width="120" height="120" style="width: 120px; height: 120px; object-fit: contain;" />
          </div>
          <div style="padding: 40px 30px; background-color: #ffffff;">
            <h2 style="text-align: center; color: #111; font-size: 22px; font-weight: 800; margin: 0 0 10px;">Message bien reçu !</h2>
            <p style="text-align: center; color: #666; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
              Bonjour ${name}, merci de nous avoir contacté. Nous vous répondrons dans les meilleurs délais.
            </p>
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px 20px; margin: 20px 0;">
              <p style="margin: 0 0 4px; font-size: 12px; color: #166534; font-weight: 600;">Votre message :</p>
              <p style="margin: 0; font-size: 12px; color: #15803d;"><strong>Sujet :</strong> ${subjectLabel}</p>
              <p style="margin: 8px 0 0; font-size: 12px; color: #15803d; white-space: pre-wrap;">${message.substring(0, 200)}${message.length > 200 ? "..." : ""}</p>
            </div>
            <p style="text-align: center; color: #999; font-size: 12px;">
              Délai de réponse habituel : sous 24h
            </p>
          </div>
          <div style="text-align: center; padding: 20px;">
            <p style="font-size: 11px; color: #9ca3af; margin: 0;">PRONOS.CLUB — Pronostics sportifs professionnels</p>
          </div>
        </div>
      `,
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Contact form error:", err);
    return NextResponse.json({ error: "Erreur lors de l'envoi" }, { status: 500 });
  }
}