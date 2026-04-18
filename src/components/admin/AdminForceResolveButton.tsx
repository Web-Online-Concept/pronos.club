/**
 * ═══════════════════════════════════════════════════════════════════
 * COMPOSANT — AdminForceResolveButton
 * ═══════════════════════════════════════════════════════════════════
 *
 * Bouton pour déclencher manuellement la résolution des picks.
 * Affiche un rapport après exécution (nb résolus, erreurs, durée).
 * ═══════════════════════════════════════════════════════════════════
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";


interface ResolveReport {
  success: boolean;
  picksChecked: number;
  picksResolved: number;
  picksStillPending: number;
  picksVoided: number;
  breakdown: { won: number; lost: number; void: number };
  errors: string[];
  durationMs: number;
}


export default function AdminForceResolveButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ResolveReport | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  async function handleResolve() {
    setLoading(true);
    setReport(null);
    setShowConfirm(false);

    try {
      const res = await fetch("/api/admin/ai-picks/force-resolve", {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        alert(`Erreur : ${data.error || "inconnue"}`);
        return;
      }

      setReport(data as ResolveReport);
      router.refresh();
    } catch (err) {
      alert(`Erreur : ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-950/40 px-4 py-2 text-sm font-semibold text-cyan-300 transition hover:border-cyan-500 hover:bg-cyan-900/40 disabled:opacity-50"
      >
        {loading ? (
          <>
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
            Résolution en cours…
          </>
        ) : (
          <>
            <span>⚡</span>
            <span>Forcer la résolution</span>
          </>
        )}
      </button>

      {report && (
        <div
          className={`w-full rounded-lg border p-3 text-xs ${
            report.success
              ? "border-emerald-500/40 bg-emerald-950/20 text-emerald-200"
              : "border-red-500/40 bg-red-950/20 text-red-200"
          }`}
        >
          <div className="mb-1 font-semibold">
            {report.success ? "✅ Résolution terminée" : "⚠️ Résolution partielle"} ({(report.durationMs / 1000).toFixed(1)}s)
          </div>
          <div className="space-y-0.5 text-[11px]">
            <div>
              Picks vérifiés : <span className="font-mono">{report.picksChecked}</span>
            </div>
            <div>
              Résolus : <span className="font-mono">{report.picksResolved}</span>{" "}
              ({report.breakdown.won}W / {report.breakdown.lost}L / {report.breakdown.void}V)
            </div>
            {report.picksStillPending > 0 && (
              <div>
                Encore en attente : <span className="font-mono">{report.picksStillPending}</span>
                <span className="text-neutral-500"> (match pas encore fini ou ESPN pas à jour)</span>
              </div>
            )}
            {report.errors.length > 0 && (
              <div>
                Erreurs : <span className="font-mono">{report.errors.length}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODALE DE CONFIRMATION */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-neutral-700 bg-neutral-900 p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-bold text-neutral-100">
              ⚡ Forcer la résolution
            </h3>
            <p className="mb-4 text-sm text-neutral-400">
              Cette action va lancer la résolution manuelle des picks. Seuls les matchs
              terminés depuis au moins 2h seront résolus. Les autres resteront en attente
              et seront résolus automatiquement par le cron du lendemain.
            </p>
            <p className="mb-5 text-xs text-neutral-500">
              Astuce : attends que tous les matchs du jour soient bien terminés avant
              de cliquer (vers 23h pour les matchs tardifs).
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-700"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleResolve}
                className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500"
              >
                Lancer la résolution
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}