// src/app/[locale]/(admin)/admin/ai-picks-resolve/page.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { useAuth } from "@/components/auth/AuthProvider";

const ADMIN_EMAILS = ["flotoulouse7@gmail.com", "jbrulard@yahoo.fr"];

type AiPick = {
  id: string;
  classic_number: number | null;
  sport: string;
  league: string;
  event_name: string;
  event_date: string;
  selection: string;
  market: string | null;
  odds: number;
  stake: number;
  pick_type: string;
  generation_version: string | null;
  resolution_source: string | null;
  status: string;
};

const STATUS_OPTIONS = [
  { v: "won", label: "Gagné", icon: "✅", color: "emerald" },
  { v: "half_won", label: "½ Gagné", icon: "🟢", color: "emerald" },
  { v: "void", label: "Remboursé", icon: "⚪", color: "neutral" },
  { v: "half_lost", label: "½ Perdu", icon: "🔴", color: "red" },
  { v: "lost", label: "Perdu", icon: "❌", color: "red" },
] as const;

export default function AiPicksResolvePage() {
  const { user, loading: authLoading } = useAuth();
  const locale = useLocale();

  const [picks, setPicks] = useState<AiPick[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{ pickId: string; status: string } | null>(null);

  const isAdmin = !!user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase());

  async function fetchPicks() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/ai-picks/resolve");
      if (!res.ok) {
        if (res.status === 401) {
          setError("Accès non autorisé");
        } else {
          setError("Erreur lors du chargement");
        }
        setPicks([]);
        return;
      }
      const data = await res.json();
      setPicks(data.picks ?? []);
    } catch {
      setError("Erreur réseau");
      setPicks([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAdmin) fetchPicks();
  }, [isAdmin]);

  async function confirmResolve() {
    if (!pendingAction) return;
    const { pickId, status } = pendingAction;
    setResolvingId(pickId);
    setPendingAction(null);

    try {
      const res = await fetch("/api/admin/ai-picks/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pickId, status }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`Erreur : ${data.error ?? "inconnue"}`);
      } else {
        // Retirer le pick de la liste
        setPicks((prev) => prev.filter((p) => p.id !== pickId));
      }
    } catch {
      alert("Erreur réseau");
    } finally {
      setResolvingId(null);
    }
  }

  function formatDateTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString("fr-FR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (authLoading) {
    return (
      <main className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-neutral-50 flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="text-2xl font-black text-neutral-900">Accès admin uniquement</h1>
          <Link
            href={`/${locale}`}
            className="mt-6 inline-block rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white"
          >
            Retour au site
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-50">
      {/* Hero */}
      <div
        className="px-4 py-8 text-center text-white"
        style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
      >
        <div className="mx-auto max-w-4xl">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.3em] text-emerald-400">
            🤖 Admin Pronos IA
          </p>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">Résolution manuelle</h1>
          <p className="mt-2 text-sm text-white/60">
            Valide les résultats des picks IA dont le match est terminé. Le cron auto à 8h Paris résoudra les picks restants.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Toolbar */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-700">
              {picks.length} pick{picks.length > 1 ? "s" : ""} à résoudre
            </span>
          </div>
          <button
            onClick={fetchPicks}
            disabled={loading}
            className="cursor-pointer rounded-xl bg-neutral-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-neutral-800 disabled:opacity-50"
          >
            {loading ? "..." : "↻ Actualiser"}
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
            <p className="text-sm font-bold text-red-600">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          </div>
        ) : picks.length === 0 ? (
          <div className="rounded-3xl bg-white border border-neutral-200 py-16 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-50">
              <span className="text-4xl">✨</span>
            </div>
            <p className="text-base font-bold text-neutral-700">Aucun pick à résoudre</p>
            <p className="mt-2 text-sm text-neutral-500">
              Tous les picks dont le match est passé sont déjà résolus.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {picks.map((pick) => (
              <div
                key={pick.id}
                className="rounded-2xl bg-white border border-neutral-200 p-4 shadow-sm"
              >
                {/* Header */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  {pick.classic_number && (
                    <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      IA-{String(pick.classic_number).padStart(4, "0")}
                    </span>
                  )}
                  <span className="rounded bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-700">
                    {pick.sport}
                  </span>
                  <span className="rounded bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-600">
                    {pick.league}
                  </span>
                  {pick.market && (
                    <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                      {pick.market}
                    </span>
                  )}
                  <span className="ml-auto text-[11px] font-semibold text-neutral-500">
                    {formatDateTime(pick.event_date)}
                  </span>
                </div>

                {/* Match info */}
                <div className="mb-3">
                  <p className="text-base font-extrabold text-neutral-900">{pick.event_name}</p>
                  <p className="mt-1 text-sm text-neutral-600">
                    <span className="font-bold text-emerald-700">{pick.selection}</span>
                    <span className="text-neutral-400"> · cote </span>
                    <span className="font-mono font-bold text-neutral-900">{Number(pick.odds).toFixed(2)}</span>
                    <span className="text-neutral-400"> · stake </span>
                    <span className="font-bold text-neutral-700">{pick.stake}U</span>
                  </p>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-5 gap-2">
                  {STATUS_OPTIONS.map((s) => {
                    const isLoading = resolvingId === pick.id;
                    return (
                      <button
                        key={s.v}
                        onClick={() => setPendingAction({ pickId: pick.id, status: s.v })}
                        disabled={isLoading}
                        className={`cursor-pointer rounded-xl px-2 py-2.5 text-[11px] font-bold transition disabled:opacity-30 disabled:cursor-not-allowed ${
                          s.color === "emerald"
                            ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            : s.color === "red"
                            ? "bg-red-50 text-red-700 hover:bg-red-100"
                            : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                        }`}
                      >
                        <span className="block text-base">{s.icon}</span>
                        <span className="mt-0.5 block">{s.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirm modal */}
      {pendingAction && (() => {
        const pick = picks.find((p) => p.id === pendingAction.pickId);
        const statusOpt = STATUS_OPTIONS.find((s) => s.v === pendingAction.status);
        if (!pick || !statusOpt) return null;
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={() => setPendingAction(null)}
          >
            <div
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                Confirmer la résolution
              </p>
              <p className="mt-2 text-base font-extrabold text-neutral-900">{pick.event_name}</p>
              <p className="mt-1 text-sm text-neutral-600">
                {pick.selection} @ {Number(pick.odds).toFixed(2)}
              </p>

              <div className="mt-4 rounded-xl bg-neutral-50 p-4 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  Tu vas marquer ce pick comme
                </p>
                <p
                  className={`mt-1 text-2xl font-black ${
                    statusOpt.color === "emerald"
                      ? "text-emerald-600"
                      : statusOpt.color === "red"
                      ? "text-red-600"
                      : "text-neutral-600"
                  }`}
                >
                  {statusOpt.icon} {statusOpt.label}
                </p>
              </div>

              <p className="mt-3 text-[11px] text-neutral-400 text-center">
                Cette action est irréversible.
              </p>

              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPendingAction(null)}
                  className="cursor-pointer rounded-xl bg-neutral-100 py-3 text-sm font-bold text-neutral-700 transition hover:bg-neutral-200"
                >
                  Annuler
                </button>
                <button
                  onClick={confirmResolve}
                  className="cursor-pointer rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white transition hover:bg-emerald-500"
                >
                  Confirmer
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </main>
  );
}