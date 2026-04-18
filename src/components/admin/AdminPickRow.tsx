/**
 * ═══════════════════════════════════════════════════════════════════
 * COMPOSANT — AdminPickRow
 * ═══════════════════════════════════════════════════════════════════
 *
 * Ligne de pick dans l'admin.
 * Client component : bouton "Supprimer" avec modale de confirmation.
 * ═══════════════════════════════════════════════════════════════════
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";


interface AdminPick {
  id: string;
  pick_type: "classic" | "scorer";
  sport: string;
  league: string;
  event_name: string;
  event_date: string;
  selection: string;
  market: string;
  odds: number | null;
  odds_bookmaker: string | null;
  reasoning: string;
  ai_confidence: number;
  status: string;
  final_score: string | null;
  audit_reason: string | null;
  audit_category: string | null;
  generation_batch: string;
  created_at: string;
}


const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "⏳ À venir", color: "bg-amber-500/20 text-amber-300 border-amber-500/40" },
  pending_review: { label: "🔍 À auditer", color: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40" },
  won: { label: "✅ Gagné", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" },
  lost: { label: "❌ Perdu", color: "bg-red-500/20 text-red-300 border-red-500/40" },
  void: { label: "⊘ Annulé", color: "bg-neutral-700/40 text-neutral-400 border-neutral-600" },
  rejected_by_audit: { label: "🤖 Rejeté auto", color: "bg-purple-500/20 text-purple-300 border-purple-500/40" },
};


export default function AdminPickRow({ pick }: { pick: AdminPick }) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [reason, setReason] = useState("");
  const [category, setCategory] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const status = STATUS_LABELS[pick.status] ?? { label: pick.status, color: "bg-neutral-700/40 text-neutral-400 border-neutral-600" };

  const eventDate = new Date(pick.event_date).toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });

  async function handleDelete() {
    if (!reason.trim()) {
      alert("Merci d'indiquer une raison");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/ai-picks/${pick.id}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: reason.trim(),
          category: category || "other",
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur serveur");
      }

      setShowModal(false);
      router.refresh();
    } catch (err) {
      alert(`Erreur : ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <tr className="transition hover:bg-neutral-900/60">
        <td className="px-4 py-3 text-xs text-neutral-400">
          <div>{eventDate}</div>
          <div className="mt-0.5 text-[10px] text-neutral-600">
            Batch : {pick.generation_batch}
          </div>
        </td>

        <td className="px-4 py-3">
          <div className="font-medium text-neutral-200">{pick.event_name}</div>
          <div className="mt-0.5 text-xs text-neutral-500">
            {pick.league} · {pick.pick_type === "scorer" ? "⚽ Buteur" : "🎯 Classique"}
          </div>
          {pick.final_score && (
            <div className="mt-0.5 text-xs font-mono text-neutral-400">
              Score final : {pick.final_score}
            </div>
          )}
        </td>

        <td className="px-4 py-3">
          <div className="font-semibold text-neutral-100">{pick.selection}</div>
          <div className="mt-0.5 text-xs text-neutral-500">
            {pick.market === "scorer" ? "Buteur" : pick.market}
          </div>
        </td>

        <td className="px-4 py-3 text-right">
          {pick.odds ? (
            <>
              <div className="font-mono font-semibold">{pick.odds.toFixed(2)}</div>
              {pick.odds_bookmaker && (
                <div className="text-[10px] text-neutral-500">{pick.odds_bookmaker}</div>
              )}
            </>
          ) : (
            <span className="text-neutral-600">—</span>
          )}
        </td>

        <td className="px-4 py-3 text-center">
          <span
            className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${status.color}`}
          >
            {status.label}
          </span>
          {pick.audit_reason && (
            <div className="mt-1 text-[10px] italic text-purple-300/70">
              {pick.audit_reason.length > 60
                ? pick.audit_reason.slice(0, 60) + "…"
                : pick.audit_reason}
            </div>
          )}
        </td>

        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1 text-xs text-neutral-300 hover:border-neutral-600 hover:bg-neutral-700"
            >
              {showDetails ? "Masquer" : "Détails"}
            </button>
            {pick.status !== "void" && (
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-1 text-xs text-red-300 hover:border-red-500 hover:bg-red-900/40"
              >
                🗑️ Annuler
              </button>
            )}
          </div>
        </td>
      </tr>

      {/* LIGNE DÉTAILS */}
      {showDetails && (
        <tr className="bg-neutral-950/60">
          <td colSpan={6} className="px-4 py-4">
            <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
              <div className="mb-3">
                <div className="text-[10px] uppercase tracking-wider text-neutral-500">
                  Justification IA
                </div>
                <p className="mt-1 text-sm italic text-neutral-300">
                  {pick.reasoning}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
                <div>
                  <div className="text-[10px] uppercase text-neutral-500">ID</div>
                  <div className="mt-0.5 font-mono text-neutral-400">
                    {pick.id.slice(0, 8)}…
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-neutral-500">Confidence</div>
                  <div className="mt-0.5 text-neutral-300">{pick.ai_confidence}/10</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-neutral-500">Sport</div>
                  <div className="mt-0.5 text-neutral-300">{pick.sport}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-neutral-500">Créé le</div>
                  <div className="mt-0.5 text-neutral-300">
                    {new Date(pick.created_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}
                  </div>
                </div>
              </div>
              {pick.audit_reason && (
                <div className="mt-3 rounded-lg border border-purple-500/30 bg-purple-950/20 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-purple-300">
                    Raison de rejet par l'audit ({pick.audit_category ?? "—"})
                  </div>
                  <p className="mt-1 text-xs text-purple-200/80">
                    {pick.audit_reason}
                  </p>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}

      {/* MODALE DE SUPPRESSION */}
      {showModal && (
        <tr>
          <td colSpan={6} className="p-0">
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
              <div className="w-full max-w-lg rounded-2xl border border-neutral-700 bg-neutral-900 p-6 shadow-xl">
                <h3 className="mb-2 text-lg font-bold text-neutral-100">
                  🗑️ Annuler ce pronostic
                </h3>
                <p className="mb-4 text-sm text-neutral-400">
                  <span className="font-semibold text-neutral-200">
                    {pick.event_name}
                  </span>
                  <br />
                  Pick : {pick.selection}
                </p>

                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-neutral-500">
                  Catégorie
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="mb-4 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-200"
                >
                  <option value="">— Choisir —</option>
                  <option value="player_transferred">Joueur transféré</option>
                  <option value="team_relegated">Équipe pas dans la bonne ligue</option>
                  <option value="factual_error">Erreur factuelle</option>
                  <option value="match_cancelled">Match annulé/reporté</option>
                  <option value="other">Autre</option>
                </select>

                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-neutral-500">
                  Raison (obligatoire)
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ex: Le joueur a été transféré à la Juventus"
                  rows={3}
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-200"
                />

                <div className="mt-5 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    disabled={submitting}
                    className="rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-700 disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={submitting || !reason.trim()}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                  >
                    {submitting ? "En cours…" : "Confirmer l'annulation"}
                  </button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}