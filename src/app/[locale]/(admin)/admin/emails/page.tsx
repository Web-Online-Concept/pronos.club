"use client";

/**
 * ═══════════════════════════════════════════════════════════════════
 * /admin/emails/page.tsx (V2 — dashboard observability — 11/05/2026)
 * ═══════════════════════════════════════════════════════════════════
 *
 * V2 (11/05/2026) — Ajout système d'onglets :
 *   - 📧 Stats Emails  : compteurs par catégorie/status, 50 derniers échecs
 *   - 🔔 Stats Push    : compteurs par platform/code, subs à risque
 *   - 🔍 Recherche User : audit complet notifs d'un user (subs, emails, push)
 *   - 📚 Documentation : contenu original conservé (AUTOMATED_EMAILS + SUPABASE)
 *
 * Consomme /api/admin/notif-stats et /api/admin/user-notif-detail.
 *
 * Path : src/app/[locale]/(admin)/admin/emails/page.tsx
 * ═══════════════════════════════════════════════════════════════════
 */

import { useState, useEffect } from "react";
import Link from "next/link";

interface EmailLog {
  id: string;
  channel?: string;
  title?: string;
  recipients_count?: number;
  metadata?: Record<string, unknown>;
  created_at?: string;
}

const AUTOMATED_EMAILS = [
  { id: "welcome", name: "Bienvenue", trigger: "Première inscription", recipient: "Tout nouvel utilisateur", timing: "Immédiat", description: "Email de bienvenue après la création du compte. Présente le site, les fonctionnalités gratuites et invite à activer les notifications.", file: "src/lib/emails.ts → sendWelcomeEmail()", route: "src/app/api/auth/callback/route.ts", color: "#10b981", icon: "👋" },
  { id: "welcome-premium", name: "Bienvenue Premium", trigger: "Passage en Premium (Stripe ou admin)", recipient: "Nouvel abonné Premium", timing: "Immédiat", description: "Email de bienvenue Premium avec récapitulatif des fonctionnalités débloquées et lien d'invitation Telegram (unique, usage unique, expire 48h).", file: "src/lib/emails.ts → sendWelcomePremiumEmail()", route: "src/lib/telegram-hooks.ts → onPremiumActivated()", color: "#f59e0b", icon: "⭐" },
  { id: "new-pick", name: "Nouveau pronostic", trigger: "Publication d'un pick (admin)", recipient: "Users avec notify_tipster_email = true (premium si pick premium)", timing: "Immédiat à la publication", description: "Notification email à chaque nouveau pronostic publié. Indique le sport et le type (gratuit/premium). Lien vers la page pronostics.", file: "src/lib/emails.ts → sendNewPickEmail()", route: "src/app/api/notifications/send/route.ts", color: "#3b82f6", icon: "🔔" },
  { id: "tipster-new-pick", name: "Nouveau prono — Pronos Abonnés", trigger: "Publication d'un pick par un tipster premium", recipient: "Followers du tipster (mode 'all' ou 'selected') avec channel_email activé", timing: "Immédiat à la publication", description: "Notification email envoyée aux abonnés qui suivent le tipster lorsqu'il publie un nouveau pronostic. Contient pseudo, date du match, sport, bookmaker. Lien vers la page en-cours.", file: "src/lib/emails.ts → sendTipsterNewPickEmail()", route: "src/lib/tipster-notifications.ts → notifyFollowersOfNewPick()", color: "#10b981", icon: "🎯" },
  { id: "bilan", name: "Bilan mensuel", trigger: "Publication d'un bilan (admin → Publier)", recipient: "Abonnés Premium avec notify_bilan = true", timing: "À la publication du bilan", description: "Résumé du mois avec statistiques (picks, win rate, ROI, profit) et lien vers le bilan complet. L'utilisateur peut désactiver dans ses notifications.", file: "src/lib/emails.ts → sendBilanEmail()", route: "src/app/api/admin/bilans/route.ts → PUT (publish)", color: "#06b6d4", icon: "📊" },
  { id: "cancellation", name: "Confirmation résiliation", trigger: "Résiliation de l'abonnement", recipient: "Abonné qui résilie", timing: "Immédiat", description: "Confirme la résiliation avec la date de fin d'accès Premium. Rappelle que l'accès Telegram sera retiré et que les données sont conservées.", file: "src/lib/emails.ts → sendCancellationEmail()", route: "src/app/api/stripe/cancel/route.ts", color: "#ef4444", icon: "👋" },
  { id: "winback-7", name: "Relance J+7", trigger: "CRON quotidien — 7 jours après résiliation", recipient: "Ex-abonnés avec notify_email = true", timing: "Automatique (cron)", description: "\"Vos stats sont toujours là\" — rappelle que l'espace personnel est intact. Ton doux, pas agressif.", file: "src/lib/emails.ts → sendWinbackDay7Email()", route: "src/app/api/cron/emails/route.ts", color: "#a78bfa", icon: "💌" },
  { id: "winback-30", name: "Relance J+30", trigger: "CRON quotidien — 30 jours après résiliation", recipient: "Ex-abonnés avec notify_email = true", timing: "Automatique (cron)", description: "\"Ce mois-ci on a fait +X unités\" — envoie les stats réelles du mois écoulé. CTA vers l'abonnement.", file: "src/lib/emails.ts → sendWinbackDay30Email()", route: "src/app/api/cron/emails/route.ts", color: "#a78bfa", icon: "📈" },
  { id: "premium-expiring", name: "Premium expire demain", trigger: "CRON quotidien — J-1 avant expiration", recipient: "Users premium offerts dont l'abo expire demain", timing: "Automatique (cron)", description: "Rappelle que l'accès Premium offert se termine demain. CTA vers l'abonnement payant.", file: "src/lib/emails.ts → sendPremiumExpiringEmail()", route: "src/app/api/cron/emails/route.ts", color: "#f59e0b", icon: "⏰" },
  { id: "inactivity", name: "Rappel inactivité", trigger: "CRON quotidien — 15 jours sans connexion (premium)", recipient: "Abonnés Premium inactifs", timing: "Automatique (cron) — TODO: nécessite last_seen_at", description: "\"Tout va bien ?\" — rappel doux. Invite à activer les notifications. Désactivable.", file: "src/lib/emails.ts → sendInactivityEmail()", route: "src/app/api/cron/emails/route.ts (TODO)", color: "#6b7280", icon: "😴" },
];

const SUPABASE_EMAILS = [
  { id: "magic-link", name: "Magic Link (connexion)", trigger: "Demande de connexion", recipient: "Utilisateur qui se connecte", timing: "Immédiat", description: "Lien magique de connexion envoyé par Supabase Auth.", file: "Supabase Auth (pas dans le code)", route: "Supabase Dashboard → Email Templates", color: "#059669", icon: "🔑" },
  { id: "confirm-signup", name: "Confirmation inscription", trigger: "Première inscription", recipient: "Nouvel utilisateur", timing: "Immédiat", description: "Email de confirmation d'adresse email envoyé par Supabase Auth.", file: "Supabase Auth (pas dans le code)", route: "Supabase Dashboard → Email Templates", color: "#059669", icon: "✉️" },
];

type Tab = "emails" | "push" | "search" | "docs";

interface NotifStats {
  period: { from: string; to: string };
  emails: {
    total: number;
    byStatus: Record<string, number>;
    byCategory: Record<string, Record<string, number>>;
    recentFailures: Array<{ id: string; email: string; category: string; status: string; error: string | null; sent_at: string }>;
  };
  push: {
    total: number;
    sent: number;
    failed: number;
    byPlatform: Record<string, { sent: number; failed: number }>;
    byStatusCode: Record<string, number>;
    recentFailures: Array<{ id: string; user_id: string; user_email: string | null; platform: string; status_code: number; error: string | null; sent_at: string }>;
    subsAtRisk: Array<{ id: string; user_email: string | null; platform: string; consecutive_failures: number; endpoint_short: string; last_failure_at: string }>;
  };
  subs: {
    total: number;
    byPlatform: Record<string, number>;
  };
}

interface UserDetail {
  user: {
    id: string; email: string; pseudo: string | null; display_name: string | null; locale: string | null;
    subscription_status: string | null; telegram_user_id: number | null;
    notify_email: boolean; notify_push: boolean; notify_bilan: boolean;
    notify_tipster_push: boolean; notify_tipster_email: boolean;
    notify_abonnes_push: boolean; notify_abonnes_email: boolean;
    created_at: string;
  };
  prefs: { mode: string; channel_email: boolean; channel_telegram: boolean; channel_push: boolean } | null;
  subs: Array<{ id: string; platform: string; endpoint_short: string; created_at: string; last_seen_at: string; last_success_at: string | null; consecutive_failures: number }>;
  emailLogs: Array<{ id: string; category: string; status: string; subject: string; locale: string; error: string | null; sent_at: string }>;
  pushLogs: Array<{ id: string; status: string; platform: string; status_code: number; error: string | null; sent_at: string }>;
  emailStats: { total: number; sent: number; delivered: number; opened: number; clicked: number; failed: number };
  pushStats: { total: number; sent: number; failed: number };
}

export default function AdminEmailsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("emails");

  // Docs state (panel existant)
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/fr/admin" className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-white/30 transition hover:text-white/60">
        ← Dashboard
      </Link>

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: "rgba(16,185,129,0.15)" }}>
          <span className="text-lg">📧</span>
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-white">Notifications & Emails</h1>
          <p className="text-xs text-white/30">Observabilité, stats, et documentation</p>
        </div>
      </div>

      {/* Onglets */}
      <div className="mt-6 flex flex-wrap gap-1 border-b border-white/10">
        <TabBtn label="📧 Stats Emails" active={activeTab === "emails"} onClick={() => setActiveTab("emails")} />
        <TabBtn label="🔔 Stats Push" active={activeTab === "push"} onClick={() => setActiveTab("push")} />
        <TabBtn label="🔍 Recherche user" active={activeTab === "search"} onClick={() => setActiveTab("search")} />
        <TabBtn label="📚 Documentation" active={activeTab === "docs"} onClick={() => setActiveTab("docs")} />
      </div>

      <div className="mt-6">
        {activeTab === "emails" && <EmailsStatsPanel />}
        {activeTab === "push" && <PushStatsPanel />}
        {activeTab === "search" && <UserSearchPanel />}
        {activeTab === "docs" && (
          <DocsPanel
            expandedId={expandedId}
            setExpandedId={setExpandedId}
            testingId={testingId}
            setTestingId={setTestingId}
            testResult={testResult}
            setTestResult={setTestResult}
          />
        )}
      </div>
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════
// COMPOSANTS COMMUNS
// ═══════════════════════════════════════════════════════════════════

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`cursor-pointer rounded-t-lg px-4 py-2 text-xs font-bold transition ${
        active ? "border-b-2 border-emerald-500 bg-white/[0.04] text-white" : "text-white/40 hover:text-white/70"
      }`}
    >
      {label}
    </button>
  );
}

function StatCard({ label, value, color = "white" }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] p-4" style={{ background: "#111" }}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">{label}</p>
      <p className={`mt-1 text-2xl font-extrabold`} style={{ color }}>{value}</p>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PANEL — STATS EMAILS
// ═══════════════════════════════════════════════════════════════════

function EmailsStatsPanel() {
  const [stats, setStats] = useState<NotifStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/notif-stats")
      .then((r) => r.json())
      .then((data) => { setStats(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;
  if (!stats) return <p className="text-sm text-white/30">Erreur chargement</p>;

  const e = stats.emails;

  return (
    <div className="space-y-6">
      <p className="text-xs text-white/30">Période : {new Date(stats.period.from).toLocaleDateString("fr-FR")} → aujourd'hui</p>

      {/* Compteurs globaux */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total envois" value={e.total} />
        <StatCard label="Délivrés" value={e.byStatus.delivered || 0} color="#10b981" />
        <StatCard label="Ouverts" value={e.byStatus.opened || 0} color="#3b82f6" />
        <StatCard label="Cliqués" value={e.byStatus.clicked || 0} color="#8b5cf6" />
        <StatCard label="Échecs" value={(e.byStatus.failed || 0)} color="#ef4444" />
        <StatCard label="Hard bounce" value={e.byStatus.hard_bounce || 0} color="#dc2626" />
        <StatCard label="Soft bounce" value={e.byStatus.soft_bounce || 0} color="#f59e0b" />
        <StatCard label="Désinscrits" value={e.byStatus.unsubscribed || 0} color="#6b7280" />
      </div>

      {/* Par catégorie */}
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-emerald-400">Par catégorie</p>
        <div className="overflow-x-auto rounded-xl border border-white/[0.06]" style={{ background: "#0d0d0d" }}>
          <table className="w-full text-xs">
            <thead className="border-b border-white/10 text-[10px] uppercase text-white/40">
              <tr>
                <th className="px-3 py-2 text-left">Catégorie</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-right">Délivrés</th>
                <th className="px-3 py-2 text-right">Ouverts</th>
                <th className="px-3 py-2 text-right">Cliqués</th>
                <th className="px-3 py-2 text-right">Échecs</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(e.byCategory).sort((a, b) => {
                const totalA = Object.values(a[1]).reduce((s, n) => s + n, 0);
                const totalB = Object.values(b[1]).reduce((s, n) => s + n, 0);
                return totalB - totalA;
              }).map(([cat, statuses]) => {
                const total = Object.values(statuses).reduce((s, n) => s + n, 0);
                const failed = (statuses.failed || 0) + (statuses.hard_bounce || 0) + (statuses.soft_bounce || 0) + (statuses.invalid_email || 0) + (statuses.blocked || 0) + (statuses.spam || 0);
                return (
                  <tr key={cat} className="border-b border-white/[0.04] text-white/70">
                    <td className="px-3 py-2 font-mono text-[11px] text-emerald-400">{cat}</td>
                    <td className="px-3 py-2 text-right">{total}</td>
                    <td className="px-3 py-2 text-right text-emerald-400/70">{statuses.delivered || 0}</td>
                    <td className="px-3 py-2 text-right text-blue-400/70">{statuses.opened || 0}</td>
                    <td className="px-3 py-2 text-right text-violet-400/70">{statuses.clicked || 0}</td>
                    <td className={`px-3 py-2 text-right ${failed > 0 ? "text-red-400/80" : "text-white/30"}`}>{failed}</td>
                  </tr>
                );
              })}
              {Object.keys(e.byCategory).length === 0 && (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-white/30">Aucun envoi sur la période</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Échecs récents */}
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-red-400">50 derniers échecs</p>
        <div className="overflow-x-auto rounded-xl border border-white/[0.06]" style={{ background: "#0d0d0d" }}>
          <table className="w-full text-xs">
            <thead className="border-b border-white/10 text-[10px] uppercase text-white/40">
              <tr>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Email</th>
                <th className="px-3 py-2 text-left">Catégorie</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Erreur</th>
              </tr>
            </thead>
            <tbody>
              {e.recentFailures.map((f) => (
                <tr key={f.id} className="border-b border-white/[0.04] text-white/70">
                  <td className="px-3 py-2 whitespace-nowrap text-[10px] text-white/40">
                    {new Date(f.sent_at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px]">{f.email}</td>
                  <td className="px-3 py-2 font-mono text-[10px] text-emerald-400/70">{f.category}</td>
                  <td className="px-3 py-2 font-mono text-[10px] text-red-400">{f.status}</td>
                  <td className="px-3 py-2 text-[10px] text-white/30 max-w-xs truncate" title={f.error || ""}>{f.error || "—"}</td>
                </tr>
              ))}
              {e.recentFailures.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-emerald-400/60">Aucun échec récent 🎉</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PANEL — STATS PUSH
// ═══════════════════════════════════════════════════════════════════

function PushStatsPanel() {
  const [stats, setStats] = useState<NotifStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/notif-stats")
      .then((r) => r.json())
      .then((data) => { setStats(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;
  if (!stats) return <p className="text-sm text-white/30">Erreur chargement</p>;

  const p = stats.push;
  const s = stats.subs;

  return (
    <div className="space-y-6">
      <p className="text-xs text-white/30">Période envois : {new Date(stats.period.from).toLocaleDateString("fr-FR")} → aujourd'hui. Subs : snapshot actuel.</p>

      {/* Compteurs globaux */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total subs actives" value={s.total} color="#10b981" />
        <StatCard label="Envois 30j" value={p.total} />
        <StatCard label="Succès" value={p.sent} color="#10b981" />
        <StatCard label="Échecs" value={p.failed} color="#ef4444" />
      </div>

      {/* Par platform */}
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-emerald-400">Par plateforme</p>
        <div className="overflow-x-auto rounded-xl border border-white/[0.06]" style={{ background: "#0d0d0d" }}>
          <table className="w-full text-xs">
            <thead className="border-b border-white/10 text-[10px] uppercase text-white/40">
              <tr>
                <th className="px-3 py-2 text-left">Plateforme</th>
                <th className="px-3 py-2 text-right">Subs actives</th>
                <th className="px-3 py-2 text-right">Envois 30j</th>
                <th className="px-3 py-2 text-right">Succès</th>
                <th className="px-3 py-2 text-right">Échecs</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys({ ...s.byPlatform, ...p.byPlatform }).sort().map((plat) => {
                const subsN = s.byPlatform[plat] || 0;
                const sent = p.byPlatform[plat]?.sent || 0;
                const failed = p.byPlatform[plat]?.failed || 0;
                return (
                  <tr key={plat} className="border-b border-white/[0.04] text-white/70">
                    <td className="px-3 py-2 font-mono text-[11px] text-emerald-400">{plat}</td>
                    <td className="px-3 py-2 text-right">{subsN}</td>
                    <td className="px-3 py-2 text-right">{sent + failed}</td>
                    <td className="px-3 py-2 text-right text-emerald-400/70">{sent}</td>
                    <td className={`px-3 py-2 text-right ${failed > 0 ? "text-red-400/80" : "text-white/30"}`}>{failed}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Codes HTTP push */}
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-emerald-400">Codes HTTP push (30j)</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Object.entries(p.byStatusCode).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).map(([code, n]) => {
            const color = code === "201" || code === "200" ? "#10b981" : (code === "410" || code === "404" || code === "403") ? "#ef4444" : "#f59e0b";
            return (
              <div key={code} className="rounded-lg border border-white/[0.06] p-3" style={{ background: "#0d0d0d" }}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">Code {code}</p>
                <p className="mt-1 text-lg font-extrabold" style={{ color }}>{n}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Subs à risque */}
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-amber-400">Subs en cours d'échec ({p.subsAtRisk.length})</p>
        <div className="overflow-x-auto rounded-xl border border-white/[0.06]" style={{ background: "#0d0d0d" }}>
          <table className="w-full text-xs">
            <thead className="border-b border-white/10 text-[10px] uppercase text-white/40">
              <tr>
                <th className="px-3 py-2 text-left">User</th>
                <th className="px-3 py-2 text-left">Plateforme</th>
                <th className="px-3 py-2 text-right">Échecs consécutifs</th>
                <th className="px-3 py-2 text-left">Dernier échec</th>
              </tr>
            </thead>
            <tbody>
              {p.subsAtRisk.map((sub) => (
                <tr key={sub.id} className="border-b border-white/[0.04] text-white/70">
                  <td className="px-3 py-2 font-mono text-[11px]">{sub.user_email || "—"}</td>
                  <td className="px-3 py-2 font-mono text-[10px] text-emerald-400/70">{sub.platform}</td>
                  <td className={`px-3 py-2 text-right font-bold ${sub.consecutive_failures >= 5 ? "text-red-400" : "text-amber-400"}`}>
                    {sub.consecutive_failures}
                  </td>
                  <td className="px-3 py-2 text-[10px] text-white/40">
                    {sub.last_failure_at ? new Date(sub.last_failure_at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}
                  </td>
                </tr>
              ))}
              {p.subsAtRisk.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-emerald-400/60">Aucune sub en échec 🎉</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Échecs récents */}
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-red-400">50 derniers échecs push</p>
        <div className="overflow-x-auto rounded-xl border border-white/[0.06]" style={{ background: "#0d0d0d" }}>
          <table className="w-full text-xs">
            <thead className="border-b border-white/10 text-[10px] uppercase text-white/40">
              <tr>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">User</th>
                <th className="px-3 py-2 text-left">Plateforme</th>
                <th className="px-3 py-2 text-right">Code</th>
                <th className="px-3 py-2 text-left">Erreur</th>
              </tr>
            </thead>
            <tbody>
              {p.recentFailures.map((f) => (
                <tr key={f.id} className="border-b border-white/[0.04] text-white/70">
                  <td className="px-3 py-2 whitespace-nowrap text-[10px] text-white/40">
                    {new Date(f.sent_at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px]">{f.user_email || "—"}</td>
                  <td className="px-3 py-2 font-mono text-[10px] text-emerald-400/70">{f.platform}</td>
                  <td className="px-3 py-2 text-right font-bold text-red-400">{f.status_code}</td>
                  <td className="px-3 py-2 text-[10px] text-white/30 max-w-xs truncate" title={f.error || ""}>{f.error || "—"}</td>
                </tr>
              ))}
              {p.recentFailures.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-emerald-400/60">Aucun échec récent 🎉</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PANEL — RECHERCHE USER
// ═══════════════════════════════════════════════════════════════════

function UserSearchPanel() {
  const [emailQuery, setEmailQuery] = useState("");
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    if (!emailQuery.trim()) return;
    setLoading(true);
    setError(null);
    setDetail(null);
    try {
      const res = await fetch(`/api/admin/user-notif-detail?email=${encodeURIComponent(emailQuery.trim())}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erreur");
      } else {
        setDetail(data);
      }
    } catch {
      setError("Erreur réseau");
    }
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="email"
          value={emailQuery}
          onChange={(e) => setEmailQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="email@example.com"
          className="flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white placeholder-white/30 focus:border-emerald-500 focus:outline-none"
        />
        <button
          onClick={search}
          disabled={loading || !emailQuery.trim()}
          className="cursor-pointer rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-bold text-emerald-400 transition hover:bg-emerald-500/30 disabled:opacity-30"
        >
          {loading ? "Recherche..." : "🔍 Chercher"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      {detail && (
        <div className="space-y-6">
          {/* User card */}
          <div className="rounded-xl border border-white/[0.06] p-5" style={{ background: "#0d0d0d" }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white">{detail.user.email}</p>
                <p className="text-[10px] text-white/30 font-mono mt-0.5">{detail.user.id}</p>
              </div>
              <span className={`rounded px-2 py-1 text-[10px] font-bold ${detail.user.subscription_status === "active" || detail.user.subscription_status === "trialing" ? "bg-emerald-500/20 text-emerald-400" : "bg-white/[0.06] text-white/30"}`}>
                {detail.user.subscription_status || "free"}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
              <FlagPill label="notify_email" value={detail.user.notify_email} />
              <FlagPill label="notify_push" value={detail.user.notify_push} />
              <FlagPill label="notify_bilan" value={detail.user.notify_bilan} />
              <FlagPill label="tipster_push" value={detail.user.notify_tipster_push} />
              <FlagPill label="tipster_email" value={detail.user.notify_tipster_email} />
              <FlagPill label="abonnes_push" value={detail.user.notify_abonnes_push} />
              <FlagPill label="abonnes_email" value={detail.user.notify_abonnes_email} />
              {detail.prefs && <FlagPill label={`prefs.${detail.prefs.mode}`} value={detail.prefs.channel_push || detail.prefs.channel_email} />}
            </div>
          </div>

          {/* Subs */}
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-emerald-400">Push subscriptions ({detail.subs.length})</p>
            <div className="overflow-x-auto rounded-xl border border-white/[0.06]" style={{ background: "#0d0d0d" }}>
              <table className="w-full text-xs">
                <thead className="border-b border-white/10 text-[10px] uppercase text-white/40">
                  <tr>
                    <th className="px-3 py-2 text-left">Plateforme</th>
                    <th className="px-3 py-2 text-left">Endpoint</th>
                    <th className="px-3 py-2 text-left">Créée</th>
                    <th className="px-3 py-2 text-left">Dernier succès</th>
                    <th className="px-3 py-2 text-right">Échecs</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.subs.map((s) => (
                    <tr key={s.id} className="border-b border-white/[0.04] text-white/70">
                      <td className="px-3 py-2 font-mono text-[10px] text-emerald-400/70">{s.platform}</td>
                      <td className="px-3 py-2 font-mono text-[10px] text-white/40 max-w-xs truncate" title={s.endpoint_short}>{s.endpoint_short}</td>
                      <td className="px-3 py-2 text-[10px] text-white/40">{new Date(s.created_at).toLocaleDateString("fr-FR")}</td>
                      <td className="px-3 py-2 text-[10px] text-white/40">{s.last_success_at ? new Date(s.last_success_at).toLocaleDateString("fr-FR") : "jamais"}</td>
                      <td className={`px-3 py-2 text-right font-bold ${s.consecutive_failures > 0 ? "text-red-400" : "text-white/30"}`}>{s.consecutive_failures}</td>
                    </tr>
                  ))}
                  {detail.subs.length === 0 && (
                    <tr><td colSpan={5} className="px-3 py-6 text-center text-white/30">Aucune subscription</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Emails */}
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-blue-400">30 derniers emails (total: {detail.emailStats.total})</p>
            <div className="overflow-x-auto rounded-xl border border-white/[0.06]" style={{ background: "#0d0d0d" }}>
              <table className="w-full text-xs">
                <thead className="border-b border-white/10 text-[10px] uppercase text-white/40">
                  <tr>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Catégorie</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Locale</th>
                    <th className="px-3 py-2 text-left">Sujet</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.emailLogs.map((log) => (
                    <tr key={log.id} className="border-b border-white/[0.04] text-white/70">
                      <td className="px-3 py-2 whitespace-nowrap text-[10px] text-white/40">
                        {new Date(log.sent_at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-3 py-2 font-mono text-[10px] text-emerald-400/70">{log.category}</td>
                      <td className={`px-3 py-2 font-mono text-[10px] ${["sent", "delivered", "opened", "clicked"].includes(log.status) ? "text-emerald-400" : "text-red-400"}`}>{log.status}</td>
                      <td className="px-3 py-2 text-[10px] text-white/40">{log.locale}</td>
                      <td className="px-3 py-2 text-[10px] text-white/40 max-w-xs truncate" title={log.subject}>{log.subject}</td>
                    </tr>
                  ))}
                  {detail.emailLogs.length === 0 && (
                    <tr><td colSpan={5} className="px-3 py-6 text-center text-white/30">Aucun email envoyé</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Push */}
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-violet-400">30 dernières push (total: {detail.pushStats.total})</p>
            <div className="overflow-x-auto rounded-xl border border-white/[0.06]" style={{ background: "#0d0d0d" }}>
              <table className="w-full text-xs">
                <thead className="border-b border-white/10 text-[10px] uppercase text-white/40">
                  <tr>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Plateforme</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-right">Code</th>
                    <th className="px-3 py-2 text-left">Erreur</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.pushLogs.map((log) => (
                    <tr key={log.id} className="border-b border-white/[0.04] text-white/70">
                      <td className="px-3 py-2 whitespace-nowrap text-[10px] text-white/40">
                        {new Date(log.sent_at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-3 py-2 font-mono text-[10px] text-emerald-400/70">{log.platform || "—"}</td>
                      <td className={`px-3 py-2 font-mono text-[10px] ${log.status === "sent" ? "text-emerald-400" : "text-red-400"}`}>{log.status}</td>
                      <td className="px-3 py-2 text-right font-mono text-[10px]">{log.status_code}</td>
                      <td className="px-3 py-2 text-[10px] text-white/40 max-w-xs truncate" title={log.error || ""}>{log.error || "—"}</td>
                    </tr>
                  ))}
                  {detail.pushLogs.length === 0 && (
                    <tr><td colSpan={5} className="px-3 py-6 text-center text-white/30">Aucune push envoyée</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FlagPill({ label, value }: { label: string; value: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 rounded-lg px-2 py-1 ${value ? "bg-emerald-500/15 text-emerald-400" : "bg-white/[0.04] text-white/30"}`}>
      <span className="font-bold">{value ? "✓" : "✗"}</span>
      <span className="font-mono text-[10px]">{label}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PANEL — DOCUMENTATION (contenu original)
// ═══════════════════════════════════════════════════════════════════

function DocsPanel({
  expandedId, setExpandedId, testingId, setTestingId, testResult, setTestResult,
}: {
  expandedId: string | null;
  setExpandedId: (v: string | null) => void;
  testingId: string | null;
  setTestingId: (v: string | null) => void;
  testResult: string | null;
  setTestResult: (v: string | null) => void;
}) {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/email-logs")
      .then((r) => r.json())
      .then((data) => { setLogs(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

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
    <>
      {testResult && (
        <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-center text-sm text-white/70">
          {testResult}
        </div>
      )}

      {/* Automated emails */}
      <div>
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
                    <div><span className="font-bold text-white/30">Destinataire :</span> <span className="ml-2">{email.recipient}</span></div>
                    <div><span className="font-bold text-white/30">Description :</span> <span className="ml-2">{email.description}</span></div>
                    <div><span className="font-bold text-white/30">Fonction :</span> <span className="ml-2 font-mono text-[10px] text-emerald-400/70">{email.file}</span></div>
                    <div><span className="font-bold text-white/30">Route :</span> <span className="ml-2 font-mono text-[10px] text-blue-400/70">{email.route}</span></div>
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
                    <div><span className="font-bold text-white/30">Destinataire :</span> <span className="ml-2">{email.recipient}</span></div>
                    <div><span className="font-bold text-white/30">Description :</span> <span className="ml-2">{email.description}</span></div>
                    <div><span className="font-bold text-white/30">Configuration :</span> <span className="ml-2 font-mono text-[10px] text-amber-400/70">{email.route}</span></div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Legacy logs (notification_logs general) — conservé pour rétrocompat */}
      <div className="mt-10">
        <div className="flex items-center gap-2">
          <span className="text-sm">📋</span>
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/30">Derniers envois (legacy)</p>
        </div>

        {loading ? (
          <div className="mt-4 flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          </div>
        ) : logs.length > 0 ? (
          <div className="mt-3 space-y-1">
            {logs.slice(0, 20).map((log) => (
              <div key={log.id} className="flex items-center justify-between rounded-lg border border-white/[0.04] px-4 py-2.5" style={{ background: "#0f0f0f" }}>
                <div>
                  <p className="text-xs font-semibold text-white/60">{log.title || "Notification"}</p>
                  <p className="text-[10px] text-white/25">
                    {log.created_at && new Date(log.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-[10px]">
                  {log.metadata && typeof log.metadata === "object" && (
                    <>
                      {"emailSent" in log.metadata && <span className="text-blue-400/70">📧 {String(log.metadata.emailSent)}</span>}
                      {"pushSent" in log.metadata && <span className="text-emerald-400/70">🔔 {String(log.metadata.pushSent)}</span>}
                      {"telegramSent" in log.metadata && <span className="text-sky-400/70">✈️ {log.metadata.telegramSent ? "✓" : "✗"}</span>}
                    </>
                  )}
                  <span className="rounded bg-white/[0.06] px-2 py-0.5 text-white/30">{log.recipients_count} dest.</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 text-center py-8">
            <p className="text-white/20 text-sm">Aucun envoi enregistré (legacy)</p>
          </div>
        )}
      </div>
    </>
  );
}