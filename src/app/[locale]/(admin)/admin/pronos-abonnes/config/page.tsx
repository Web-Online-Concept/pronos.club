// src/app/[locale]/(admin)/admin/pronos-abonnes/config/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import AdminPronosAbonnesNav from "@/components/admin/AdminPronosAbonnesNav";

type Config = {
  prize_amount: number;
  min_picks: number;
  active: boolean;
};

export default function AdminConcoursConfigPage() {
  const { user } = useAuth();
  const isAdmin = user?.is_admin === true;

  const [week, setWeek] = useState<Config>({ prize_amount: 10, min_picks: 3, active: true });
  const [month, setMonth] = useState<Config>({ prize_amount: 40, min_picks: 10, active: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<"week" | "month" | null>(null);
  const [saved, setSaved] = useState<"week" | "month" | null>(null);

  async function fetchConfig() {
    setLoading(true);
    const res = await fetch("/api/tipster-concours-config");
    const data = await res.json();
    if (data.week) setWeek(data.week);
    if (data.month) setMonth(data.month);
    setLoading(false);
  }

  useEffect(() => {
    if (isAdmin) fetchConfig();
  }, [isAdmin]);

  async function handleSave(period_type: "week" | "month") {
    setSaving(period_type);
    setSaved(null);
    const data = period_type === "week" ? week : month;

    const res = await fetch("/api/tipster-concours-config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        period_type,
        prize_amount: data.prize_amount,
        min_picks: data.min_picks,
        active: data.active,
      }),
    });
    const result = await res.json();
    setSaving(null);
    if (result.error) {
      alert(result.error);
      return;
    }
    setSaved(period_type);
    setTimeout(() => setSaved(null), 3000);
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-neutral-500">Accès admin uniquement</p>
      </main>
    );
  }

  function PeriodCard({
    type,
    config,
    setConfig,
    color,
    icon,
    title,
  }: {
    type: "week" | "month";
    config: Config;
    setConfig: (c: Config) => void;
    color: "emerald" | "amber";
    icon: string;
    title: string;
  }) {
    const colorClasses = color === "emerald"
      ? { border: "border-emerald-300", bg: "bg-emerald-50", text: "text-emerald-700", button: "bg-emerald-600 hover:bg-emerald-500" }
      : { border: "border-amber-300", bg: "bg-amber-50", text: "text-amber-700", button: "bg-amber-600 hover:bg-amber-500" };

    return (
      <div className={`rounded-3xl bg-white border-2 ${colorClasses.border} p-6`}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className={`inline-flex items-center gap-2 ${colorClasses.bg} ${colorClasses.text} px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest`}>
              {icon} {title}
            </div>
            <h3 className="mt-2 text-xl font-black text-neutral-900">Concours {type === "week" ? "semaine" : "mois"}</h3>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config.active}
              onChange={(e) => setConfig({ ...config, active: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            <span className="ml-2 text-xs font-bold text-neutral-700">{config.active ? "Actif" : "Désactivé"}</span>
          </label>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-500">
              Montant du gain (€)
            </label>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                step="0.01"
                min="0"
                value={config.prize_amount}
                onChange={(e) => setConfig({ ...config, prize_amount: parseFloat(e.target.value) || 0 })}
                className="flex-1 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-lg font-extrabold text-neutral-900 outline-none focus:border-emerald-500"
              />
              <span className="text-2xl font-black text-neutral-400">€</span>
            </div>
            <p className="mt-1 text-[11px] text-neutral-400">
              Ce montant sera versé au gagnant via PayPal
            </p>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-500">
              Minimum de pronostics pour être éligible
            </label>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min="1"
                step="1"
                value={config.min_picks}
                onChange={(e) => setConfig({ ...config, min_picks: parseInt(e.target.value, 10) || 1 })}
                className="flex-1 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-lg font-extrabold text-neutral-900 outline-none focus:border-emerald-500"
              />
              <span className="text-xs font-bold text-neutral-500">picks</span>
            </div>
            <p className="mt-1 text-[11px] text-neutral-400">
              Les tipsters ayant moins de {config.min_picks} pronos ne pourront pas gagner
            </p>
          </div>
        </div>

        <button
          onClick={() => handleSave(type)}
          disabled={saving === type}
          className={`mt-6 w-full cursor-pointer rounded-xl ${colorClasses.button} py-3 text-sm font-bold text-white transition disabled:opacity-50`}
        >
          {saving === type ? "Enregistrement..." : saved === type ? "✓ Enregistré" : "Enregistrer"}
        </button>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="bg-white border-b border-neutral-200">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.3em] text-emerald-600">
                🔒 Admin · Pronos Abonnés
              </p>
              <h1 className="mt-1 text-2xl font-black text-neutral-900">Config du concours</h1>
              <p className="mt-1 text-sm text-neutral-500">
                Configure les montants et conditions du concours tipsters
              </p>
            </div>
            <AdminPronosAbonnesNav active="config" />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PeriodCard
                type="week"
                config={week}
                setConfig={setWeek}
                color="emerald"
                icon="🏆"
                title="Semaine"
              />
              <PeriodCard
                type="month"
                config={month}
                setConfig={setMonth}
                color="amber"
                icon="👑"
                title="Mois"
              />
            </div>

            <div className="mt-8 rounded-2xl bg-white border border-neutral-200 p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-3">
                ℹ️ Notes importantes
              </p>
              <ul className="space-y-2 text-sm text-neutral-600">
                <li>• Les changements s&apos;appliquent <strong>immédiatement</strong> sur toutes les pages du site (landing, concours, widgets).</li>
                <li>• Les gagnants déjà enregistrés gardent le montant initial de leur période. Seuls les prochains gagnants auront le nouveau montant.</li>
                <li>• Désactiver un concours empêche les crons de calculer un gagnant pour cette période.</li>
                <li>• La semaine se calcule du <strong>lundi 00h au dimanche 23h59</strong>, et le mois du <strong>1er au dernier jour</strong>.</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </main>
  );
}