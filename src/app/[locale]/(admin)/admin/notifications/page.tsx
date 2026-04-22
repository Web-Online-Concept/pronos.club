"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface PushUser {
  id: string;
  email: string;
  pseudo: string | null;
  platform: "ios" | "android" | "firefox" | "windows" | "other";
  subscription_status: string;
  notify_push: boolean;
}

interface NotifLog {
  id: string;
  sent_at: string;
  user_email: string | null;
  channel: string;
  status: string;
  platform: string | null;
  status_code: number | null;
  error: string | null;
}

interface TestResult {
  success: boolean;
  user?: { id: string; email: string; platform: string };
  error?: string;
  statusCode?: number;
  shouldCleanup?: boolean;
}

const PLATFORM_ICONS: Record<string, string> = {
  ios: "🍎",
  android: "🤖",
  firefox: "🦊",
  windows: "🪟",
  other: "📱",
};

export default function NotificationsAdminPage() {
  const [users, setUsers] = useState<PushUser[]>([]);
  const [logs, setLogs] = useState<NotifLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<string | null>(null);
  const [testAllLoading, setTestAllLoading] = useState(false);
  const [results, setResults] = useState<Record<string, TestResult>>({});
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/notifications/list");
      const data = await res.json();
      setUsers(data.users ?? []);
      setLogs(data.logs ?? []);
    } catch (err) {
      console.error("Fetch error:", err);
    }
    setLoading(false);
  }

  async function testPush(user: PushUser) {
    setTesting(user.id);
    try {
      const res = await fetch("/api/admin/push-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      setResults((prev) => ({ ...prev, [user.id]: data }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setResults((prev) => ({ ...prev, [user.id]: { success: false, error: msg } }));
    }
    setTesting(null);
    setTimeout(() => fetchData(), 500);
  }

  async function testAll() {
    if (!confirm(`Envoyer une notification test à tous les ${users.length} utilisateurs ?`)) return;
    setTestAllLoading(true);
    const newResults: Record<string, TestResult> = {};

    for (const user of users) {
      try {
        const res = await fetch("/api/admin/push-test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id }),
        });
        newResults[user.id] = await res.json();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        newResults[user.id] = { success: false, error: msg };
      }
    }

    setResults(newResults);
    setTestAllLoading(false);
    setTimeout(() => fetchData(), 500);
  }

  function formatDate(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffH = Math.floor(diffMs / 3600000);
    const diffD = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return "À l'instant";
    if (diffMin < 60) return `Il y a ${diffMin} min`;
    if (diffH < 24) return `Il y a ${diffH}h`;
    if (diffD < 7) return `Il y a ${diffD}j`;
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  }

  function getResultBadge(result: TestResult) {
    if (result.success) {
      return { type: "success" as const, label: "✓ Envoyée", detail: `Plateforme : ${result.user?.platform ?? "inconnue"}` };
    }
    if (result.shouldCleanup || result.statusCode === 410 || result.statusCode === 404 || result.statusCode === 403) {
      return { type: "warning" as const, label: "✗ Sub morte", detail: `Code ${result.statusCode ?? "?"} — L'utilisateur doit se ré-abonner` };
    }
    return { type: "error" as const, label: "✗ Échec", detail: result.error?.slice(0, 100) ?? "Erreur inconnue" };
  }

  const filtered = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return u.email.toLowerCase().includes(q) || (u.pseudo ?? "").toLowerCase().includes(q);
  });

  const statsByPlatform = users.reduce<Record<string, number>>((acc, u) => {
    acc[u.platform] = (acc[u.platform] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/fr/admin" className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-white/30 transition hover:text-white/60">
        ← Dashboard
      </Link>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: "rgba(99,102,241,0.15)" }}>
            <span className="text-lg">🔔</span>
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-white">Notifications</h1>
            <p className="text-xs text-white/30">
              {users.length} abonné{users.length !== 1 ? "s" : ""} push actif{users.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      {users.length > 0 && (
        <div className="mt-6 grid grid-cols-4 gap-2">
          {(["ios", "android", "firefox", "other"] as const).map((p) => (
            <div
              key={p}
              className="overflow-hidden rounded-xl border border-white/[0.06] p-3 text-center"
              style={{ background: "linear-gradient(135deg, #111 0%, #0a1a14 100%)" }}
            >
              <p className="text-lg">{PLATFORM_ICONS[p]}</p>
              <p className="mt-1 text-lg font-extrabold text-white">{statsByPlatform[p] ?? 0}</p>
              <p className="text-[9px] font-semibold uppercase tracking-wider text-white/40">{p}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par email ou pseudo..."
          className="flex-1 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white placeholder-white/20 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20"
        />
        <button
          onClick={testAll}
          disabled={testAllLoading || users.length === 0}
          className="flex-shrink-0 cursor-pointer rounded-xl bg-indigo-600 px-4 py-3 text-xs font-bold text-white transition hover:bg-indigo-500 disabled:opacity-30"
        >
          {testAllLoading ? "..." : "Tester TOUS"}
        </button>
      </div>

      {loading ? (
        <p className="mt-8 text-center text-sm text-white/30">Chargement...</p>
      ) : filtered.length === 0 ? (
        <p className="mt-8 text-center text-sm text-white/30">
          {users.length === 0 ? "Aucun abonné push pour le moment" : "Aucun utilisateur trouvé"}
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {filtered.map((user) => {
            const result = results[user.id];
            const isTesting = testing === user.id;
            const badge = result ? getResultBadge(result) : null;

            return (
              <div
                key={user.id}
                className="overflow-hidden rounded-xl border border-white/[0.06] p-4"
                style={{ background: "linear-gradient(135deg, #111 0%, #0a1a14 100%)" }}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10">
                    <span className="text-lg">{PLATFORM_ICONS[user.platform]}</span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-bold text-white">
                        {user.pseudo ?? user.email.split("@")[0]}
                      </p>
                      <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-indigo-400">
                        {user.platform}
                      </span>
                      {user.subscription_status !== "active" && user.subscription_status !== "trialing" && (
                        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/30">
                          Gratuit
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-white/30">{user.email}</p>
                  </div>

                  <button
                    onClick={() => testPush(user)}
                    disabled={isTesting}
                    className="flex-shrink-0 cursor-pointer rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-indigo-500 disabled:opacity-30"
                  >
                    {isTesting ? "..." : "Tester"}
                  </button>
                </div>

                {badge && (
                  <div
                    className={`mt-3 rounded-lg border p-2.5 text-xs ${
                      badge.type === "success"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                        : badge.type === "warning"
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                        : "border-red-500/30 bg-red-500/10 text-red-400"
                    }`}
                  >
                    <p className="font-bold">{badge.label}</p>
                    <p className="mt-0.5 opacity-80">{badge.detail}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-10">
        <div className="flex items-center gap-2">
          <span className="text-sm">📜</span>
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/40">Historique (50 dernières)</p>
        </div>

        {logs.length === 0 ? (
          <p className="mt-4 text-center text-sm text-white/30">Aucun log</p>
        ) : (
          <div className="mt-3 space-y-1.5">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-center gap-3 rounded-lg border border-white/[0.06] px-3 py-2 text-xs"
                style={{ background: "linear-gradient(135deg, #111 0%, #0a1a14 100%)" }}
              >
                <span className="text-sm">{log.platform ? PLATFORM_ICONS[log.platform] ?? "📱" : "📧"}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-white">
                    {log.user_email ?? "—"}
                    <span className="ml-2 text-[10px] text-white/30">
                      {log.channel}
                    </span>
                  </p>
                  {log.error && (
                    <p className="truncate text-[10px] text-red-400/80">{log.error}</p>
                  )}
                </div>
                <div className="flex-shrink-0 text-right">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                      log.status === "sent"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-red-500/20 text-red-400"
                    }`}
                  >
                    {log.status}
                    {log.status_code ? ` · ${log.status_code}` : ""}
                  </span>
                  <p className="mt-0.5 text-[10px] text-white/30">
                    {formatDate(log.sent_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        className="mt-10 overflow-hidden rounded-xl border border-white/[0.06] p-4"
        style={{ background: "linear-gradient(135deg, #111 0%, #0a1a14 100%)" }}
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-400">💡 Comment lire les résultats</p>
        <div className="mt-3 space-y-2 text-xs text-white/60">
          <p><span className="font-bold text-emerald-400">✓ Envoyée</span> — Le serveur a bien envoyé la notif. Si l&apos;utilisateur ne la reçoit pas, c&apos;est côté téléphone (throttling iOS, mode Ne Pas Déranger, etc.).</p>
          <p><span className="font-bold text-amber-400">✗ Sub morte</span> — La subscription est expirée (codes 410/403/404). L&apos;utilisateur doit se ré-abonner dans Mon Compte → Notifications.</p>
          <p><span className="font-bold text-red-400">✗ Échec</span> — Erreur serveur inattendue, consulter le message d&apos;erreur.</p>
        </div>
      </div>
    </main>
  );
}