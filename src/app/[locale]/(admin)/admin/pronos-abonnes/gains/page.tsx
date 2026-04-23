// src/app/[locale]/(admin)/admin/pronos-abonnes/gains/page.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { useAuth } from "@/components/auth/AuthProvider";

type Winner = {
  id: string;
  user_id: string;
  period_type: "week" | "month";
  period_start: string;
  period_end: string;
  total_units: number;
  picks_count: number;
  prize_amount: number;
  paid: boolean;
  paid_at: string | null;
  paid_note: string | null;
  created_at: string;
  users: {
    id: string;
    pseudo: string;
    avatar_url: string | null;
    email: string;
    paypal_email: string | null;
  } | null;
};

export default function AdminGainsPage() {
  const { user } = useAuth();
  const locale = useLocale();
  const isAdmin = user?.is_admin === true;

  const [winners, setWinners] = useState<Winner[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unpaid" | "paid">("unpaid");
  const [noteInput, setNoteInput] = useState<{ [id: string]: string }>({});
  const [calculating, setCalculating] = useState<"week" | "month" | null>(null);

  async function fetchData() {
    setLoading(true);
    const res = await fetch("/api/admin/tipster-concours");
    const data = await res.json();
    setWinners(data.winners || []);
    setLoading(false);
  }

  useEffect(() => {
    if (isAdmin) fetchData();
  }, [isAdmin]);

  async function markAsPaid(winnerId: string, paid: boolean) {
    const note = noteInput[winnerId] || "";
    const res = await fetch("/api/admin/tipster-concours", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ winner_id: winnerId, paid, paid_note: note }),
    });
    const data = await res.json();
    if (data.error) {
      alert(data.error);
      return;
    }
    fetchData();
  }

  async function calculateNow(periodType: "week" | "month") {
    if (!confirm(`Calculer maintenant le gagnant de la ${periodType === "week" ? "semaine précédente" : "mois précédent"} ?`)) return;
    setCalculating(periodType);
    const res = await fetch("/api/admin/tipster-concours", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "calculate", period_type: periodType }),
    });
    const data = await res.json();
    setCalculating(null);
    if (data.error) {
      alert(data.error);
      return;
    }
    if (data.skipped) {
      alert(`Skipped : ${data.reason}`);
      return;
    }
    alert("Gagnant calculé et enregistré !");
    fetchData();
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-neutral-500">Accès admin uniquement</p>
      </main>
    );
  }

  const filtered = winners.filter((w) => {
    if (filter === "unpaid") return !w.paid;
    if (filter === "paid") return w.paid;
    return true;
  });

  const totalUnpaid = winners.filter((w) => !w.paid).reduce((sum, w) => sum + Number(w.prize_amount), 0);
  const totalPaid = winners.filter((w) => w.paid).reduce((sum, w) => sum + Number(w.prize_amount), 0);

  function formatPeriod(start: string, end: string, type: "week" | "month") {
    const s = new Date(start);
    const e = new Date(end);
    if (type === "month") {
      return s.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    }
    return `${s.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} → ${e.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}`;
  }

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="bg-white border-b border-neutral-200">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.3em] text-emerald-600">
                🔒 Admin
              </p>
              <h1 className="mt-1 text-2xl font-black text-neutral-900">Gains Pronos Abonnés</h1>
              <p className="mt-1 text-sm text-neutral-500">
                Suivi des versements PayPal aux gagnants du concours
              </p>
            </div>
            <Link
              href={`/${locale}/admin`}
              className="text-sm font-bold text-neutral-500 hover:text-neutral-900"
            >
              ← Admin
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <div className="rounded-xl bg-white border border-neutral-200 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Total gagnants</p>
            <p className="mt-1 text-2xl font-black text-neutral-900">{winners.length}</p>
          </div>
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">À payer</p>
            <p className="mt-1 text-2xl font-black text-amber-700">{totalUnpaid.toFixed(2)} €</p>
          </div>
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Déjà payé</p>
            <p className="mt-1 text-2xl font-black text-emerald-700">{totalPaid.toFixed(2)} €</p>
          </div>
        </div>

        {/* Actions admin */}
        <div className="rounded-xl bg-white border border-neutral-200 p-4 mb-6">
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-3">
            Calcul manuel des gagnants
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => calculateNow("week")}
              disabled={calculating === "week"}
              className="cursor-pointer rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {calculating === "week" ? "Calcul..." : "🏆 Calculer gagnant semaine précédente"}
            </button>
            <button
              onClick={() => calculateNow("month")}
              disabled={calculating === "month"}
              className="cursor-pointer rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-500 disabled:opacity-50"
            >
              {calculating === "month" ? "Calcul..." : "👑 Calculer gagnant mois précédent"}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-neutral-400">
            Les crons automatiques tournent chaque lundi 00h15 (semaine) et le 1er du mois 00h30 (mois). Les boutons ci-dessus sont utiles si un cron a échoué.
          </p>
        </div>

        {/* Filter */}
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => setFilter("unpaid")}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
              filter === "unpaid" ? "bg-neutral-900 text-white" : "bg-white text-neutral-600 border border-neutral-200"
            }`}
          >
            À payer ({winners.filter((w) => !w.paid).length})
          </button>
          <button
            onClick={() => setFilter("paid")}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
              filter === "paid" ? "bg-neutral-900 text-white" : "bg-white text-neutral-600 border border-neutral-200"
            }`}
          >
            Payés ({winners.filter((w) => w.paid).length})
          </button>
          <button
            onClick={() => setFilter("all")}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
              filter === "all" ? "bg-neutral-900 text-white" : "bg-white text-neutral-600 border border-neutral-200"
            }`}
          >
            Tous ({winners.length})
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl bg-white border border-neutral-200 py-16 text-center">
            <p className="text-neutral-500 text-sm">
              {filter === "unpaid" ? "Aucun gain à payer actuellement" : "Aucun gagnant"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((w) => (
              <div key={w.id} className="rounded-2xl bg-white border border-neutral-200 p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4">
                  <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl text-xl ${
                    w.period_type === "week" ? "bg-emerald-100" : "bg-amber-100"
                  }`}>
                    {w.period_type === "week" ? "🏆" : "👑"}
                  </div>

                  <div className="flex-1 min-w-0 mt-2 sm:mt-0">
                    <p className="font-extrabold text-neutral-900 truncate">
                      {w.users?.pseudo || "?"}
                      <span className="ml-2 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                        {w.period_type === "week" ? "Semaine" : "Mois"}
                      </span>
                    </p>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {formatPeriod(w.period_start, w.period_end, w.period_type)} · +{w.total_units}U · {w.picks_count} picks
                    </p>
                    <div className="mt-1 text-xs text-neutral-600">
                      <span className="font-bold">Email :</span> {w.users?.email || "-"}
                    </div>
                    <div className="text-xs">
                      <span className="font-bold text-neutral-600">PayPal :</span>{" "}
                      {w.users?.paypal_email ? (
                        <span className="text-emerald-600 font-semibold">{w.users.paypal_email}</span>
                      ) : (
                        <span className="text-red-500 font-semibold">⚠️ Non renseigné</span>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 sm:mt-0 text-right">
                    <p className={`text-2xl font-black ${
                      w.period_type === "week" ? "text-emerald-600" : "text-amber-600"
                    }`}>
                      {w.prize_amount}€
                    </p>
                    {w.paid ? (
                      <p className="text-[10px] text-emerald-700 font-bold mt-0.5">
                        ✓ Payé le {w.paid_at ? new Date(w.paid_at).toLocaleDateString("fr-FR") : "-"}
                      </p>
                    ) : null}
                  </div>
                </div>

                {/* Action zone */}
                {!w.paid ? (
                  <div className="mt-4 pt-4 border-t border-neutral-100 flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      placeholder="Note (ex: Viré PayPal le 28/04, ref 12345)"
                      value={noteInput[w.id] || ""}
                      onChange={(e) => setNoteInput({ ...noteInput, [w.id]: e.target.value })}
                      className="flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                    />
                    <button
                      onClick={() => markAsPaid(w.id, true)}
                      className="cursor-pointer rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500"
                    >
                      ✓ Marquer payé
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center justify-between">
                    {w.paid_note && (
                      <p className="text-xs text-neutral-500 italic">
                        📝 {w.paid_note}
                      </p>
                    )}
                    <button
                      onClick={() => markAsPaid(w.id, false)}
                      className="cursor-pointer text-[11px] font-bold text-neutral-400 hover:text-red-500 ml-auto"
                    >
                      Annuler le paiement
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}