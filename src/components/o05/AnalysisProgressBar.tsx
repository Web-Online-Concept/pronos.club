// src/components/o05/AnalysisProgressBar.tsx
//
// Barre de progression affichee pendant qu'une analyse est en cours.
// Affiche : status + compteur X/Y + barre animee + temps ecoule.

"use client";

import { useEffect, useState } from "react";

type Props = {
  status: "pending" | "running" | "completed" | "failed";
  matchesAnalyzed: number;
  matchesFailed: number;
  totalMatches: number;
  errorMessage: string | null;
  createdAt: string;
};

export default function AnalysisProgressBar({
  status,
  matchesAnalyzed,
  matchesFailed,
  totalMatches,
  errorMessage,
  createdAt,
}: Props) {
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    if (status === "completed" || status === "failed") return;
    const startedAt = new Date(createdAt).getTime();
    const tick = () => {
      setElapsedSec(Math.floor((Date.now() - startedAt) / 1000));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [createdAt, status]);

  // Cas erreur fatale
  if (status === "failed") {
    return (
      <div
        className="overflow-hidden rounded-xl border border-red-500/30 p-6"
        style={{ background: "linear-gradient(135deg, #1a0606 0%, #2a0808 100%)" }}
      >
        <h3 className="flex items-center gap-2 text-base font-black text-red-300">
          ❌ Analyse échouée
        </h3>
        <p className="mt-2 text-sm text-red-200/80">
          {errorMessage ?? "Erreur inconnue. Réessaie ou contacte l'admin."}
        </p>
      </div>
    );
  }

  const done = matchesAnalyzed + matchesFailed;
  const percent =
    totalMatches > 0 ? Math.min(100, Math.round((done / totalMatches) * 100)) : 0;

  const statusLabel =
    status === "pending"
      ? "⏳ En attente du démarrage..."
      : `⚙️ Analyse en cours...`;

  return (
    <div
      className="overflow-hidden rounded-xl border border-white/[0.06] p-6"
      style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-base font-black text-white">{statusLabel}</h3>
        <span className="text-xs text-white/60">
          {Math.floor(elapsedSec / 60)}m {elapsedSec % 60}s
        </span>
      </div>

      {/* Compteur */}
      <p className="mt-3 text-sm text-white/70">
        {totalMatches > 0 ? (
          <>
            <span className="text-2xl font-black text-emerald-400">{done}</span>
            <span className="text-white/60"> / {totalMatches} matchs traités</span>
            {matchesFailed > 0 && (
              <span className="ml-2 text-yellow-300">
                ({matchesFailed} en erreur)
              </span>
            )}
          </>
        ) : (
          <span className="text-white/60">Récupération des matchs en cours...</span>
        )}
      </p>

      {/* Barre */}
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-500"
          style={{
            width: totalMatches > 0 ? `${percent}%` : "10%",
            animation: totalMatches === 0 ? "pulse 2s ease-in-out infinite" : undefined,
          }}
        />
      </div>

      <p className="mt-3 text-xs text-white/40">
        L'outil scrape Understat et calcule le scoring de chaque match. Patience...
      </p>
    </div>
  );
}