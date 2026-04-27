"use client";

import { useState } from "react";


type GenerationResult = {
  ok: boolean;
  date?: string;
  durationMs?: number;
  apiFootballFixtures?: number;
  oddsApiFixtures?: number;
  consensus?: {
    selectedClassic: number;
    rejected: number;
  };
  persisted?: {
    success: number;
    rejected_by_validation?: number;
    rejected_picks?: Array<{ candidate: string; pickId: string }>;
    errors?: Array<{ candidate: string; error: string }>;
  };
  error?: string;
};


export default function AdminGeneratePicksButton({
  adminEmail,
}: {
  adminEmail: string;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);

  const handleGenerate = async () => {
    if (loading) return;
    if (
      !confirm(
        "Lancer la génération IA maintenant ?\n\nLe pipeline va :\n- Appeler Claude + GPT (~30-60s)\n- Valider les cotes via OddsAPI\n- Insérer les picks (status=pending ou rejected_by_validation)\n- Lancer en async la génération des dossiers (~2-3 min total)\n\nContinuer ?"
      )
    ) {
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/cron/ai-picks-generate", {
        method: "POST",
        headers: {
          "x-admin-email": adminEmail,
        },
      });

      const json = (await res.json()) as GenerationResult;
      setResult(json);
    } catch (err) {
      setResult({
        ok: false,
        error: err instanceof Error ? err.message : "Network error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-violet-500 disabled:opacity-50"
      >
        {loading ? "⏳ Génération en cours..." : "🚀 Générer maintenant"}
      </button>

      {result && (
        <div className="mt-2 max-w-md rounded-lg border border-neutral-700 bg-neutral-900 p-3 text-xs">
          {result.ok ? (
            <>
              <div className="mb-2 font-bold text-emerald-400">
                ✅ Génération terminée ({((result.durationMs ?? 0) / 1000).toFixed(1)}s)
              </div>
              <div className="space-y-1 text-neutral-300">
                <div>
                  <span className="text-neutral-500">Fixtures :</span> {result.apiFootballFixtures ?? 0} apifoot + {result.oddsApiFixtures ?? 0} oddsapi
                </div>
                <div>
                  <span className="text-neutral-500">Consensus :</span> {result.consensus?.selectedClassic ?? 0} classics
                </div>
                <div>
                  <span className="text-neutral-500">Persistés :</span>{" "}
                  <span className="font-bold text-emerald-400">
                    {result.persisted?.success ?? 0} OK
                  </span>
                  {result.persisted?.rejected_by_validation ? (
                    <>
                      {" "}
                      ·{" "}
                      <span className="font-bold text-red-400">
                        {result.persisted.rejected_by_validation} rejetés
                      </span>
                    </>
                  ) : null}
                  {result.persisted?.errors?.length ? (
                    <>
                      {" "}
                      ·{" "}
                      <span className="font-bold text-amber-400">
                        {result.persisted.errors.length} erreurs
                      </span>
                    </>
                  ) : null}
                </div>

                {result.persisted?.rejected_picks?.length ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-red-400">
                      Voir picks rejetés ({result.persisted.rejected_picks.length})
                    </summary>
                    <ul className="mt-1 space-y-0.5 pl-4 text-neutral-400">
                      {result.persisted.rejected_picks.map((p) => (
                        <li key={p.pickId}>• {p.candidate}</li>
                      ))}
                    </ul>
                  </details>
                ) : null}

                {result.persisted?.errors?.length ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-amber-400">
                      Voir erreurs ({result.persisted.errors.length})
                    </summary>
                    <ul className="mt-1 space-y-0.5 pl-4 text-neutral-400">
                      {result.persisted.errors.map((e, i) => (
                        <li key={i}>
                          • {e.candidate}: {e.error}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}

                <div className="mt-2 border-t border-neutral-700 pt-2 text-neutral-500">
                  💡 Recharge la page pour voir les nouveaux picks dans la liste ci-dessous.
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="mb-2 font-bold text-red-400">
                ❌ Erreur de génération
              </div>
              <div className="text-neutral-300">
                {result.error ?? "Erreur inconnue"}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}