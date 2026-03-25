import { supabaseAdmin } from "@/lib/supabase/admin";
import { createInviteLink, kickMember, revokeInviteLink } from "@/lib/telegram";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  auth: {
    user: process.env.BREVO_SMTP_USER,
    pass: process.env.BREVO_SMTP_PASS,
  },
});

/**
 * Called when a user becomes premium — generates invite link and sends email
 */
export async function onPremiumActivated(userId: string) {
  try {
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("email, pseudo, display_name, telegram_user_id")
      .eq("id", userId)
      .single();

    if (!user || !user.email) return;

    // Already in group
    if (user.telegram_user_id) return;

    // Generate invite link
    const inviteLink = await createInviteLink(userId);
    if (!inviteLink) return;

    // Store it
    await supabaseAdmin
      .from("users")
      .update({ telegram_invite_link: inviteLink })
      .eq("id", userId);

    const displayName = user.pseudo || user.display_name || user.email.split("@")[0];

    // Send email with invite link
    await transporter.sendMail({
      from: '"PRONOS.CLUB" <noreply@pronos.club>',
      to: user.email,
      subject: "Bienvenue Premium — Rejoignez le groupe Telegram",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; background-color: #f5f5f5;">
          <div style="text-align: center; padding: 40px 20px 30px; background: linear-gradient(135deg, #0a0a0a, #062e1f); border-radius: 0 0 16px 16px;">
            <img src="https://pronos.club/pronos_club.png" alt="PRONOS.CLUB" width="120" height="120" style="width: 120px; height: 120px; object-fit: contain;" />
            <p style="color: rgba(255,255,255,0.4); font-size: 12px; margin: 8px 0 0; text-transform: uppercase; letter-spacing: 2px;">Premium activé</p>
          </div>
          <div style="padding: 40px 30px; background-color: #ffffff;">
            <h2 style="text-align: center; color: #111; font-size: 22px; font-weight: 800; margin: 0 0 10px;">Bienvenue ${displayName} !</h2>
            <p style="text-align: center; color: #666; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
              Votre abonnement Premium est activé. Rejoignez notre groupe Telegram exclusif pour échanger avec les autres membres Premium.
            </p>
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center;">
              <p style="margin: 0 0 10px; font-size: 13px; color: #166534; font-weight: 600;">Groupe réservé aux abonnés Premium</p>
              <p style="margin: 0; font-size: 12px; color: #15803d; line-height: 1.5;">Discussions, échanges, entraide entre parieurs.</p>
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${inviteLink}" style="display: inline-block; background: linear-gradient(135deg, #059669, #10b981); color: #ffffff; padding: 16px 40px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 16px; box-shadow: 0 4px 14px rgba(16,185,129,0.3);">
                Rejoindre le groupe Telegram →
              </a>
            </div>
            <div style="background: #f8faf9; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; margin: 20px 0; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #6b7280; line-height: 1.5;">
                Ce lien est personnel et à usage unique. Il expire dans 48h.<br>
                Ne le partagez pas — chaque membre a son propre lien.<br><br>
                <strong>L'accès au groupe est lié à votre abonnement Premium.</strong><br>
                En cas de résiliation, vous serez automatiquement retiré du groupe.
              </p>
            </div>
          </div>
          <div style="text-align: center; padding: 25px 20px; background-color: #f5f5f5;">
            <p style="font-size: 12px; color: #9ca3af; margin: 0;">PRONOS.CLUB — Pronostics sportifs professionnels</p>
          </div>
        </div>
      `,
    }).catch((emailErr: unknown) => { console.error("onPremiumActivated email error:", emailErr); });
  } catch (err) {
    console.error("onPremiumActivated Telegram error:", err);
  }
}

/**
 * Called when a user loses premium — kicks from Telegram group
 */
export async function onPremiumRevoked(userId: string) {
  try {
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("telegram_user_id, telegram_invite_link")
      .eq("id", userId)
      .single();

    if (!user) return;

    // Kick from group if they joined
    if (user.telegram_user_id) {
      await kickMember(user.telegram_user_id);
    }

    // Revoke invite link if it exists
    if (user.telegram_invite_link) {
      await revokeInviteLink(user.telegram_invite_link);
    }

    // Clear telegram data
    await supabaseAdmin
      .from("users")
      .update({ telegram_user_id: null, telegram_invite_link: null })
      .eq("id", userId);
  } catch (err) {
    console.error("onPremiumRevoked Telegram error:", err);
  }
}