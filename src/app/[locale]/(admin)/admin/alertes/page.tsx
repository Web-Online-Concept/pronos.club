"use client";

import { useState, useEffect } from "react";

interface AlertPref {
  id: string;
  user_id: string;
  alert_new_signup: boolean;
  alert_new_premium: boolean;
  alert_cancellation: boolean;
  user: { email: string; display_name: string } | { email: string; display_name: string }[];
}

const ALERT_TYPES = [
  { key: "alert_new_signup", label: "Nouvel inscrit gratuit", emoji: "👋", desc: "Email à chaque nouvelle inscription" },
  { key: "alert_new_premium", label: "Nouvel abonné Premium", emoji: "⭐", desc: "Email à chaque nouveau paiement Stripe" },
  { key: "alert_cancellation", label: "Résiliation Premium", emoji: "🚪", desc: "Email à chaque résiliation d'abonnement" },
];

export default function AdminAlertesPage() {
  const [prefs, setPrefs] = useState<AlertPref[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/alerts")
      .then((r) => r.json())
      .then((d) => { setPrefs(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function toggle(pref: AlertPref, key: string) {
    const updated = { ...pref, [key]: !(pref as unknown as Record<string, boolean>)[key] };
    setSaving(`${pref.user_id}-${key}`);

    await fetch("/api/admin/alerts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: pref.user_id,
        alert_new_signup: updated.alert_new_signup,
        alert_new_premium: updated.alert_new_premium,
        alert_cancellation: updated.alert_cancellation,
      }),
    });

    setPrefs((prev) => prev.map((p) => (p.user_id === pref.user_id ? updated : p)));
    setSaving(null);
  }

  function getUserInfo(pref: AlertPref) {
    const u = Array.isArray(pref.user) ? pref.user[0] : pref.user;
    return u ?? { email: "?", display_name: "?" };
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-center text-sm opacity-50">Chargement...</p>
      </main>
    );
  }

  return (
    <>
      {/* Hero */}
      <div
        className="border-b border-emerald-900/50"
        style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
      >
        <div className="mx-auto max-w-3xl px-4 py-10">
          <div className="text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-400">Administration</p>
            <h1 className="mt-2 text-3xl font-extrabold text-white">Alertes Admin</h1>
            <p className="mt-2 text-sm text-white/40">
              Configurez les notifications email pour chaque administrateur
            </p>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {/* Explanation */}
        <div className="mb-8 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm text-emerald-800">
            Chaque admin peut activer ou désactiver les alertes email qu&apos;il souhaite recevoir.
            Les emails sont envoyés automatiquement via Brevo.
          </p>
        </div>

        {/* One card per admin */}
        {prefs.length === 0 ? (
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-8 text-center">
            <p className="text-sm text-neutral-500">Aucune préférence configurée.</p>
            <p className="mt-1 text-xs text-neutral-400">
              Exécutez le SQL d&apos;initialisation pour ajouter les admins.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {prefs.map((pref) => {
              const u = getUserInfo(pref);
              return (
                <div
                  key={pref.user_id}
                  className="overflow-hidden rounded-2xl border border-white/[0.06]"
                  style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 100%)" }}
                >
                  {/* Admin header */}
                  <div className="flex items-center gap-3 border-b border-white/10 px-6 py-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 text-lg">
                      👤
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{u.display_name}</p>
                      <p className="text-xs text-white/40">{u.email}</p>
                    </div>
                  </div>

                  {/* Toggles */}
                  <div className="divide-y divide-white/5 px-6">
                    {ALERT_TYPES.map((alert) => {
                      const isOn = (pref as unknown as Record<string, boolean>)[alert.key];
                      const isSaving = saving === `${pref.user_id}-${alert.key}`;
                      return (
                        <div key={alert.key} className="flex items-center justify-between py-4">
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{alert.emoji}</span>
                            <div>
                              <p className="text-sm font-semibold text-white">{alert.label}</p>
                              <p className="text-xs text-white/30">{alert.desc}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => toggle(pref, alert.key)}
                            disabled={isSaving}
                            className={`relative h-7 w-12 rounded-full transition-colors duration-200 ${
                              isOn ? "bg-emerald-500" : "bg-neutral-600"
                            } ${isSaving ? "opacity-50" : "cursor-pointer"}`}
                          >
                            <span
                              className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform duration-200 ${
                                isOn ? "translate-x-5" : "translate-x-0"
                              }`}
                            />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}