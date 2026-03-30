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
// I18N — all email texts by locale
// ═══════════════════════════════════════════════

type Locale = "fr" | "en" | "es";

const T: Record<Locale, Record<string, string>> = {
  fr: {
    footer_brand: "PRONOS.CLUB — Pronostics sportifs professionnels",
    footer_warning: "Les paris sportifs comportent des risques. Jouez responsablement. 18+",
    // 1. Welcome
    welcome_subject: "Bienvenue sur PRONOS.CLUB",
    welcome_preheader: "Bienvenue sur PRONOS.CLUB — Votre compte est créé",
    welcome_title: "Bienvenue {name} !",
    welcome_intro: "Votre compte PRONOS.CLUB est créé. Vous avez accès aux pronostics gratuits, aux statistiques et à l'historique complet.",
    welcome_features: "<strong>Ce qui vous attend :</strong><br>• Des pronostics sportifs publiés chaque jour<br>• Un historique transparent et vérifiable<br>• Des statistiques détaillées en temps réel<br>• Un outil de gestion de bankroll personnalisé",
    welcome_cta_label: "Première chose à faire :",
    welcome_cta_text: "activez les notifications pour être prévenu à chaque nouveau pronostic.",
    welcome_btn: "Accéder à mon espace →",
    welcome_footer: "Pensez à installer l'application sur votre téléphone pour une expérience optimale.",
    // 2. Welcome Premium
    premium_subject: "Bienvenue en Premium — PRONOS.CLUB",
    premium_preheader: "Votre abonnement Premium est activé — Bienvenue !",
    premium_title: "Bienvenue en Premium, {name} !",
    premium_intro: "Merci pour votre confiance. Vous avez désormais accès à l'intégralité de nos pronostics.",
    premium_features: "<strong>Votre abonnement Premium inclut :</strong><br>• Tous les pronostics (50+/mois)<br>• Groupe Telegram exclusif<br>• Notifications prioritaires<br>• Bilan mensuel par email<br>• Résiliable en 1 clic, sans engagement",
    premium_tg_title: "Groupe Telegram exclusif",
    premium_tg_desc: "Échangez avec les autres membres Premium et le tipster",
    premium_tg_btn: "Rejoindre le groupe Telegram →",
    premium_tg_expire: "Lien personnel et à usage unique — expire dans 48h",
    premium_btn: "Voir les pronostics →",
    premium_tg_note: "L'accès au groupe Telegram est lié à votre abonnement.<br>En cas de résiliation, vous serez automatiquement retiré du groupe.",
    // 3. New pick
    pick_subject: "Nouveau pronostic disponible{sport} — PRONOS.CLUB",
    pick_preheader: "Nouveau pronostic{sport} disponible sur PRONOS.CLUB",
    pick_title: "Nouveau pronostic publié",
    pick_premium: "Pronostic Premium",
    pick_free: "Pronostic gratuit",
    pick_desc: "Connectez-vous pour consulter la sélection et le ticket du tipster.",
    pick_btn: "Voir le pronostic →",
    pick_footer: "Pour modifier vos préférences de notification, rendez-vous dans votre espace personnel.",
    // 4. Cancellation
    cancel_subject: "Confirmation de résiliation — PRONOS.CLUB",
    cancel_preheader: "Votre résiliation a été confirmée",
    cancel_title: "Résiliation confirmée",
    cancel_intro: "Bonjour {name}, votre demande de résiliation a bien été prise en compte.",
    cancel_active: "<strong>Votre accès Premium reste actif jusqu'au {date}.</strong>",
    cancel_after: "Après cette date, votre compte repassera en version gratuite. Vos données sont conservées : historique, statistiques et préférences.",
    cancel_tg: "<strong>Note :</strong> l'accès au groupe Telegram Premium sera retiré à la fin de votre période d'abonnement.",
    cancel_reabo: "Vous pouvez vous réabonner à tout moment.",
    cancel_btn: "Accéder à mon espace →",
    // 5. Winback J+7
    wb7_subject: "{name}, on ne vous oublie pas — PRONOS.CLUB",
    wb7_preheader: "Vos statistiques et votre historique vous attendent",
    wb7_title: "{name}, vos stats sont toujours là",
    wb7_intro: "Votre espace personnel est intact — historique, statistiques et bankroll vous attendent.",
    wb7_info: "Depuis votre départ, de nouveaux pronostics ont été publiés.<br>Revenez jeter un œil aux résultats — tout est transparent et vérifiable.",
    wb7_btn: "Voir les derniers résultats →",
    wb7_footer: "Vous pouvez vous réabonner à tout moment depuis votre espace personnel.",
    // 6. Winback J+30
    wb30_subject: "{profit}U ce mois sur PRONOS.CLUB — {name}",
    wb30_preheader: "{profit}U ce mois — voici ce que vous avez manqué",
    wb30_title: "Le mois dernier sur PRONOS.CLUB",
    wb30_intro: "Bonjour {name}, voici ce que vous avez manqué :",
    wb30_picks: "picks publiés",
    wb30_btn: "Revenir sur PRONOS.CLUB →",
    wb30_footer: "20€/mois · Sans engagement · Résiliable en 1 clic",
    // 7. Premium expiring
    expire_subject: "Votre accès Premium se termine demain — PRONOS.CLUB",
    expire_preheader: "Votre accès Premium expire demain",
    expire_title: "Votre accès Premium se termine demain",
    expire_intro: "Bonjour {name}, votre accès Premium offert expire le {date}.",
    expire_after: "Après cette date :<br>• Vous n'aurez plus accès aux pronostics Premium<br>• Votre accès au groupe Telegram sera retiré<br>• Votre compte repassera en version gratuite<br>• Vos données seront conservées",
    expire_cta: "Pour continuer à profiter de tous nos pronostics, souscrivez à l'abonnement Premium.",
    expire_btn: "S'abonner — 20€/mois →",
    // 8. Inactivity
    inactive_subject: "{name}, de nouveaux pronos vous attendent — PRONOS.CLUB",
    inactive_preheader: "De nouveaux pronostics vous attendent sur PRONOS.CLUB",
    inactive_title: "{name}, tout va bien ?",
    inactive_intro: "Cela fait un moment que vous ne vous êtes pas connecté. De nouveaux pronostics vous attendent !",
    inactive_info: "<strong>Pensez à :</strong><br>• Activer les notifications push ou email<br>• Installer l'application sur votre téléphone<br>• Configurer votre bankroll pour un suivi personnalisé",
    inactive_btn: "Revenir sur PRONOS.CLUB →",
    inactive_footer: "Pour ne plus recevoir ces rappels, désactivez les emails dans vos notifications.",
    // 9. Bilan
    bilan_subject: "Bilan {month} publié — PRONOS.CLUB",
    bilan_preheader: "Bilan {month} disponible — PRONOS.CLUB",
    bilan_title: "Bilan {month}",
    bilan_intro: "Bonjour {name}, le bilan du mois est disponible !",
    bilan_btn: "Lire le bilan complet →",
  },
  en: {
    footer_brand: "PRONOS.CLUB — Professional sports predictions",
    footer_warning: "Sports betting involves risks. Gamble responsibly. 18+",
    welcome_subject: "Welcome to PRONOS.CLUB",
    welcome_preheader: "Welcome to PRONOS.CLUB — Your account is created",
    welcome_title: "Welcome {name}!",
    welcome_intro: "Your PRONOS.CLUB account is created. You have access to free predictions, statistics and full history.",
    welcome_features: "<strong>What awaits you:</strong><br>• Sports predictions published daily<br>• Transparent and verifiable history<br>• Detailed real-time statistics<br>• A personalized bankroll management tool",
    welcome_cta_label: "First thing to do:",
    welcome_cta_text: "enable notifications to be alerted for each new prediction.",
    welcome_btn: "Access my space →",
    welcome_footer: "Consider installing the app on your phone for an optimal experience.",
    premium_subject: "Welcome to Premium — PRONOS.CLUB",
    premium_preheader: "Your Premium subscription is activated — Welcome!",
    premium_title: "Welcome to Premium, {name}!",
    premium_intro: "Thank you for your trust. You now have access to all our predictions.",
    premium_features: "<strong>Your Premium subscription includes:</strong><br>• All predictions (50+/month)<br>• Exclusive Telegram group<br>• Priority notifications<br>• Monthly report by email<br>• Cancel in 1 click, no commitment",
    premium_tg_title: "Exclusive Telegram group",
    premium_tg_desc: "Chat with other Premium members and the tipster",
    premium_tg_btn: "Join the Telegram group →",
    premium_tg_expire: "Personal single-use link — expires in 48h",
    premium_btn: "View predictions →",
    premium_tg_note: "Telegram group access is linked to your subscription.<br>If you cancel, you will be automatically removed from the group.",
    pick_subject: "New prediction available{sport} — PRONOS.CLUB",
    pick_preheader: "New prediction{sport} available on PRONOS.CLUB",
    pick_title: "New prediction published",
    pick_premium: "Premium prediction",
    pick_free: "Free prediction",
    pick_desc: "Log in to view the tipster's selection and ticket.",
    pick_btn: "View the prediction →",
    pick_footer: "To change your notification preferences, go to your personal space.",
    cancel_subject: "Cancellation confirmed — PRONOS.CLUB",
    cancel_preheader: "Your cancellation has been confirmed",
    cancel_title: "Cancellation confirmed",
    cancel_intro: "Hello {name}, your cancellation request has been processed.",
    cancel_active: "<strong>Your Premium access remains active until {date}.</strong>",
    cancel_after: "After this date, your account will revert to the free version. Your data is preserved: history, statistics and preferences.",
    cancel_tg: "<strong>Note:</strong> access to the Premium Telegram group will be removed at the end of your subscription period.",
    cancel_reabo: "You can resubscribe at any time.",
    cancel_btn: "Access my space →",
    wb7_subject: "{name}, we haven't forgotten you — PRONOS.CLUB",
    wb7_preheader: "Your statistics and history are waiting for you",
    wb7_title: "{name}, your stats are still there",
    wb7_intro: "Your personal space is intact — history, statistics and bankroll are waiting.",
    wb7_info: "Since you left, new predictions have been published.<br>Come back and check the results — everything is transparent and verifiable.",
    wb7_btn: "View latest results →",
    wb7_footer: "You can resubscribe at any time from your personal space.",
    wb30_subject: "{profit}U this month on PRONOS.CLUB — {name}",
    wb30_preheader: "{profit}U this month — here's what you missed",
    wb30_title: "Last month on PRONOS.CLUB",
    wb30_intro: "Hello {name}, here's what you missed:",
    wb30_picks: "picks published",
    wb30_btn: "Come back to PRONOS.CLUB →",
    wb30_footer: "€20/month · No commitment · Cancel in 1 click",
    expire_subject: "Your Premium access ends tomorrow — PRONOS.CLUB",
    expire_preheader: "Your Premium access expires tomorrow",
    expire_title: "Your Premium access ends tomorrow",
    expire_intro: "Hello {name}, your complimentary Premium access expires on {date}.",
    expire_after: "After this date:<br>• You will no longer have access to Premium predictions<br>• Your Telegram group access will be removed<br>• Your account will revert to the free version<br>• Your data will be preserved",
    expire_cta: "To continue enjoying all our predictions, subscribe to the Premium plan.",
    expire_btn: "Subscribe — €20/month →",
    inactive_subject: "{name}, new predictions await — PRONOS.CLUB",
    inactive_preheader: "New predictions are waiting for you on PRONOS.CLUB",
    inactive_title: "{name}, is everything okay?",
    inactive_intro: "It's been a while since you last logged in. New predictions are waiting!",
    inactive_info: "<strong>Remember to:</strong><br>• Enable push or email notifications<br>• Install the app on your phone<br>• Set up your bankroll for personalized tracking",
    inactive_btn: "Come back to PRONOS.CLUB →",
    inactive_footer: "To stop receiving these reminders, disable emails in your notifications.",
    bilan_subject: "{month} report published — PRONOS.CLUB",
    bilan_preheader: "{month} report available — PRONOS.CLUB",
    bilan_title: "{month} Report",
    bilan_intro: "Hello {name}, the monthly report is available!",
    bilan_btn: "Read the full report →",
  },
  es: {
    footer_brand: "PRONOS.CLUB — Pronósticos deportivos profesionales",
    footer_warning: "Las apuestas deportivas conllevan riesgos. Juega con responsabilidad. 18+",
    welcome_subject: "Bienvenido a PRONOS.CLUB",
    welcome_preheader: "Bienvenido a PRONOS.CLUB — Tu cuenta está creada",
    welcome_title: "¡Bienvenido {name}!",
    welcome_intro: "Tu cuenta PRONOS.CLUB está creada. Tienes acceso a los pronósticos gratuitos, estadísticas e historial completo.",
    welcome_features: "<strong>Lo que te espera:</strong><br>• Pronósticos deportivos publicados cada día<br>• Historial transparente y verificable<br>• Estadísticas detalladas en tiempo real<br>• Herramienta personalizada de gestión de bankroll",
    welcome_cta_label: "Lo primero que debes hacer:",
    welcome_cta_text: "activa las notificaciones para recibir alertas con cada nuevo pronóstico.",
    welcome_btn: "Acceder a mi espacio →",
    welcome_footer: "Considera instalar la app en tu teléfono para una experiencia óptima.",
    premium_subject: "Bienvenido a Premium — PRONOS.CLUB",
    premium_preheader: "Tu suscripción Premium está activada — ¡Bienvenido!",
    premium_title: "¡Bienvenido a Premium, {name}!",
    premium_intro: "Gracias por tu confianza. Ahora tienes acceso a todos nuestros pronósticos.",
    premium_features: "<strong>Tu suscripción Premium incluye:</strong><br>• Todos los pronósticos (50+/mes)<br>• Grupo Telegram exclusivo<br>• Notificaciones prioritarias<br>• Informe mensual por email<br>• Cancelable en 1 clic, sin compromiso",
    premium_tg_title: "Grupo Telegram exclusivo",
    premium_tg_desc: "Chatea con otros miembros Premium y el tipster",
    premium_tg_btn: "Unirse al grupo Telegram →",
    premium_tg_expire: "Enlace personal de un solo uso — expira en 48h",
    premium_btn: "Ver pronósticos →",
    premium_tg_note: "El acceso al grupo Telegram está vinculado a tu suscripción.<br>Si cancelas, serás retirado automáticamente del grupo.",
    pick_subject: "Nuevo pronóstico disponible{sport} — PRONOS.CLUB",
    pick_preheader: "Nuevo pronóstico{sport} disponible en PRONOS.CLUB",
    pick_title: "Nuevo pronóstico publicado",
    pick_premium: "Pronóstico Premium",
    pick_free: "Pronóstico gratuito",
    pick_desc: "Conéctate para consultar la selección y el ticket del tipster.",
    pick_btn: "Ver el pronóstico →",
    pick_footer: "Para modificar tus preferencias de notificación, ve a tu espacio personal.",
    cancel_subject: "Confirmación de cancelación — PRONOS.CLUB",
    cancel_preheader: "Tu cancelación ha sido confirmada",
    cancel_title: "Cancelación confirmada",
    cancel_intro: "Hola {name}, tu solicitud de cancelación ha sido procesada.",
    cancel_active: "<strong>Tu acceso Premium permanece activo hasta el {date}.</strong>",
    cancel_after: "Después de esta fecha, tu cuenta volverá a la versión gratuita. Tus datos se conservan: historial, estadísticas y preferencias.",
    cancel_tg: "<strong>Nota:</strong> el acceso al grupo Telegram Premium será retirado al final de tu período de suscripción.",
    cancel_reabo: "Puedes volver a suscribirte en cualquier momento.",
    cancel_btn: "Acceder a mi espacio →",
    wb7_subject: "{name}, no te olvidamos — PRONOS.CLUB",
    wb7_preheader: "Tus estadísticas e historial te esperan",
    wb7_title: "{name}, tus stats siguen ahí",
    wb7_intro: "Tu espacio personal está intacto — historial, estadísticas y bankroll te esperan.",
    wb7_info: "Desde que te fuiste, se han publicado nuevos pronósticos.<br>Vuelve a ver los resultados — todo es transparente y verificable.",
    wb7_btn: "Ver últimos resultados →",
    wb7_footer: "Puedes volver a suscribirte en cualquier momento desde tu espacio personal.",
    wb30_subject: "{profit}U este mes en PRONOS.CLUB — {name}",
    wb30_preheader: "{profit}U este mes — esto es lo que te perdiste",
    wb30_title: "El mes pasado en PRONOS.CLUB",
    wb30_intro: "Hola {name}, esto es lo que te perdiste:",
    wb30_picks: "picks publicados",
    wb30_btn: "Volver a PRONOS.CLUB →",
    wb30_footer: "20€/mes · Sin compromiso · Cancelable en 1 clic",
    expire_subject: "Tu acceso Premium termina mañana — PRONOS.CLUB",
    expire_preheader: "Tu acceso Premium expira mañana",
    expire_title: "Tu acceso Premium termina mañana",
    expire_intro: "Hola {name}, tu acceso Premium gratuito expira el {date}.",
    expire_after: "Después de esta fecha:<br>• No tendrás acceso a los pronósticos Premium<br>• Tu acceso al grupo Telegram será retirado<br>• Tu cuenta volverá a la versión gratuita<br>• Tus datos se conservarán",
    expire_cta: "Para seguir disfrutando de todos nuestros pronósticos, suscríbete al plan Premium.",
    expire_btn: "Suscribirse — 20€/mes →",
    inactive_subject: "{name}, nuevos pronos te esperan — PRONOS.CLUB",
    inactive_preheader: "Nuevos pronósticos te esperan en PRONOS.CLUB",
    inactive_title: "{name}, ¿todo bien?",
    inactive_intro: "Hace tiempo que no te conectas. ¡Nuevos pronósticos te esperan!",
    inactive_info: "<strong>Recuerda:</strong><br>• Activar las notificaciones push o email<br>• Instalar la app en tu teléfono<br>• Configurar tu bankroll para un seguimiento personalizado",
    inactive_btn: "Volver a PRONOS.CLUB →",
    inactive_footer: "Para dejar de recibir estos recordatorios, desactiva los emails en tus notificaciones.",
    bilan_subject: "Informe {month} publicado — PRONOS.CLUB",
    bilan_preheader: "Informe {month} disponible — PRONOS.CLUB",
    bilan_title: "Informe {month}",
    bilan_intro: "Hola {name}, ¡el informe mensual está disponible!",
    bilan_btn: "Leer el informe completo →",
  },
};

function t(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  let text = T[locale]?.[key] || T.fr[key] || key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}

function localeUrl(locale: Locale, path: string): string {
  return `https://pronos.club/${locale}/${path}`;
}

// ═══════════════════════════════════════════════
// DESIGN SYSTEM
// ═══════════════════════════════════════════════

function emailWrapper(content: string, preheader: string, locale: Locale) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; background-color: #f5f5f5;">
      <div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#f5f5f5;">${preheader}</div>
      <div style="text-align: center; padding: 40px 20px 30px; background: linear-gradient(135deg, #0a0a0a, #062e1f); border-radius: 0 0 16px 16px;">
        <img src="https://pronos.club/pronos_club.png" alt="PRONOS.CLUB" width="120" height="120" style="width: 120px; height: 120px; object-fit: contain;" />
      </div>
      <div style="padding: 40px 30px; background-color: #ffffff;">${content}</div>
      <div style="text-align: center; padding: 20px;">
        <p style="font-size: 11px; color: #9ca3af; margin: 0;">${t(locale, "footer_brand")}</p>
        <p style="font-size: 10px; color: #d1d5db; margin: 4px 0 0;">${t(locale, "footer_warning")}</p>
      </div>
    </div>
  `;
}

function greenButton(text: string, href: string) {
  return `<div style="text-align: center; margin: 30px 0;"><a href="${href}" style="display: inline-block; background: linear-gradient(135deg, #059669, #10b981); color: #ffffff; padding: 16px 40px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 16px; box-shadow: 0 4px 14px rgba(16,185,129,0.3);">${text}</a></div>`;
}

function infoBox(content: string, color: "green" | "amber" | "blue" = "green") {
  const colors = { green: { bg: "#f0fdf4", border: "#bbf7d0", text: "#166534" }, amber: { bg: "#fffbeb", border: "#fde68a", text: "#92400e" }, blue: { bg: "#eff6ff", border: "#bfdbfe", text: "#1e40af" } };
  const c = colors[color];
  return `<div style="background: ${c.bg}; border: 1px solid ${c.border}; border-radius: 12px; padding: 16px 20px; margin: 20px 0;"><p style="margin: 0; font-size: 13px; color: ${c.text}; line-height: 1.6;">${content}</p></div>`;
}

async function sendEmail(to: string, subject: string, html: string) {
  try {
    await transporter.sendMail({ from: '"PRONOS.CLUB" <noreply@pronos.club>', replyTo: '"PRONOS.CLUB" <contact@pronos.club>', to, subject, html });
    return true;
  } catch (err) {
    console.error("Email send error:", err);
    return false;
  }
}

// ═══════════════════════════════════════════════
// 1. BIENVENUE
// ═══════════════════════════════════════════════

export async function sendWelcomeEmail(email: string, displayName: string, locale: Locale = "fr") {
  const html = emailWrapper(`
    <h2 style="text-align: center; color: #111; font-size: 22px; font-weight: 800; margin: 0 0 10px;">${t(locale, "welcome_title", { name: displayName })}</h2>
    <p style="text-align: center; color: #666; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">${t(locale, "welcome_intro")}</p>
    ${infoBox(t(locale, "welcome_features"))}
    <p style="text-align: center; color: #666; font-size: 14px; line-height: 1.6;"><strong>${t(locale, "welcome_cta_label")}</strong> ${t(locale, "welcome_cta_text")}</p>
    ${greenButton(t(locale, "welcome_btn"), localeUrl(locale, "espace"))}
    <p style="text-align: center; color: #999; font-size: 12px;">${t(locale, "welcome_footer")}</p>
  `, t(locale, "welcome_preheader"), locale);
  return sendEmail(email, t(locale, "welcome_subject"), html);
}

// ═══════════════════════════════════════════════
// 2. BIENVENUE PREMIUM
// ═══════════════════════════════════════════════

export async function sendWelcomePremiumEmail(email: string, displayName: string, locale: Locale = "fr", telegramLink?: string | null) {
  const telegramBlock = telegramLink ? `
    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center;">
      <p style="margin: 0 0 8px; font-size: 13px; color: #166534; font-weight: 600;">${t(locale, "premium_tg_title")}</p>
      <p style="margin: 0 0 12px; font-size: 12px; color: #15803d;">${t(locale, "premium_tg_desc")}</p>
      <a href="${telegramLink}" style="display: inline-block; background: #2AABEE; color: #fff; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 13px;">${t(locale, "premium_tg_btn")}</a>
      <p style="margin: 8px 0 0; font-size: 10px; color: #6b7280;">${t(locale, "premium_tg_expire")}</p>
    </div>
  ` : "";

  const html = emailWrapper(`
    <h2 style="text-align: center; color: #111; font-size: 22px; font-weight: 800; margin: 0 0 10px;">${t(locale, "premium_title", { name: displayName })}</h2>
    <p style="text-align: center; color: #666; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">${t(locale, "premium_intro")}</p>
    ${infoBox(t(locale, "premium_features"))}
    ${telegramBlock}
    ${greenButton(t(locale, "premium_btn"), localeUrl(locale, "pronostics"))}
    <div style="background: #f8faf9; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; margin: 20px 0; text-align: center;">
      <p style="margin: 0; font-size: 12px; color: #6b7280; line-height: 1.5;">${t(locale, "premium_tg_note")}</p>
    </div>
  `, t(locale, "premium_preheader"), locale);
  return sendEmail(email, t(locale, "premium_subject"), html);
}

// ═══════════════════════════════════════════════
// 3. NOUVEAU PICK
// ═══════════════════════════════════════════════

export async function sendNewPickEmail(email: string, locale: Locale = "fr", sport?: string, isPremium?: boolean) {
  const accessLabel = isPremium ? t(locale, "pick_premium") : t(locale, "pick_free");
  const sportLabel = sport ? ` — ${sport}` : "";

  const html = emailWrapper(`
    <h2 style="text-align: center; color: #111; font-size: 22px; font-weight: 800; margin: 0 0 10px;">${t(locale, "pick_title")}</h2>
    <p style="text-align: center; color: #666; font-size: 15px; line-height: 1.6; margin: 0 0 4px;">${accessLabel}${sportLabel}</p>
    <p style="text-align: center; color: #999; font-size: 13px;">${t(locale, "pick_desc")}</p>
    ${greenButton(t(locale, "pick_btn"), localeUrl(locale, "pronostics"))}
    <p style="text-align: center; color: #bbb; font-size: 11px;">${t(locale, "pick_footer")}</p>
  `, t(locale, "pick_preheader", { sport: sportLabel }), locale);
  return sendEmail(email, t(locale, "pick_subject", { sport: sportLabel }), html);
}

// ═══════════════════════════════════════════════
// 4. RÉSILIATION
// ═══════════════════════════════════════════════

export async function sendCancellationEmail(email: string, displayName: string, endDate: string, locale: Locale = "fr") {
  const html = emailWrapper(`
    <h2 style="text-align: center; color: #111; font-size: 22px; font-weight: 800; margin: 0 0 10px;">${t(locale, "cancel_title")}</h2>
    <p style="text-align: center; color: #666; font-size: 15px; line-height: 1.6;">${t(locale, "cancel_intro", { name: displayName })}</p>
    ${infoBox(t(locale, "cancel_active", { date: endDate }), "amber")}
    <p style="color: #666; font-size: 14px; line-height: 1.6;">${t(locale, "cancel_after")}</p>
    <p style="color: #666; font-size: 14px; line-height: 1.6;">${t(locale, "cancel_tg")}</p>
    <p style="color: #666; font-size: 14px; line-height: 1.6;">${t(locale, "cancel_reabo")}</p>
    ${greenButton(t(locale, "cancel_btn"), localeUrl(locale, "espace"))}
  `, t(locale, "cancel_preheader"), locale);
  return sendEmail(email, t(locale, "cancel_subject"), html);
}

// ═══════════════════════════════════════════════
// 5. RELANCE J+7
// ═══════════════════════════════════════════════

export async function sendWinbackDay7Email(email: string, displayName: string, locale: Locale = "fr") {
  const html = emailWrapper(`
    <h2 style="text-align: center; color: #111; font-size: 22px; font-weight: 800; margin: 0 0 10px;">${t(locale, "wb7_title", { name: displayName })}</h2>
    <p style="text-align: center; color: #666; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">${t(locale, "wb7_intro")}</p>
    ${infoBox(t(locale, "wb7_info"), "blue")}
    ${greenButton(t(locale, "wb7_btn"), localeUrl(locale, "historique"))}
    <p style="text-align: center; color: #bbb; font-size: 11px;">${t(locale, "wb7_footer")}</p>
  `, t(locale, "wb7_preheader"), locale);
  return sendEmail(email, t(locale, "wb7_subject", { name: displayName }), html);
}

// ═══════════════════════════════════════════════
// 6. RELANCE J+30
// ═══════════════════════════════════════════════

export async function sendWinbackDay30Email(email: string, displayName: string, locale: Locale = "fr", monthProfit: number, monthWinRate: number, monthPicks: number) {
  const profitColor = monthProfit >= 0 ? "#059669" : "#dc2626";
  const profitSign = monthProfit >= 0 ? "+" : "";

  const html = emailWrapper(`
    <h2 style="text-align: center; color: #111; font-size: 22px; font-weight: 800; margin: 0 0 10px;">${t(locale, "wb30_title")}</h2>
    <p style="text-align: center; color: #666; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">${t(locale, "wb30_intro", { name: displayName })}</p>
    <div style="display: flex; justify-content: center; gap: 12px; margin: 20px 0; text-align: center;">
      <div style="background: #f0fdf4; border-radius: 12px; padding: 12px 20px; flex: 1;">
        <p style="margin: 0; font-size: 24px; font-weight: 800; color: #059669;">${monthPicks}</p>
        <p style="margin: 2px 0 0; font-size: 10px; color: #6b7280; text-transform: uppercase;">${t(locale, "wb30_picks")}</p>
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
    ${greenButton(t(locale, "wb30_btn"), localeUrl(locale, "abonnement"))}
    <p style="text-align: center; color: #bbb; font-size: 11px;">${t(locale, "wb30_footer")}</p>
  `, t(locale, "wb30_preheader", { profit: `${profitSign}${monthProfit}` }), locale);
  return sendEmail(email, t(locale, "wb30_subject", { profit: `${profitSign}${monthProfit}`, name: displayName }), html);
}

// ═══════════════════════════════════════════════
// 7. EXPIRATION PREMIUM
// ═══════════════════════════════════════════════

export async function sendPremiumExpiringEmail(email: string, displayName: string, endDate: string, locale: Locale = "fr") {
  const html = emailWrapper(`
    <h2 style="text-align: center; color: #111; font-size: 22px; font-weight: 800; margin: 0 0 10px;">${t(locale, "expire_title")}</h2>
    <p style="text-align: center; color: #666; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">${t(locale, "expire_intro", { name: displayName, date: endDate })}</p>
    ${infoBox(t(locale, "expire_after"), "amber")}
    <p style="text-align: center; color: #666; font-size: 14px; line-height: 1.6;">${t(locale, "expire_cta")}</p>
    ${greenButton(t(locale, "expire_btn"), localeUrl(locale, "abonnement"))}
  `, t(locale, "expire_preheader"), locale);
  return sendEmail(email, t(locale, "expire_subject"), html);
}

// ═══════════════════════════════════════════════
// 8. INACTIVITÉ
// ═══════════════════════════════════════════════

export async function sendInactivityEmail(email: string, displayName: string, locale: Locale = "fr") {
  const html = emailWrapper(`
    <h2 style="text-align: center; color: #111; font-size: 22px; font-weight: 800; margin: 0 0 10px;">${t(locale, "inactive_title", { name: displayName })}</h2>
    <p style="text-align: center; color: #666; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">${t(locale, "inactive_intro")}</p>
    ${infoBox(t(locale, "inactive_info"), "blue")}
    ${greenButton(t(locale, "inactive_btn"), localeUrl(locale, "pronostics"))}
    <p style="text-align: center; color: #bbb; font-size: 11px;">${t(locale, "inactive_footer")}</p>
  `, t(locale, "inactive_preheader"), locale);
  return sendEmail(email, t(locale, "inactive_subject", { name: displayName }), html);
}

// ═══════════════════════════════════════════════
// 9. BILAN MENSUEL
// ═══════════════════════════════════════════════

export async function sendBilanEmail(email: string, displayName: string, locale: Locale = "fr", month: string, slug: string, stats: { totalPicks: number; winRate: number; roi: number; profit: number }) {
  const profitColor = stats.profit >= 0 ? "#059669" : "#dc2626";
  const roiColor = stats.roi >= 0 ? "#059669" : "#dc2626";

  const html = emailWrapper(`
    <h2 style="text-align: center; color: #111; font-size: 22px; font-weight: 800; margin: 0 0 10px;">${t(locale, "bilan_title", { month })}</h2>
    <p style="text-align: center; color: #666; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">${t(locale, "bilan_intro", { name: displayName })}</p>
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
    ${greenButton(t(locale, "bilan_btn"), `https://pronos.club/${locale}/bilans/${slug}`)}
  `, t(locale, "bilan_preheader", { month }), locale);
  return sendEmail(email, t(locale, "bilan_subject", { month }), html);
}