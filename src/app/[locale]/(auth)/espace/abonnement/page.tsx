"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useSearchParams } from "next/navigation";
import EspaceHero from "@/components/layout/EspaceHero";

interface Invoice {
  id: string;
  date: number;
  amount: number;
  currency: string;
  status: string;
  pdf: string | null;
  number: string | null;
}

export default function EspaceAbonnementPage() {
  const { user, signOut } = useAuth();
  const searchParams = useSearchParams();
  const success = searchParams.get("success") === "true";
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [cancelSuccess, setCancelSuccess] = useState(false);
  const [cancelEndDate, setCancelEndDate] = useState("");

  const isPremium = user?.subscription_status === "active";

  useEffect(() => {
    fetch("/api/stripe/invoices")
      .then((r) => r.json())
      .then((d) => setInvoices(d.invoices ?? []))
      .catch(() => {})
      .finally(() => setLoadingInvoices(false));
  }, []);

  async function handleDeleteAccount() {
    setDeleting(true);
    const res = await fetch("/api/account/delete", { method: "DELETE" });
    if (res.ok) {
      signOut();
    } else {
      setDeleting(false);
    }
  }

  async function handleUpdateCard() {
    setLoading(true);
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    setLoading(false);
  }

  async function handleCancel() {
    setCanceling(true);
    const res = await fetch("/api/stripe/cancel", { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setCancelEndDate(data.endDate ?? "");
      setCancelSuccess(true);
      setShowCancelConfirm(false);
    }
    setCanceling(false);
  }

  async function handleSubscribe() {
    setLoading(true);
    const res = await fetch("/api/stripe/checkout", { method: "POST" });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    setLoading(false);
  }

  return (
    <>
      <EspaceHero title="Mon Abonnement" />

      <main className="mx-auto max-w-lg px-4 pb-16 pt-8">

        {/* Success message */}
        {success && (
          <div className="mb-6 overflow-hidden rounded-2xl border border-emerald-500/20 p-5 text-center" style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 100%)" }}>
            <span className="text-3xl">🎉</span>
            <p className="mt-2 font-bold text-white">Bienvenue dans le Premium !</p>
            <p className="mt-1 text-sm text-white/40">Vous avez maintenant accès à tous les pronostics.</p>
          </div>
        )}

        {/* Status card */}
        <div className="overflow-hidden rounded-2xl border border-white/[0.06]" style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}>
          <div className="p-6 text-center">
            {isPremium ? (
              <>
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-amber-500 to-amber-600 shadow-lg shadow-amber-500/20">
                  <span className="text-2xl">⭐</span>
                </div>
                <h2 className="mt-4 text-xl font-extrabold text-white">Premium actif</h2>
                <p className="mt-1 text-sm text-white/40">Vous avez accès à tous les pronostics premium</p>
                <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-500/15 px-4 py-1.5">
                  <span className="text-sm font-bold text-amber-400">20€/mois</span>
                </div>
              </>
            ) : (
              <>
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
                  <span className="text-2xl">💎</span>
                </div>
                <h2 className="mt-4 text-xl font-extrabold text-white">Compte gratuit</h2>
                <p className="mt-1 text-sm text-white/40">Passez Premium pour débloquer tous les pronostics</p>
              </>
            )}
          </div>

          {/* Info rows */}
          <div className="border-t border-white/[0.06] px-6 py-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/40">Statut actuel</span>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${isPremium ? "bg-emerald-500/20 text-emerald-400" : "bg-white/10 text-white/50"}`}>
                {isPremium ? "Actif" : "Gratuit"}
              </span>
            </div>
          </div>

          {isPremium && user?.subscription_end && (
            <div className="border-t border-white/[0.06] px-6 py-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/40">Prochain renouvellement</span>
                <span className="text-sm font-semibold text-white">
                  {new Date(user.subscription_end).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          )}

          {isPremium && (
            <div className="border-t border-white/[0.06] px-6 py-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/40">Tarif</span>
                <span className="text-sm font-semibold text-white">20€ / mois</span>
              </div>
            </div>
          )}

          {/* CTA */}
          <div className="border-t border-white/[0.06] p-6">
            {isPremium ? (
              <div className="space-y-3">
                {cancelSuccess ? (
                  <div className="rounded-xl bg-amber-500/10 p-4 text-center">
                    <p className="text-sm font-bold text-amber-400">Abonnement résilié</p>
                    <p className="mt-1 text-xs text-white/40">
                      Votre accès Premium reste actif jusqu&apos;au {cancelEndDate || "fin de la période en cours"}.
                      <br />Votre compte repassera ensuite en version gratuite — aucune donnée ne sera supprimée.
                    </p>
                    <p className="mt-2 text-xs text-white/30">Un email de confirmation vous a été envoyé.</p>
                  </div>
                ) : showCancelConfirm ? (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5 text-center">
                    <p className="text-sm font-bold text-white">Confirmer la résiliation ?</p>
                    <p className="mt-1 text-xs text-white/40">
                      Votre accès Premium restera actif jusqu&apos;à la fin de la période en cours.
                      <br />Vous repasserez ensuite en compte gratuit.
                    </p>
                    <div className="mt-4 flex items-center justify-center gap-3">
                      <button
                        onClick={() => setShowCancelConfirm(false)}
                        className="cursor-pointer rounded-lg border border-white/10 bg-white/[0.05] px-5 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={handleCancel}
                        disabled={canceling}
                        className="cursor-pointer rounded-lg bg-red-600 px-5 py-2 text-xs font-bold text-white transition hover:bg-red-500 disabled:opacity-50"
                      >
                        {canceling ? "Résiliation..." : "Oui, résilier"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={handleUpdateCard}
                      disabled={loading}
                      className="w-full cursor-pointer rounded-xl border border-white/10 bg-white/[0.05] py-3.5 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
                    >
                      {loading ? "Redirection..." : "Modifier ma carte bancaire"}
                    </button>
                    <button
                      onClick={() => setShowCancelConfirm(true)}
                      className="w-full cursor-pointer rounded-xl border border-red-500/20 bg-red-500/5 py-3.5 text-sm font-semibold text-red-400 transition hover:bg-red-500/10"
                    >
                      Résilier mon abonnement
                    </button>
                  </>
                )}
              </div>
            ) : (
              <button
                onClick={handleSubscribe}
                disabled={loading}
                className="w-full cursor-pointer rounded-xl py-3.5 text-sm font-bold text-white transition disabled:opacity-50"
                style={{
                  background: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
                  boxShadow: "0 4px 14px rgba(16,185,129,0.3)",
                }}
              >
                {loading ? "Redirection..." : "Passer Premium — 20€/mois"}
              </button>
            )}
          </div>
        </div>

        {/* Features premium */}
        {!isPremium && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-white/[0.06]" style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}>
            <div className="p-6 text-center">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400">Avantages Premium</p>
              <div className="mt-4 flex justify-center">
                <div className="space-y-3">
                  {[
                    "Tous les pronostics premium",
                    "Analyse détaillée de chaque pick",
                    "Notifications prioritaires",
                    "Stats personnelles complètes",
                    "Support prioritaire",
                    "Résiliable en 1 clic",
                  ].map((f) => (
                    <div key={f} className="flex items-center gap-3">
                      <svg className="h-4 w-4 shrink-0 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm text-white/60">{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Invoices */}
        {invoices.length > 0 && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-white/[0.06]" style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}>
            <div className="p-6">
              <p className="text-center text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400">Historique</p>
              <h3 className="mt-1 text-center font-bold text-white">Mes factures</h3>
            </div>
            <div className="border-t border-white/[0.06]">
              {invoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between border-b border-white/[0.04] px-6 py-3 last:border-b-0">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {new Date(inv.date * 1000).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                    <p className="text-xs text-white/30">{inv.number ?? inv.id}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-white">{inv.amount}€</span>
                    {inv.pdf && (
                      <a
                        href={inv.pdf}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 transition hover:bg-white/15"
                      >
                        PDF
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {loadingInvoices && (
          <p className="mt-6 text-center text-sm text-neutral-400">Chargement des factures...</p>
        )}

        {/* Delete account */}
        <div className="mt-12 text-center">
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="cursor-pointer text-xs text-neutral-400 transition hover:text-red-500"
            >
              Supprimer mon compte
            </button>
          ) : (
            <div className="rounded-2xl border border-red-300 bg-red-50 p-5">
              <p className="text-sm font-bold text-red-700">Êtes-vous sûr de vouloir supprimer votre compte ?</p>
              <p className="mt-1 text-xs text-red-500">Cette action est irréversible. Toutes vos données seront supprimées.</p>
              <div className="mt-4 flex items-center justify-center gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="cursor-pointer rounded-lg border border-neutral-300 px-4 py-2 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-100"
                >
                  Annuler
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="cursor-pointer rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-red-500 disabled:opacity-50"
                >
                  {deleting ? "Suppression..." : "Oui, supprimer définitivement"}
                </button>
              </div>
            </div>
          )}
        </div>

      </main>
    </>
  );
}