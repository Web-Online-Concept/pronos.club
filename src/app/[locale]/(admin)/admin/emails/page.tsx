"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface EmailLog {
  id: string;
  channel: string;
  title: string;
  recipients_count: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

const AUTOMATED_EMAILS = [
  {
    id: "welcome",
    name: "Bienvenue",
    trigger: "Première inscription",
    recipient: "Tout nouvel utilisateur",
    timing: "Immédiat",
    description: "Email de bienvenue après la création du compte. Présente le site, les fonctionnalités gratuites et invite à activer les notifications.",
    file: "src/lib/emails.ts → sendWelcomeEmail()",
    route: "src/app/api/auth/callback/route.ts",
    color: "#10b981",
    icon: "👋",
  },
  {
    id: "welcome-premium",
    name: "Bienvenue Premium",
    trigger: "Passage en Premium (Stripe ou admin)",
    recipient: "Nouvel abonné Premium",
    timing: "Immédiat",
    description: "Email de bienvenue Premium avec récapitulatif des fonctionnalités débloquées et lien d'invitation Telegram (unique, usage unique, expire 48h).",
    file: "src/lib/emails.ts → sendWelcomePremiumEmail()",
    route: "src/lib/telegram-hooks.ts → onPremiumActivated()",
    color: "#f59e0b",
    icon: "⭐",
  },
  {
    id: "new-pick",
    name: "Nouveau pronostic",
    trigger: "Publication d'un pick (admin)",
    recipient: "Users avec notify_email = true (premium si pick premium)",
    timing: "Immédiat à la publication",
    description: "Notification email à chaque nouveau pronostic publié. Indique le sport et le type (gratuit/premium). Lien vers la page pronostics.",
    file: "src/lib/emails.ts → sendNewPickEmail()",
    route: "src/app/api/notifications/send/route.ts",
    color: "#3b82f6",
    icon: "🔔",
  },
  {
    id: "bilan",
    name: "Bilan mensuel",
    trigger: "Publication d'un bilan (admin → Publier)",
    recipient: "Abonnés Premium avec notify_bilan = true",
    timing: "À la publication du bilan",
    description: "Résumé du mois avec statistiques (picks, win rate, ROI, profit) et lien vers le bilan complet. L'utilisateur peut désactiver dans ses notifications.",
    file: "src/lib/emails.ts → sendBilanEmail()",
    route: "src/app/api/admin/bilans/route.ts → PUT (publish)",
    color: "#06b6d4",
    icon: "📊",
  },
  {
    id: "cancellation",
    name: "Confirmation résiliation",
    trigger: "Résiliation de l'abonnement",
    recipient: "Abonné qui résilie",
    timing: "Immédiat",
    description: "Confirme la résiliation avec la date de fin d'accès Premium. Rappelle que l'accès Telegram sera retiré et que les données sont conservées.",
    file: "src/lib/emails.ts → sendCancellationEmail()",
    route: "src/app/api/stripe/cancel/route.ts",
    color: "#ef4444",
    icon: "👋",
  },
  {
    id: "winback-7",
    name: "Relance J+7",
    trigger: "CRON quotidien — 7 jours après résiliation",
    recipient: "Ex-abonnés avec notify_email = true",
    timing: "Automatique (cron)",
    description: "\"Vos stats sont toujours là\" — rappelle que l'espace personnel est intact, que de nouveaux pronos ont été publiés. Ton doux, pas agressif.",
    file: "src/lib/emails.ts → sendWinbackDay7Email()",
    route: "src/app/api/cron/emails/route.ts",
    color: "#a78bfa",
    icon: "💌",
  },
  {
    id: "winback-30",
    name: "Relance J+30",
    trigger: "CRON quotidien — 30 jours après résiliation",
    recipient: "Ex-abonnés avec notify_email = true",
    timing: "Automatique (cron)",
    description: "\"Ce mois-ci on a fait +X unités\" — envoie les stats réelles du mois écoulé. Montre ce que l'utilisateur a manqué. CTA vers l'abonnement.",
    file: "src/lib/emails.ts → sendWinbackDay30Email()",
    route: "src/app/api/cron/emails/route.ts",
    color: "#a78bfa",
    icon: "📈",
  },
  {
    id: "premium-expiring",
    name: "Premium expire demain",
    trigger: "CRON quotidien — J-1 avant expiration (premiums offerts)",
    recipient: "Users premium offerts (sans Stripe) dont l'abo expire demain",
    timing: "Automatique (cron)",
    description: "Rappelle que l'accès Premium offert se termine demain. Liste ce qui sera perdu. CTA vers l'abonnement payant.",
    file: "src/lib/emails.ts → sendPremiumExpiringEmail()",
    route: "src/app/api/cron/emails/route.ts",
    color: "#f59e0b",
    icon: "⏰",
  },
  {
    id: "inactivity",
    name: "Rappel inactivité",
    trigger: "CRON quotidien — 15 jours sans connexion (premium)",
    recipient: "Abonnés Premium inactifs",
    timing: "Automatique (cron) — TODO: nécessite last_seen_at",
    description: "\"Tout va bien ?\" — rappel doux pour les abonnés qui ne se connectent plus. Invite à activer les notifications et installer l'app. Désactivable.",
    file: "src/lib/emails.ts → sendInactivityEmail()",
    route: "src/app/api/cron/emails/route.ts (TODO)",
    color: "#6b7280",
    icon: "😴",
  },
];

const SUPABASE_EMAILS = [
  {
    id: "magic-link",
    name: "Magic Link (connexion)",
    trigger: "Demande de connexion",
    recipient: "Utilisateur qui se connecte",
    timing: "Immédiat",
    description: "Lien magique de connexion envoyé par Supabase Auth. Template personnalisé dans Supabase Dashboard → Authentication → Email Templates.",
    file: "Supabase Auth (pas dans le code)",
    route: "Supabase Dashboard → Email Templates",
    color: "#059669",
    icon: "🔑",
  },
  {
    id: "confirm-signup",
    name: "Confirmation inscription",
    trigger: "Première inscription",
    recipient: "Nouvel utilisateur",
    timing: "Immédiat",
    description: "Email de confirmation d'adresse email envoyé par Supabase Auth. Template personnalisé dans Supabase Dashboard.",
    file: "Supabase Auth (pas dans le code)",
    route: "Supabase Dashboard → Email Templates",
    color: "#059669",
    icon: "✉️",
  },
];

export default function AdminEmailsPage() {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  async function fetchLogs() {
    try {
      const res = await fetch("/api/admin/email-logs");
      const data = await res.json();
      setLogs(Array.isArray(data) ? data : []);
    } catch {
      setLogs([]);
    }
    setLoading(false);
  }

  async function sendTestEmail(emailId: string) {
    setTestingId(emailId);
    setTestResult(null);

    try {
      const res = await fetch(`/api/admin/test-email?type=${emailId}`, { method: "POST" });
      const data = await res.json();
      setTestResult(data.success ? "✅ Email test envoyé !" : `❌ ${data.error || "Erreur"}`);
    } catch {
      setTestResult("❌ Erreur réseau");
    }

    setTestingId(null);
    setTimeout(() => setTestResult(null), 5000);
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/fr/admin" className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-white/30 transition hover:text-white/60">
        ← Dashboard
      </Link>

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: "rgba(16,185,129,0.15)" }}>
          <span className="text-lg">📧</span>
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-white">Emails automatisés</h1>
          <p className="text-xs text-white/30">{AUTOMATED_EMAILS.length + SUPABASE_EMAILS.length} emails configurés</p>
        </div>
      </div>

      {/* Test result toast */}
      {testResult && (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-center text-sm text-white/70">
          {testResult}
        </div>
      )}

      {/* Automated emails */}
      <div className="mt-8">
        <div className="flex items-center gap-2">
          <span className="text-sm">⚡</span>
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-400">Emails automatisés ({AUTOMATED_EMAILS.length})</p>
        </div>

        <div className="mt-3 space-y-2">
          {AUTOMATED_EMAILS.map((email) => (
            <div key={email.id}>
              <button
                onClick={() => setExpandedId(expandedId === email.id ? null : email.id)}
                className="flex w-full cursor-pointer items-center gap-4 rounded-xl border border-white/[0.06] p-4 text-left transition hover:border-white/10"
                style={{ background: "linear-gradient(135deg, #111 0%, #151515 100%)" }}
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: `${email.color}15` }}>
                  <span className="text-lg">{email.icon}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-white">{email.name}</p>
                    <span className="rounded px-1.5 py-0.5 text-[8px] font-bold uppercase" style={{ background: `${email.color}20`, color: email.color }}>
                      {email.timing.includes("cron") ? "CRON" : email.timing.includes("TODO") ? "TODO" : "AUTO"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-white/30">{email.trigger}</p>
                </div>
                <svg className={`h-4 w-4 text-white/20 transition ${expandedId === email.id ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {expandedId === email.id && (
                <div className="mt-1 rounded-xl border border-white/[0.06] p-5" style={{ background: "#0d0d0d" }}>
                  <div className="space-y-3 text-xs text-white/50">
                    <div>
                      <span className="font-bold text-white/30">Destinataire :</span>
                      <span className="ml-2">{email.recipient}</span>
                    </div>
                    <div>
                      <span className="font-bold text-white/30">Description :</span>
                      <span className="ml-2">{email.description}</span>
                    </div>
                    <div>
                      <span className="font-bold text-white/30">Fonction :</span>
                      <span className="ml-2 font-mono text-[10px] text-emerald-400/70">{email.file}</span>
                    </div>
                    <div>
                      <span className="font-bold text-white/30">Route :</span>
                      <span className="ml-2 font-mono text-[10px] text-blue-400/70">{email.route}</span>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => sendTestEmail(email.id)}
                      disabled={testingId === email.id || email.timing.includes("TODO")}
                      className="cursor-pointer rounded-lg bg-emerald-500/20 px-3 py-1.5 text-[10px] font-bold text-emerald-400 transition hover:bg-emerald-500/30 disabled:opacity-30"
                    >
                      {testingId === email.id ? "Envoi..." : "📤 Envoyer un test"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Supabase emails */}
      <div className="mt-10">
        <div className="flex items-center gap-2">
          <span className="text-sm">🔐</span>
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/30">Emails Supabase Auth ({SUPABASE_EMAILS.length})</p>
        </div>

        <div className="mt-3 space-y-2">
          {SUPABASE_EMAILS.map((email) => (
            <div key={email.id}>
              <button
                onClick={() => setExpandedId(expandedId === email.id ? null : email.id)}
                className="flex w-full cursor-pointer items-center gap-4 rounded-xl border border-white/[0.06] p-4 text-left transition hover:border-white/10"
                style={{ background: "linear-gradient(135deg, #111 0%, #151515 100%)" }}
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: `${email.color}15` }}>
                  <span className="text-lg">{email.icon}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-white">{email.name}</p>
                    <span className="rounded bg-neutral-500/20 px-1.5 py-0.5 text-[8px] font-bold uppercase text-neutral-400">SUPABASE</span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-white/30">{email.trigger}</p>
                </div>
                <svg className={`h-4 w-4 text-white/20 transition ${expandedId === email.id ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {expandedId === email.id && (
                <div className="mt-1 rounded-xl border border-white/[0.06] p-5" style={{ background: "#0d0d0d" }}>
                  <div className="space-y-3 text-xs text-white/50">
                    <div>
                      <span className="font-bold text-white/30">Destinataire :</span>
                      <span className="ml-2">{email.recipient}</span>
                    </div>
                    <div>
                      <span className="font-bold text-white/30">Description :</span>
                      <span className="ml-2">{email.description}</span>
                    </div>
                    <div>
                      <span className="font-bold text-white/30">Configuration :</span>
                      <span className="ml-2 font-mono text-[10px] text-amber-400/70">{email.route}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Recent logs */}
      <div className="mt-10">
        <div className="flex items-center gap-2">
          <span className="text-sm">📋</span>
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/30">Derniers envois</p>
        </div>

        {loading ? (
          <div className="mt-4 flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          </div>
        ) : logs.length > 0 ? (
          <div className="mt-3 space-y-1">
            {logs.slice(0, 20).map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between rounded-lg border border-white/[0.04] px-4 py-2.5"
                style={{ background: "#0f0f0f" }}
              >
                <div>
                  <p className="text-xs font-semibold text-white/60">{log.title || "Notification"}</p>
                  <p className="text-[10px] text-white/25">
                    {new Date(log.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-[10px]">
                  {log.metadata && typeof log.metadata === "object" && (
                    <>
                      {"emailSent" in log.metadata && (
                        <span className="text-blue-400/70">📧 {String(log.metadata.emailSent)}</span>
                      )}
                      {"pushSent" in log.metadata && (
                        <span className="text-emerald-400/70">🔔 {String(log.metadata.pushSent)}</span>
                      )}
                      {"telegramSent" in log.metadata && (
                        <span className="text-sky-400/70">✈️ {log.metadata.telegramSent ? "✓" : "✗"}</span>
                      )}
                    </>
                  )}
                  <span className="rounded bg-white/[0.06] px-2 py-0.5 text-white/30">
                    {log.recipients_count} dest.
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 text-center py-8">
            <p className="text-white/20 text-sm">Aucun envoi enregistré</p>
          </div>
        )}
      </div>
    </main>
  );
}