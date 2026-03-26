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
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; background-color: #f5f5f5;">
          <div style="padding: 30px 24px 20px; background: linear-gradient(135deg, #0a0a0a, #062e1f); border-radius: 0 0 16px 16px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td>
                  <p style="margin: 0; font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: rgba(255,255,255,0.3);">Nouveau message</p>
                  <p style="margin: 4px 0 0; font-size: 18px; font-weight: 800; color: #ffffff;">${subjectLabel}</p>
                </td>
                <td align="right" style="vertical-align: top;">
                  <span style="display: inline-block; background: #059669; color: #fff; padding: 4px 12px; border-radius: 20px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Contact</span>
                </td>
              </tr>
            </table>
          </div>
          <div style="padding: 30px 24px; background-color: #ffffff;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #f8faf9; border-radius: 12px; border: 1px solid #e5e7eb;">
              <tr>
                <td style="padding: 16px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td width="70" style="vertical-align: top;">
                        <div style="width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, #059669, #10b981); text-align: center; line-height: 48px; font-size: 20px; font-weight: 800; color: #fff;">
                          ${name.charAt(0).toUpperCase()}
                        </div>
                      </td>
                      <td style="vertical-align: top;">
                        <p style="margin: 0; font-size: 16px; font-weight: 700; color: #111;">${name}</p>
                        <p style="margin: 2px 0 0; font-size: 13px; color: #059669;">${email}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            <div style="margin: 24px 0; padding: 20px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px;">
              <p style="margin: 0; font-size: 14px; color: #333; line-height: 1.7; white-space: pre-wrap;">${message}</p>
            </div>
            <div style="text-align: center; padding: 12px 0;">
              <a href="mailto:${email}?subject=Re: ${subjectLabel} — PRONOS.CLUB" style="display: inline-block; background: linear-gradient(135deg, #059669, #10b981); color: #ffffff; padding: 12px 32px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 14px; box-shadow: 0 4px 14px rgba(16,185,129,0.3);">
                Répondre à ${name} →
              </a>
            </div>
          </div>
          <div style="text-align: center; padding: 16px 20px;">
            <p style="font-size: 10px; color: #9ca3af; margin: 0;">PRONOS.CLUB — Message reçu via le formulaire de contact</p>
          </div>
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