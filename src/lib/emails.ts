import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  auth: {
    user: process.env.BREVO_SMTP_USER,
    pass: process.env.BREVO_SMTP_PASS,
  },
});

// ═══════════════════════════════════════════════
// DESIGN SYSTEM — shared across all emails
// ═══════════════════════════════════════════════

function emailWrapper(content: string, preheader?: string) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; background-color: #f5f5f5;">
      ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#f5f5f5;">${preheader}</div>` : ""}
      <div style="text-align: center; padding: 40px 20px 30px; background: linear-gradient(135deg, #0a0a0a, #062e1f); border-radius: 0 0 16px 16px;">
        <img src="https://pronos.club/pronos_club.png" alt="PRONOS.CLUB" width="120" height="120" style="width: 120px; height: 120px; object-fit: contain;" />
      </div>
      <div style="padding: 40px 30px; background-color: #ffffff;">
        ${content}
      </div>
      <div style="text-align: center; padding: 20px;">
        <p style="font-size: 11px; color: #9ca3af; margin: 0;">PRONOS.CLUB — Pronostics sportifs professionnels</p>
        <p style="font-size: 10px; color: #d1d5db; margin: 4px 0 0;">Les paris sportifs comportent des risques. Jouez responsablement. 18+</p>
      </div>
    </div>
  `;
}

function greenButton(text: string, href: string) {
  return `
    <div style="text-align: center; margin: 30px 0;">
      <a href="${href}" style="display: inline-block; background: linear-gradient(135deg, #059669, #10b981); color: #ffffff; padding: 16px 40px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 16px; box-shadow: 0 4px 14px rgba(16,185,129,0.3);">
        ${text}
      </a>
    </div>
  `;
}

function infoBox(content: string, color: "green" | "amber" | "blue" = "green") {
  const colors = {
    green: { bg: "#f0fdf4", border: "#bbf7d0", text: "#166534" },
    amber: { bg: "#fffbeb", border: "#fde68a", text: "#92400e" },
    blue: { bg: "#eff6ff", border: "#bfdbfe", text: "#1e40af" },
  };
  const c = colors[color];
  return `
    <div style="background: ${c.bg}; border: 1px solid ${c.border}; border-radius: 12px; padding: 16px 20px; margin: 20px 0;">
      <p style="margin: 0; font-size: 13px; color: ${c.text}; line-height: 1.6;">${content}</p>
    </div>
  `;
}

async function sendEmail(to: string, subject: string, html: string) {
  try {
    await transporter.sendMail({
      from: '"PRONOS.CLUB" <noreply@pronos.club>',
      replyTo: '"PRONOS.CLUB" <contact@pronos.club>',
      to,
      subject,
      html,
    });
    return true;
  } catch (err) {
    console.error("Email send error:", err);
    return false;
  }
}

// ═══════════════════════════════════════════════
// 1. BIENVENUE — après première inscription
// ═══════════════════════════════════════════════

export async function sendWelcomeEmail(email: string, displayName: string) {
  const html = emailWrapper(`
    <h2 style="text-align: center; color: #111; font-size: 22px; font-weight: 800; margin: 0 0 10px;">Bienvenue ${displayName} !</h2>
    <p style="text-align: center; color: #666; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
      Votre compte PRONOS.CLUB est créé. Vous avez accès aux pronostics gratuits, aux statistiques et à l'historique complet.
    </p>
    ${infoBox(`
      <strong>Ce qui vous attend :</strong><br>
      • Des pronostics sportifs publiés chaque jour<br>
      • Un historique transparent et vérifiable<br>
      • Des statistiques détaillées en temps réel<br>
      • Un outil de gestion de bankroll personnalisé
    `)}
    <p style="text-align: center; color: #666; font-size: 14px; line-height: 1.6;">
      <strong>Première chose à faire :</strong> activez les notifications pour être prévenu à chaque nouveau pronostic.
    </p>
    ${greenButton("Accéder à mon espace →", "https://pronos.club/fr/espace")}
    <p style="text-align: center; color: #999; font-size: 12px;">
      Pensez à installer l'application sur votre téléphone pour une expérience optimale.
    </p>
  `, "Bienvenue sur PRONOS.CLUB — Votre compte est créé");

  return sendEmail(email, "Bienvenue sur PRONOS.CLUB", html);
}

// ═══════════════════════════════════════════════
// 2. BIENVENUE PREMIUM — après souscription
// ═══════════════════════════════════════════════

export async function sendWelcomePremiumEmail(email: string, displayName: string, telegramLink?: string | null) {
  const telegramBlock = telegramLink ? `
    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center;">
      <p style="margin: 0 0 8px; font-size: 13px; color: #166534; font-weight: 600;">Groupe Telegram exclusif</p>
      <p style="margin: 0 0 12px; font-size: 12px; color: #15803d;">Échangez avec les autres membres Premium et le tipster</p>
      <a href="${telegramLink}" style="display: inline-block; background: #2AABEE; color: #fff; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 13px;">
        Rejoindre le groupe Telegram →
      </a>
      <p style="margin: 8px 0 0; font-size: 10px; color: #6b7280;">Lien personnel et à usage unique — expire dans 48h</p>
    </div>
  ` : "";

  const html = emailWrapper(`
    <h2 style="text-align: center; color: #111; font-size: 22px; font-weight: 800; margin: 0 0 10px;">Bienvenue en Premium, ${displayName} !</h2>
    <p style="text-align: center; color: #666; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
      Merci pour votre confiance. Vous avez désormais accès à l'intégralité de nos pronostics.
    </p>
    ${infoBox(`
      <strong>Votre abonnement Premium inclut :</strong><br>
      • Tous les pronostics (50+/mois)<br>
      • Groupe Telegram exclusif<br>
      • Notifications prioritaires<br>
      • Bilan mensuel par email<br>
      • Résiliable en 1 clic, sans engagement
    `)}
    ${telegramBlock}
    ${greenButton("Voir les pronostics →", "https://pronos.club/fr/pronostics")}
    <div style="background: #f8faf9; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; margin: 20px 0; text-align: center;">
      <p style="margin: 0; font-size: 12px; color: #6b7280; line-height: 1.5;">
        L'accès au groupe Telegram est lié à votre abonnement.<br>
        En cas de résiliation, vous serez automatiquement retiré du groupe.
      </p>
    </div>
  `, "Votre abonnement Premium est activé — Bienvenue !");

  return sendEmail(email, "Bienvenue en Premium — PRONOS.CLUB", html);
}

// ═══════════════════════════════════════════════
// 3. NOUVEAU PICK — notification de pronostic
// ═══════════════════════════════════════════════

export async function sendNewPickEmail(email: string, sport?: string, isPremium?: boolean) {
  const accessLabel = isPremium ? "Pronostic Premium" : "Pronostic gratuit";
  const sportLabel = sport ? ` — ${sport}` : "";

  const html = emailWrapper(`
    <h2 style="text-align: center; color: #111; font-size: 22px; font-weight: 800; margin: 0 0 10px;">Nouveau pronostic publié</h2>
    <p style="text-align: center; color: #666; font-size: 15px; line-height: 1.6; margin: 0 0 4px;">
      ${accessLabel}${sportLabel}
    </p>
    <p style="text-align: center; color: #999; font-size: 13px;">
      Connectez-vous pour consulter la sélection et le ticket du tipster.
    </p>
    ${greenButton("Voir le pronostic →", "https://pronos.club/fr/pronostics")}
    <p style="text-align: center; color: #bbb; font-size: 11px;">
      Pour modifier vos préférences de notification, rendez-vous dans votre espace personnel.
    </p>
  `, `Nouveau pronostic${sportLabel} disponible sur PRONOS.CLUB`);

  return sendEmail(email, `Nouveau pronostic disponible${sportLabel} — PRONOS.CLUB`, html);
}

// ═══════════════════════════════════════════════
// 4. RÉSILIATION — confirmation (déjà dans cancel route, on centralise)
// ═══════════════════════════════════════════════

export async function sendCancellationEmail(email: string, displayName: string, endDate: string) {
  const html = emailWrapper(`
    <h2 style="text-align: center; color: #111; font-size: 22px; font-weight: 800; margin: 0 0 10px;">Résiliation confirmée</h2>
    <p style="text-align: center; color: #666; font-size: 15px; line-height: 1.6;">
      Bonjour ${displayName}, votre demande de résiliation a bien été prise en compte.
    </p>
    ${infoBox(`<strong>Votre accès Premium reste actif jusqu'au ${endDate}.</strong>`, "amber")}
    <p style="color: #666; font-size: 14px; line-height: 1.6;">
      Après cette date, votre compte repassera en version gratuite. Vos données sont conservées : historique, statistiques et préférences.
    </p>
    <p style="color: #666; font-size: 14px; line-height: 1.6;">
      <strong>Note :</strong> l'accès au groupe Telegram Premium sera retiré à la fin de votre période d'abonnement.
    </p>
    <p style="color: #666; font-size: 14px; line-height: 1.6;">
      Vous pouvez vous réabonner à tout moment.
    </p>
    ${greenButton("Accéder à mon espace →", "https://pronos.club/fr/espace")}
  `, "Votre résiliation a été confirmée");

  return sendEmail(email, "Confirmation de résiliation — PRONOS.CLUB", html);
}

// ═══════════════════════════════════════════════
// 5. RELANCE J+7 — après résiliation
// ═══════════════════════════════════════════════

export async function sendWinbackDay7Email(email: string, displayName: string) {
  const html = emailWrapper(`
    <h2 style="text-align: center; color: #111; font-size: 22px; font-weight: 800; margin: 0 0 10px;">${displayName}, vos stats sont toujours là</h2>
    <p style="text-align: center; color: #666; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
      Votre espace personnel est intact — historique, statistiques et bankroll vous attendent.
    </p>
    ${infoBox(`
      Depuis votre départ, de nouveaux pronostics ont été publiés.<br>
      Revenez jeter un œil aux résultats — tout est transparent et vérifiable.
    `, "blue")}
    ${greenButton("Voir les derniers résultats →", "https://pronos.club/fr/historique")}
    <p style="text-align: center; color: #bbb; font-size: 11px;">
      Vous pouvez vous réabonner à tout moment depuis votre espace personnel.
    </p>
  `, "Vos statistiques et votre historique vous attendent");

  return sendEmail(email, `${displayName}, on ne vous oublie pas — PRONOS.CLUB`, html);
}

// ═══════════════════════════════════════════════
// 6. RELANCE J+30 — avec résultats du mois
// ═══════════════════════════════════════════════

export async function sendWinbackDay30Email(email: string, displayName: string, monthProfit: number, monthWinRate: number, monthPicks: number) {
  const profitColor = monthProfit >= 0 ? "#059669" : "#dc2626";
  const profitSign = monthProfit >= 0 ? "+" : "";

  const html = emailWrapper(`
    <h2 style="text-align: center; color: #111; font-size: 22px; font-weight: 800; margin: 0 0 10px;">Le mois dernier sur PRONOS.CLUB</h2>
    <p style="text-align: center; color: #666; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
      Bonjour ${displayName}, voici ce que vous avez manqué :
    </p>
    <div style="display: flex; justify-content: center; gap: 12px; margin: 20px 0; text-align: center;">
      <div style="background: #f0fdf4; border-radius: 12px; padding: 12px 20px; flex: 1;">
        <p style="margin: 0; font-size: 24px; font-weight: 800; color: #059669;">${monthPicks}</p>
        <p style="margin: 2px 0 0; font-size: 10px; color: #6b7280; text-transform: uppercase;">picks publiés</p>
      </div>
      <div style="background: #f0fdf4; border-radius: 12px; padding: 12px 20px; flex: 1;">
        <p style="margin: 0; font-size: 24px; font-weight: 800; color: #059669;">${monthWinRate}%</p>
        <p style="margin: 2px 0 0; font-size: 10px; color: #6b7280; text-transform: uppercase;">win rate</p>
      </div>
      <div style="background: ${monthProfit >= 0 ? "#f0fdf4" : "#fef2f2"}; border-radius: 12px; padding: 12px 20px; flex: 1;">
        <p style="margin: 0; font-size: 24px; font-weight: 800; color: ${profitColor};">${profitSign}${monthProfit}U</p>
        <p style="margin: 2px 0 0; font-size: 10px; color: #6b7280; text-transform: uppercase;">profit</p>
      </div>
    </div>
    ${greenButton("Revenir sur PRONOS.CLUB →", "https://pronos.club/fr/abonnement")}
    <p style="text-align: center; color: #bbb; font-size: 11px;">
      20€/mois · Sans engagement · Résiliable en 1 clic
    </p>
  `, `${profitSign}${monthProfit}U ce mois — voici ce que vous avez manqué`);

  return sendEmail(email, `${profitSign}${monthProfit}U ce mois sur PRONOS.CLUB — ${displayName}`, html);
}

// ═══════════════════════════════════════════════
// 7. EXPIRATION PREMIUM OFFERT — rappel J-1
// ═══════════════════════════════════════════════

export async function sendPremiumExpiringEmail(email: string, displayName: string, endDate: string) {
  const html = emailWrapper(`
    <h2 style="text-align: center; color: #111; font-size: 22px; font-weight: 800; margin: 0 0 10px;">Votre accès Premium se termine demain</h2>
    <p style="text-align: center; color: #666; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
      Bonjour ${displayName}, votre accès Premium offert expire le ${endDate}.
    </p>
    ${infoBox(`
      Après cette date :<br>
      • Vous n'aurez plus accès aux pronostics Premium<br>
      • Votre accès au groupe Telegram sera retiré<br>
      • Votre compte repassera en version gratuite<br>
      • Vos données seront conservées
    `, "amber")}
    <p style="text-align: center; color: #666; font-size: 14px; line-height: 1.6;">
      Pour continuer à profiter de tous nos pronostics, souscrivez à l'abonnement Premium.
    </p>
    ${greenButton("S'abonner — 20€/mois →", "https://pronos.club/fr/abonnement")}
  `, "Votre accès Premium expire demain");

  return sendEmail(email, "Votre accès Premium se termine demain — PRONOS.CLUB", html);
}

// ═══════════════════════════════════════════════
// 8. INACTIVITÉ — rappel si pas connecté depuis 15j
// ═══════════════════════════════════════════════

export async function sendInactivityEmail(email: string, displayName: string) {
  const html = emailWrapper(`
    <h2 style="text-align: center; color: #111; font-size: 22px; font-weight: 800; margin: 0 0 10px;">${displayName}, tout va bien ?</h2>
    <p style="text-align: center; color: #666; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
      Cela fait un moment que vous ne vous êtes pas connecté. De nouveaux pronostics vous attendent !
    </p>
    ${infoBox(`
      <strong>Pensez à :</strong><br>
      • Activer les notifications push ou email<br>
      • Installer l'application sur votre téléphone<br>
      • Configurer votre bankroll pour un suivi personnalisé
    `, "blue")}
    ${greenButton("Revenir sur PRONOS.CLUB →", "https://pronos.club/fr/pronostics")}
    <p style="text-align: center; color: #bbb; font-size: 11px;">
      Pour ne plus recevoir ces rappels, désactivez les emails dans vos notifications.
    </p>
  `, "De nouveaux pronostics vous attendent sur PRONOS.CLUB");

  return sendEmail(email, `${displayName}, de nouveaux pronos vous attendent — PRONOS.CLUB`, html);
}

// ═══════════════════════════════════════════════
// 9. BILAN MENSUEL — (appelé depuis admin/bilans)
// ═══════════════════════════════════════════════

export async function sendBilanEmail(
  email: string,
  displayName: string,
  month: string,
  slug: string,
  stats: { totalPicks: number; winRate: number; roi: number; profit: number }
) {
  const profitColor = stats.profit >= 0 ? "#059669" : "#dc2626";
  const roiColor = stats.roi >= 0 ? "#059669" : "#dc2626";

  const html = emailWrapper(`
    <h2 style="text-align: center; color: #111; font-size: 22px; font-weight: 800; margin: 0 0 10px;">Bilan ${month}</h2>
    <p style="text-align: center; color: #666; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
      Bonjour ${displayName}, le bilan du mois est disponible !
    </p>
    <div style="display: flex; justify-content: center; gap: 12px; margin: 20px 0; text-align: center;">
      <div style="background: #f0fdf4; border-radius: 12px; padding: 12px 16px; flex: 1;">
        <p style="margin: 0; font-size: 20px; font-weight: 800; color: #059669;">${stats.totalPicks}</p>
        <p style="margin: 2px 0 0; font-size: 10px; color: #6b7280; text-transform: uppercase;">picks</p>
      </div>
      <div style="background: #f0fdf4; border-radius: 12px; padding: 12px 16px; flex: 1;">
        <p style="margin: 0; font-size: 20px; font-weight: 800; color: #059669;">${stats.winRate}%</p>
        <p style="margin: 2px 0 0; font-size: 10px; color: #6b7280; text-transform: uppercase;">win rate</p>
      </div>
      <div style="background: ${stats.roi >= 0 ? "#f0fdf4" : "#fef2f2"}; border-radius: 12px; padding: 12px 16px; flex: 1;">
        <p style="margin: 0; font-size: 20px; font-weight: 800; color: ${roiColor};">${stats.roi >= 0 ? "+" : ""}${stats.roi}%</p>
        <p style="margin: 2px 0 0; font-size: 10px; color: #6b7280; text-transform: uppercase;">roi</p>
      </div>
      <div style="background: ${stats.profit >= 0 ? "#f0fdf4" : "#fef2f2"}; border-radius: 12px; padding: 12px 16px; flex: 1;">
        <p style="margin: 0; font-size: 20px; font-weight: 800; color: ${profitColor};">${stats.profit >= 0 ? "+" : ""}${stats.profit}U</p>
        <p style="margin: 2px 0 0; font-size: 10px; color: #6b7280; text-transform: uppercase;">profit</p>
      </div>
    </div>
    ${greenButton("Lire le bilan complet →", `https://pronos.club/fr/bilans/${slug}`)}
  `, `Bilan ${month} disponible — PRONOS.CLUB`);

  return sendEmail(email, `Bilan ${month} publié — PRONOS.CLUB`, html);
}