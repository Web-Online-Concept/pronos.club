"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface AccountingData {
  transactions: number;
  totalBrut: number;
  totalFees: number;
  totalNet: number;
  partFlorent: number;
  partJerome: number;
  paidFlorent: number;
  paidJerome: number;
  dueFlorent: number;
  dueJerome: number;
}

interface PartnerPayment {
  id: string;
  partner: string;
  amount: number;
  method: string;
  note: string | null;
  paid_at: string;
}

export default function AdminComptabilitePage() {
  const { locale } = useParams();
  const [data, setData] = useState<AccountingData | null>(null);
  const [allTimeData, setAllTimeData] = useState<AccountingData | null>(null);
  const [partnerPayments, setPartnerPayments] = useState<PartnerPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState("");

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formPartner, setFormPartner] = useState("florent");
  const [formAmount, setFormAmount] = useState("");
  const [formMethod, setFormMethod] = useState("virement");
  const [formNote, setFormNote] = useState("");
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ type: "accounting" });
      if (month) params.set("month", month);
      const res = await fetch(`/api/admin/accounting?${params}`);
      setData(await res.json());

      // Always fetch all-time too
      const allRes = await fetch("/api/admin/accounting?type=accounting");
      setAllTimeData(await allRes.json());

      const ppParams = new URLSearchParams({ type: "partner-payments" });
      if (month) ppParams.set("month", month);
      const ppRes = await fetch(`/api/admin/accounting?${ppParams}`);
      setPartnerPayments(await ppRes.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, [month]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fmt = (cents: number) => (cents / 100).toFixed(2) + " €";
  const fmtDate = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });

  const handleAddPayment = async () => {
    if (!formAmount || parseFloat(formAmount) <= 0) { alert("Montant invalide"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/accounting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partner: formPartner,
          amount: Math.round(parseFloat(formAmount) * 100), // Convert € to cents
          method: formMethod,
          note: formNote.trim() || null,
          paid_at: new Date(formDate).toISOString(),
        }),
      });
      const result = await res.json();
      if (result.error) alert("Erreur : " + result.error);
      else {
        setShowForm(false);
        setFormAmount("");
        setFormNote("");
        fetchData();
      }
    } catch { alert("Erreur"); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer ce versement ?")) return;
    await fetch(`/api/admin/accounting?id=${id}`, { method: "DELETE" });
    fetchData();
  };

  const methodLabel = (m: string) => m === "paypal" ? "PayPal" : m === "virement" ? "Virement" : "Autre";

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0a0a0f]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-emerald-500" />
      </main>
    );
  }

  const d = data || { transactions: 0, totalBrut: 0, totalFees: 0, totalNet: 0, partFlorent: 0, partJerome: 0, paidFlorent: 0, paidJerome: 0, dueFlorent: 0, dueJerome: 0 };
  const a = allTimeData || d;

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="border-b border-white/[0.06] bg-[#0d0d14]">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <Link href={`/${locale}/admin`} className="mb-2 inline-block text-xs text-white/30 hover:text-white/60 transition">← Dashboard admin</Link>
          <h1 className="text-2xl font-bold">Comptabilité</h1>
          <p className="mt-1 text-sm text-white/40">Revenus, frais et partage 50/50</p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Month filter */}
        <div className="mb-6 flex items-center gap-4">
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-white/30">Période</label>
            <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="rounded-lg border border-white/10 bg-[#1a1a2e] px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none" />
          </div>
          {month && <button onClick={() => setMonth("")} className="cursor-pointer mt-5 text-xs text-white/40 hover:text-white/60">Tout afficher</button>}
        </div>

        {/* Revenue overview */}
        <div className="mb-8">
          <h2 className="mb-4 text-sm font-semibold text-white/60">{month ? `Revenus — ${new Date(month + "-01").toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}` : "Revenus — Tout le temps"}</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-[10px] font-medium uppercase tracking-wider text-white/30">Revenus bruts</p>
              <p className="mt-1 text-2xl font-bold">{fmt(d.totalBrut)}</p>
              <p className="mt-1 text-xs text-white/30">{d.transactions} transaction{d.transactions > 1 ? "s" : ""}</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-[10px] font-medium uppercase tracking-wider text-white/30">Frais Stripe</p>
              <p className="mt-1 text-2xl font-bold text-red-400">-{fmt(d.totalFees)}</p>
            </div>
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-400/60">Revenus nets</p>
              <p className="mt-1 text-2xl font-bold text-emerald-400">{fmt(d.totalNet)}</p>
            </div>
          </div>
        </div>

        {/* Partner split */}
        <div className="mb-8">
          <h2 className="mb-4 text-sm font-semibold text-white/60">Partage 50/50</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Florent */}
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-5">
              <p className="text-sm font-bold text-blue-400">Florent</p>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <div>
                  <p className="text-[10px] uppercase text-white/30">Part (50%)</p>
                  <p className="mt-0.5 text-lg font-bold">{fmt(d.partFlorent)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-white/30">Versé</p>
                  <p className="mt-0.5 text-lg font-bold text-emerald-400">{fmt(d.paidFlorent)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-white/30">Reste dû</p>
                  <p className={`mt-0.5 text-lg font-bold ${d.dueFlorent > 0 ? "text-amber-400" : "text-emerald-400"}`}>{fmt(d.dueFlorent)}</p>
                </div>
              </div>
            </div>

            {/* Jérôme */}
            <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-5">
              <p className="text-sm font-bold text-purple-400">Jérôme</p>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <div>
                  <p className="text-[10px] uppercase text-white/30">Part (50%)</p>
                  <p className="mt-0.5 text-lg font-bold">{fmt(d.partJerome)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-white/30">Versé</p>
                  <p className="mt-0.5 text-lg font-bold text-emerald-400">{fmt(d.paidJerome)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-white/30">Reste dû</p>
                  <p className={`mt-0.5 text-lg font-bold ${d.dueJerome > 0 ? "text-amber-400" : "text-emerald-400"}`}>{fmt(d.dueJerome)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* All-time totals if filtered by month */}
        {month && (
          <div className="mb-8 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-white/30">Cumul total (depuis le début)</p>
            <div className="mt-2 flex gap-8 text-sm">
              <span>Net total : <strong className="text-emerald-400">{fmt(a.totalNet)}</strong></span>
              <span>Versé Florent : <strong>{fmt(a.paidFlorent)}</strong></span>
              <span>Versé Jérôme : <strong>{fmt(a.paidJerome)}</strong></span>
              <span>Dû Florent : <strong className={a.dueFlorent > 0 ? "text-amber-400" : "text-emerald-400"}>{fmt(a.dueFlorent)}</strong></span>
              <span>Dû Jérôme : <strong className={a.dueJerome > 0 ? "text-amber-400" : "text-emerald-400"}>{fmt(a.dueJerome)}</strong></span>
            </div>
          </div>
        )}

        {/* Partner payments */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white/60">Versements aux associés</h2>
            <button onClick={() => setShowForm(!showForm)} className="cursor-pointer rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold hover:bg-emerald-500 transition">
              {showForm ? "Annuler" : "+ Nouveau versement"}
            </button>
          </div>

          {/* Add form */}
          {showForm && (
            <div className="mb-6 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="grid gap-4 sm:grid-cols-5">
                <div>
                  <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-white/30">Bénéficiaire</label>
                  <select value={formPartner} onChange={e => setFormPartner(e.target.value)} className="w-full rounded-lg border border-white/10 bg-[#1a1a2e] px-3 py-2 text-sm text-white focus:outline-none">
                    <option value="florent" className="bg-[#1a1a2e]">Florent</option>
                    <option value="jerome" className="bg-[#1a1a2e]">Jérôme</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-white/30">Montant (€)</label>
                  <input type="number" step="0.01" value={formAmount} onChange={e => setFormAmount(e.target.value)} placeholder="100.00" className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-white/30">Méthode</label>
                  <select value={formMethod} onChange={e => setFormMethod(e.target.value)} className="w-full rounded-lg border border-white/10 bg-[#1a1a2e] px-3 py-2 text-sm text-white focus:outline-none">
                    <option value="virement" className="bg-[#1a1a2e]">Virement</option>
                    <option value="paypal" className="bg-[#1a1a2e]">PayPal</option>
                    <option value="autre" className="bg-[#1a1a2e]">Autre</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-white/30">Date</label>
                  <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} className="w-full rounded-lg border border-white/10 bg-[#1a1a2e] px-3 py-2 text-sm text-white focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-white/30">Note</label>
                  <input type="text" value={formNote} onChange={e => setFormNote(e.target.value)} placeholder="Optionnel" className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none" />
                </div>
              </div>
              <button onClick={handleAddPayment} disabled={saving} className="cursor-pointer mt-4 rounded-lg bg-emerald-600 px-6 py-2 text-sm font-semibold hover:bg-emerald-500 transition disabled:opacity-50">
                {saving ? "..." : "Enregistrer le versement"}
              </button>
            </div>
          )}

          {/* List */}
          {partnerPayments.length === 0 ? (
            <p className="text-center text-sm text-white/30 py-8">Aucun versement enregistré</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                    <th className="px-4 py-3 text-left text-[10px] font-medium uppercase tracking-wider text-white/30">Date</th>
                    <th className="px-4 py-3 text-left text-[10px] font-medium uppercase tracking-wider text-white/30">Bénéficiaire</th>
                    <th className="px-4 py-3 text-right text-[10px] font-medium uppercase tracking-wider text-white/30">Montant</th>
                    <th className="px-4 py-3 text-center text-[10px] font-medium uppercase tracking-wider text-white/30">Méthode</th>
                    <th className="px-4 py-3 text-left text-[10px] font-medium uppercase tracking-wider text-white/30">Note</th>
                    <th className="px-4 py-3 text-center text-[10px] font-medium uppercase tracking-wider text-white/30"></th>
                  </tr>
                </thead>
                <tbody>
                  {partnerPayments.map(pp => (
                    <tr key={pp.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                      <td className="px-4 py-3 text-xs text-white/60">{fmtDate(pp.paid_at)}</td>
                      <td className="px-4 py-3 text-xs">
                        <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${pp.partner === "florent" ? "bg-blue-500/20 text-blue-400" : "bg-purple-500/20 text-purple-400"}`}>
                          {pp.partner === "florent" ? "Florent" : "Jérôme"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-medium text-emerald-400">{fmt(pp.amount)}</td>
                      <td className="px-4 py-3 text-center text-xs text-white/50">{methodLabel(pp.method)}</td>
                      <td className="px-4 py-3 text-xs text-white/40">{pp.note || "—"}</td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => handleDelete(pp.id)} className="cursor-pointer text-xs text-red-400/50 hover:text-red-400 transition">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}