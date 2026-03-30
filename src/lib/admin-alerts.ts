import { supabaseAdmin } from "@/lib/supabase/admin";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  auth: {
    user: process.env.BREVO_SMTP_USER,
    pass: process.env.BREVO_SMTP_PASS,
  },
});

type AlertType = "new_signup" | "new_premium" | "cancellation";

const ALERT_CONFIG: Record<AlertType, { column: string; emoji: string; subject: string }> = {
  new_signup:    { column: "alert_new_signup",    emoji: "👋", subject: "Nouvel inscrit" },
  new_premium:   { column: "alert_new_premium",   emoji: "⭐", subject: "Nouvel abonné Premium" },
  cancellation:  { column: "alert_cancellation",  emoji: "🚪", subject: "Résiliation Premium" },
};

export async function sendAdminAlert(
  type: AlertType,
  details: { email?: string; name?: string; extra?: string }
) {
  const config = ALERT_CONFIG[type];

  // Fetch admins who opted in for this alert type
  const { data: prefs } = await supabaseAdmin
    .from("admin_alert_prefs")
    .select(`${config.column}, user:users(email)`)
    .eq(config.column, true);

  if (!prefs || prefs.length === 0) return;

  const recipients = prefs
    .map((p) => {
      const user = Array.isArray(p.user) ? p.user[0] : p.user;
      return user?.email;
    })
    .filter(Boolean) as string[];

  if (recipients.length === 0) return;

  const date = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" });

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 500px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #0a0a0a, #062e1f); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
        <span style="font-size: 32px;">${config.emoji}</span>
        <h2 style="color: #fff; margin: 8px 0 0; font-size: 18px;">${config.subject}</h2>
      </div>
      <div style="background: #fff; padding: 24px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px;">
        <table style="width: 100%; border-collapse: collapse;">
          ${details.email ? `<tr><td style="padding: 6px 0; color: #999; font-size: 13px;">Email</td><td style="padding: 6px 0; font-weight: 600;">${details.email}</td></tr>` : ""}
          ${details.name ? `<tr><td style="padding: 6px 0; color: #999; font-size: 13px;">Nom</td><td style="padding: 6px 0; font-weight: 600;">${details.name}</td></tr>` : ""}
          ${details.extra ? `<tr><td style="padding: 6px 0; color: #999; font-size: 13px;">Info</td><td style="padding: 6px 0;">${details.extra}</td></tr>` : ""}
          <tr><td style="padding: 6px 0; color: #999; font-size: 13px;">Date</td><td style="padding: 6px 0;">${date}</td></tr>
        </table>
      </div>
      <p style="text-align: center; color: #999; font-size: 11px; margin-top: 16px;">PRONOS.CLUB — Alerte admin automatique</p>
    </div>
  `;

  // Send to all opted-in admins
  await Promise.allSettled(
    recipients.map((to) =>
      transporter.sendMail({
        from: `"PRONOS.CLUB" <contact@pronos.club>`,
        replyTo: "contact@pronos.club",
        to,
        subject: `${config.emoji} ${config.subject} — PRONOS.CLUB`,
        html,
      })
    )
  );
}