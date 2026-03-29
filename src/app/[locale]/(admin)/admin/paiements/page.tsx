"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface Payment {
  id: string;
  user_id: string;
  stripe_payment_id: string;
  stripe_invoice_id: string;
  amount: number;
  currency: string;
  stripe_fee: number;
  net_amount: number;
  status: string;
  paid_at: string;
  users: { email: string; pseudo: string | null; display_name: string | null } | null;
}

export default function AdminPaiementsPage() {
  const { locale } = useParams();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState("");

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ type: "payments" });
    if (month) params.set("month", month);
    try {
      const res = await fetch(`/api/admin/accounting?${params}`);
      const data = await res.json();
      setPayments(Array.isArray(data) ? data : []);
    } catch { setPayments([]); }
    setLoading(false);
  }, [month]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const fmt = (cents: number) => (cents / 100).toFixed(2) + " €";
  const fmtDate = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const totalBrut = payments.filter(p => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const totalFees = payments.filter(p => p.status === "paid").reduce((s, p) => s + (p.stripe_fee || 0), 0);
  const totalNet = payments.filter(p => p.status === "paid").reduce((s, p) => s + (p.net_amount || 0), 0);

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="border-b border-white/[0.06] bg-[#0d0d14]">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <Link href={`/${locale}/admin`} className="mb-2 inline-block text-xs text-white/30 hover:text-white/60 transition">← Dashboard admin</Link>
          <h1 className="text-2xl font-bold">Paiements</h1>
          <p className="mt-1 text-sm text-white/40">{payments.length} transaction{payments.length > 1 ? "s" : ""}</p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Filters */}
        <div className="mb-6 flex items-center gap-4">
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-white/30">Mois</label>
            <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="rounded-lg border border-white/10 bg-[#1a1a2e] px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none" />
          </div>
          {month && (
            <button onClick={() => setMonth("")} className="cursor-pointer mt-5 text-xs text-white/40 hover:text-white/60">Tout afficher</button>
          )}
        </div>

        {/* Summary cards */}
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-white/30">Revenus bruts</p>
            <p className="mt-1 text-2xl font-bold text-white">{fmt(totalBrut)}</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-white/30">Frais Stripe</p>
            <p className="mt-1 text-2xl font-bold text-red-400">-{fmt(totalFees)}</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-white/30">Revenus nets</p>
            <p className="mt-1 text-2xl font-bold text-emerald-400">{fmt(totalNet)}</p>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-emerald-500" /></div>
        ) : payments.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <p className="text-4xl">💳</p>
            <p className="mt-4 text-lg text-white/60">Aucun paiement</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                  <th className="px-4 py-3 text-left text-[10px] font-medium uppercase tracking-wider text-white/30">Date</th>
                  <th className="px-4 py-3 text-left text-[10px] font-medium uppercase tracking-wider text-white/30">Client</th>
                  <th className="px-4 py-3 text-right text-[10px] font-medium uppercase tracking-wider text-white/30">Brut</th>
                  <th className="px-4 py-3 text-right text-[10px] font-medium uppercase tracking-wider text-white/30">Frais</th>
                  <th className="px-4 py-3 text-right text-[10px] font-medium uppercase tracking-wider text-white/30">Net</th>
                  <th className="px-4 py-3 text-center text-[10px] font-medium uppercase tracking-wider text-white/30">Statut</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-xs text-white/60">{fmtDate(p.paid_at)}</td>
                    <td className="px-4 py-3 text-xs">
                      <span className="font-medium text-white">{p.users?.pseudo || p.users?.display_name || "—"}</span>
                      <br />
                      <span className="text-white/40">{p.users?.email || "—"}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-white">{fmt(p.amount)}</td>
                    <td className="px-4 py-3 text-right text-xs text-red-400">-{fmt(p.stripe_fee || 0)}</td>
                    <td className="px-4 py-3 text-right text-xs font-medium text-emerald-400">{fmt(p.net_amount || 0)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                        p.status === "paid" ? "bg-emerald-500/20 text-emerald-400" :
                        p.status === "failed" ? "bg-red-500/20 text-red-400" :
                        "bg-amber-500/20 text-amber-400"
                      }`}>{p.status === "paid" ? "Payé" : p.status === "failed" ? "Échoué" : p.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}