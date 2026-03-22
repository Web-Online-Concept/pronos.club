"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";

const FEATURES = [
  { text: "Tous les pronostics premium", icon: "🎯" },
  { text: "Analyses détaillées du tipster", icon: "📊" },
  { text: "Screenshots des tickets", icon: "📸" },
  { text: "Notifications en temps réel", icon: "🔔" },
  { text: "Historique complet", icon: "📋" },
  { text: "Résiliable à tout moment", icon: "✅" },
];

export default function AbonnementPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const isPremium = user?.subscription_status === "active";

  async function handleSubscribe() {
    if (!user) {
      window.location.href = "/fr/login";
      return;
    }

    setLoading(true);

    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
    });

    const data = await res.json();

    if (data.url) {
      window.location.href = data.url;
    }

    setLoading(false);
  }

  async function handleManage() {
    setLoading(true);

    const res = await fetch("/api/stripe/portal", {
      method: "POST",
    });

    const data = await res.json();

    if (data.url) {
      window.location.href = data.url;
    }

    setLoading(false);
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-12">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Passez Premium</h1>
        <p className="mt-2 text-sm opacity-50">
          Accédez à tous les pronostics et analyses du tipster
        </p>
      </div>

      {/* Pricing card */}
      <div className="mt-8 rounded-2xl border-2 border-emerald-200 bg-white p-6 shadow-sm">
        <div className="text-center">
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
            PREMIUM
          </span>
          <div className="mt-4">
            <span className="text-5xl font-bold">20€</span>
            <span className="text-lg opacity-50">/mois</span>
          </div>
          <p className="mt-1 text-sm opacity-40">
            Sans engagement · Résiliable à tout moment
          </p>
        </div>

        {/* Features */}
        <div className="mt-6 space-y-3">
          {FEATURES.map((feature) => (
            <div key={feature.text} className="flex items-center gap-3">
              <span className="text-lg">{feature.icon}</span>
              <span className="text-sm">{feature.text}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-8">
          {isPremium ? (
            <button
              onClick={handleManage}
              disabled={loading}
              className="w-full rounded-xl border-2 border-neutral-200 py-4 text-sm font-bold transition hover:bg-neutral-50 disabled:opacity-50"
            >
              {loading ? "Chargement..." : "Gérer mon abonnement"}
            </button>
          ) : (
            <button
              onClick={handleSubscribe}
              disabled={loading}
              className="w-full rounded-xl bg-emerald-600 py-4 text-base font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
            >
              {loading ? "Redirection..." : "S'abonner — 20€/mois"}
            </button>
          )}
        </div>
      </div>

      {/* Trust elements */}
      <div className="mt-8 grid grid-cols-3 gap-4 text-center text-xs opacity-40">
        <div>
          <p className="text-lg">🔒</p>
          <p className="mt-1">Paiement sécurisé via Stripe</p>
        </div>
        <div>
          <p className="text-lg">⚡</p>
          <p className="mt-1">Accès immédiat</p>
        </div>
        <div>
          <p className="text-lg">🚫</p>
          <p className="mt-1">Sans engagement</p>
        </div>
      </div>
    </main>
  );
}
