// src/app/[locale]/(admin)/admin/pronos-abonnes/config/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import AdminPronosAbonnesNav from "@/components/admin/AdminPronosAbonnesNav";

type Config = {
  prize_amount: number;
  min_picks: number;
  active: boolean;
  scheduled_prize_amount: number | null;
  scheduled_min_picks: number | null;
  scheduled_active: boolean | null;
  scheduled_effective_date: string | null;
};

type HistoryEntry = {
  id: string;
  period_type: "week" | "month";
  prize_amount: number;
  min_picks: number;
  active: boolean;
  effective_from: string;
  effective_to: string | null;
  created_at: string;
};

export default function AdminConcoursConfigPage() {
  const { user } = useAuth();
  const isAdmin = user?.is_admin === true;

  const [week, setWeek] = useState<Config>({
    prize_amount: 10, min_picks: 3, active: true,
    scheduled_prize_amount: null, scheduled_min_picks: null, scheduled_active: null, scheduled_effective_date: null,
  });
  const [month, setMonth] = useState<Config>({
    prize_amount: 40, min_picks: 10, active: true,
    scheduled_prize_amount: null, scheduled_min_picks: null, scheduled_active: null, scheduled_effective_date: null,
  });
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ id: string; text: string; type: "ok" | "err" } | null>(null);

  // Form state pour les champs (indépendant de la config actuelle)
  const [formWeek, setFormWeek] = useState<{ prize_amount: number; min_picks: number; active: boolean }>({ prize_amount: 10, min_picks: 3, active: true });
  const [formMonth, setFormMonth] = useState<{ prize_amount: number; min_picks: number; active: boolean }>({ prize_amount: 40, min_picks: 10, active: true });

  async function fetchAll() {
    setLoading(true);
    const [configRes, historyRes] = await Promise.all([
      fetch("/api/tipster-concours-config?mode=full"),
      fetch("/api/tipster-concours-config?mode=history"),
    ]);
    const configData = await configRes.json();
    const historyData = await historyRes.json();

    if (configData.week) {
      setWeek(configData.week);
      setFormWeek({
        prize_amount: configData.week.prize_amount,
        min_picks: configData.week.min_picks,
        active: configData.week.active,
      });
    }
    if (configData.month) {
      setMonth(configData.month);
      setFormMonth({
        prize_amount: configData.month.prize_amount,
        min_picks: configData.month.min_picks,
        active: configData.month.active,
      });
    }
    setHistory(historyData.history || []);
    setLoading(false);
  }

  useEffect(() => {
    if (isAdmin) fetchAll();
  }, [isAdmin]);

  async function handleAction(period_type: "week" | "month", action: "update" | "schedule" | "cancel_schedule") {
    const actionId = `${period_type}-${action}`;
    setSaving(actionId);
    setMessage(null);

    const form = period_type === "week" ? formWeek : formMonth;

    const body: any = { period_type, action };
    if (action !== "cancel_schedule") {
      body.prize_amount = form.prize_amount;
      body.min_picks = form.min_picks;
      body.active = form.active;
    }

    const res = await fetch("/api/tipster-concours-config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await res.json();
    setSaving(null);

    if (result.error) {
      setMessage({ id: actionId, text: `❌ ${result.error}`, type: "err" });
      return;
    }

    const okText =
      action === "schedule" ? "✓ Changement programmé !" :
      action === "cancel_schedule" ? "✓ Programmation annulée" :
      "✓ Enregistré !";
    setMessage({ id: actionId, text: okText, type: "ok" });
    setTimeout(() => setMessage(null), 3000);

    fetchAll();
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
    form,
    setForm,
    color,
    icon,
    title,
  }: {
    type: "week" | "month";
    config: Config;
    form: { prize_amount: number; min_picks: number; active: boolean };
    setForm: (v: { prize_amount: number; min_picks: number; active: boolean }) => void;
    color: "emerald" | "amber";
    icon: string;
    title: string;
  }) {
    const colorClasses = color === "emerald"
      ? { border: "border-emerald-300", bg: "bg-emerald-50", text: "text-emerald-700", primary: "bg-emerald-600 hover:bg-emerald-500", secondary: "bg-white border-emerald-300 text-emerald-700 hover:bg-emerald-50" }
      : { border: "border-amber-300", bg: "bg-amber-50", text: "text-amber-700", primary: "bg-amber-600 hover:bg-amber-500", secondary: "bg-white border-amber-300 text-amber-700 hover:bg-amber-50" };

    const hasScheduled = !!config.scheduled_effective_date;
    const scheduledDate = config.scheduled_effective_date
      ? new Date(config.scheduled_effective_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
      : "";

    const msgHere = message && (message.id === `${type}-update` || message.id === `${type}-schedule` || message.id === `${type}-cancel_schedule`);

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
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            <span className="ml-2 text-xs font-bold text-neutral-700">{form.active ? "Actif" : "Désactivé"}</span>
          </label>
        </div>

        {/* Banner valeur actuelle */}
        <div className="mb-4 rounded-xl bg-neutral-50 border border-neutral-200 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Valeur actuellement active</p>
          <p className="mt-1 text-sm font-bold text-neutral-900">
            {config.prize_amount}€ · min {config.min_picks} picks · {config.active ? "actif" : "désactivé"}
          </p>
        </div>

        {/* Banner valeur programmée */}
        {hasScheduled && (
          <div className="mb-4 rounded-xl bg-blue-50 border border-blue-300 px-4 py-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">📅 Changement programmé</p>
                <p className="mt-1 text-sm font-bold text-blue-900">
                  {config.scheduled_prize_amount ?? config.prize_amount}€ ·
                  min {config.scheduled_min_picks ?? config.min_picks} picks ·
                  {(config.scheduled_active ?? config.active) ? " actif" : " désactivé"}
                </p>
                <p className="mt-0.5 text-[11px] text-blue-700">
                  Entrera en vigueur le <strong>{scheduledDate}</strong>
                </p>
              </div>
              <button
                onClick={() => handleAction(type, "cancel_schedule")}
                disabled={saving === `${type}-cancel_schedule`}
                className="cursor-pointer text-[11px] font-bold text-red-500 hover:text-red-700 disabled:opacity-50"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

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
                value={form.prize_amount}
                onChange={(e) => setForm({ ...form, prize_amount: parseFloat(e.target.value) || 0 })}
                className="flex-1 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-lg font-extrabold text-neutral-900 outline-none focus:border-emerald-500"
              />
              <span className="text-2xl font-black text-neutral-400">€</span>
            </div>
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
                value={form.min_picks}
                onChange={(e) => setForm({ ...form, min_picks: parseInt(e.target.value, 10) || 1 })}
                className="flex-1 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-lg font-extrabold text-neutral-900 outline-none focus:border-emerald-500"
              />
              <span className="text-xs font-bold text-neutral-500">picks</span>
            </div>
          </div>
        </div>

        {/* Message feedback */}
        {msgHere && (
          <div className={`mt-4 rounded-lg px-3 py-2 text-xs font-bold ${
            message.type === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
          }`}>
            {message.text}
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            onClick={() => handleAction(type, "update")}
            disabled={saving === `${type}-update`}
            className={`cursor-pointer rounded-xl ${colorClasses.primary} py-3 text-sm font-bold text-white transition disabled:opacity-50`}
          >
            {saving === `${type}-update` ? "..." : "💾 Appliquer maintenant"}
          </button>
          <button
            onClick={() => handleAction(type, "schedule")}
            disabled={saving === `${type}-schedule`}
            className={`cursor-pointer rounded-xl border-2 ${colorClasses.secondary} py-3 text-sm font-bold transition disabled:opacity-50`}
          >
            {saving === `${type}-schedule` ? "..." : "📅 Programmer pour la prochaine période"}
          </button>
        </div>

        <p className="mt-3 text-[11px] text-neutral-400 text-center">
          {type === "week"
            ? "Prochaine période : lundi prochain 00h00"
            : "Prochaine période : 1er du mois prochain 00h00"}
        </p>
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
                form={formWeek}
                setForm={setFormWeek}
                color="emerald"
                icon="🏆"
                title="Semaine"
              />
              <PeriodCard
                type="month"
                config={month}
                form={formMonth}
                setForm={setFormMonth}
                color="amber"
                icon="👑"
                title="Mois"
              />
            </div>

            {/* Notes */}
            <div className="mt-8 rounded-2xl bg-white border border-neutral-200 p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-3">
                ℹ️ Notes importantes
              </p>
              <ul className="space-y-2 text-sm text-neutral-600">
                <li>• <strong>Appliquer maintenant</strong> : le changement prend effet immédiatement sur la période en cours.</li>
                <li>• <strong>Programmer pour la prochaine période</strong> : le changement s&apos;appliquera automatiquement au début de la prochaine semaine (lundi 00h00) ou du prochain mois (1er 00h00).</li>
                <li>• Les gagnants <strong>déjà enregistrés</strong> gardent le montant initial de leur période. Seuls les prochains gagnants auront le nouveau montant.</li>
                <li>• Programmer écrase toute valeur précédemment programmée pour cette période.</li>
                <li>• Désactiver un concours empêche les crons de calculer un gagnant pour cette période.</li>
              </ul>
            </div>

            {/* Historique */}
            <div className="mt-8 rounded-2xl bg-white border border-neutral-200 p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-3">
                📜 Historique des changements ({history.length})
              </p>
              {history.length === 0 ? (
                <p className="text-sm text-neutral-400 italic">Aucun changement enregistré</p>
              ) : (
                <div className="space-y-2">
                  {history.map((h) => {
                    const isCurrent = h.effective_to === null;
                    const from = new Date(h.effective_from).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
                    const to = h.effective_to ? new Date(h.effective_to).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : null;

                    return (
                      <div key={h.id} className={`rounded-lg border px-4 py-3 flex items-center justify-between flex-wrap gap-2 ${
                        isCurrent ? "bg-emerald-50 border-emerald-200" : "bg-neutral-50 border-neutral-200"
                      }`}>
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{h.period_type === "week" ? "🏆" : "👑"}</span>
                          <div>
                            <p className="text-sm font-bold text-neutral-900">
                              {Number(h.prize_amount)}€ · min {h.min_picks} picks · {h.active ? "actif" : "désactivé"}
                              {isCurrent && <span className="ml-2 text-[10px] font-black text-emerald-600 uppercase">Actuel</span>}
                            </p>
                            <p className="text-[11px] text-neutral-500 mt-0.5">
                              {to ? `Du ${from} au ${to}` : `Depuis le ${from}`}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}