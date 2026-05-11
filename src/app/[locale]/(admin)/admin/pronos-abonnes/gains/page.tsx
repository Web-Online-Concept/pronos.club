// src/app/[locale]/(admin)/admin/pronos-abonnes/gains/page.tsx
//
// LOT 21 (11/05/2026) — REFONTE :
//   - Bouton "Clôturer la semaine en cours" + "Clôturer la semaine précédente"
//   - Modal preview : montre classement actuel, pending count, warning, leader
//   - Bouton valider gagnant → insertion + envoi email (Brevo)
//   - Garde-fou : refuse de clôturer si pending > 0 (sauf override admin)
//   - Idem pour le mois (en cours / précédent)
//   - Suppression d'un winner en cas d'erreur

"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import AdminPronosAbonnesNav from "@/components/admin/AdminPronosAbonnesNav";

type Winner = {
  id: string;
  user_id: string;
  period_type: "week" | "month";
  period_start: string;
  period_end: string;
  total_units: number;
  picks_count: number;
  prize_amount: number;
  paid: boolean;
  paid_at: string | null;
  paid_note: string | null;
  email_sent_at: string | null;
  validated_by_admin: string | null;
  created_at: string;
  users: {
    id: string;
    pseudo: string;
    avatar_url: string | null;
    email: string;
    paypal_email: string | null;
  } | null;
};

type PreviewRanking = {
  user_id: string;
  pseudo: string;
  avatar_url: string | null;
  email: string | null;
  paypal_email: string | null;
  total_picks: number;
  total_units: number;
  pending_picks: number;
};

type PreviewData = {
  period_type: "week" | "month";
  period_start: string;
  period_end: string;
  min_picks: number;
  prize: number;
  ranking: PreviewRanking[];
  non_eligible: PreviewRanking[];
  pending_total: number;
  already_closed: boolean;
  existing_winner: { id: string; users?: { pseudo?: string } } | null;
};

export default function AdminGainsPage() {
  const { user } = useAuth();
  const isAdmin = user?.is_admin === true;

  const [winners, setWinners] = useState<Winner[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unpaid" | "paid">("unpaid");
  const [noteInput, setNoteInput] = useState<{ [id: string]: string }>({});

  // États pour la modal de preview/clôture
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [closing, setClosing] = useState(false);

  async function fetchData() {
    setLoading(true);
    const res = await fetch("/api/admin/tipster-concours");
    const data = await res.json();
    setWinners(data.winners || []);
    setLoading(false);
  }

  useEffect(() => {
    if (isAdmin) fetchData();
  }, [isAdmin]);

  async function markAsPaid(winnerId: string, paid: boolean) {
    const note = noteInput[winnerId] || "";
    const res = await fetch("/api/admin/tipster-concours", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ winner_id: winnerId, paid, paid_note: note }),
    });
    const data = await res.json();
    if (data.error) {
      alert(data.error);
      return;
    }
    fetchData();
  }

  async function deleteWinner(winnerId: string) {
    if (!confirm("⚠️ Supprimer ce row de gagnant ? Cette action est irréversible.")) return;
    const res = await fetch(`/api/admin/tipster-concours?winner_id=${winnerId}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (data.error) {
      alert(data.error);
      return;
    }
    alert("Row supprimé. Tu peux relancer le calcul si besoin.");
    fetchData();
  }

  async function loadPreview(periodType: "week" | "month", scope: "current" | "previous") {
    setPreviewLoading(true);
    setPreviewData(null);
    try {
      const res = await fetch("/api/admin/tipster-concours", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview", period_type: periodType, scope }),
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
        setPreviewLoading(false);
        return;
      }
      setPreviewData(data);
    } catch (err) {
      alert("Erreur lors du chargement");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function closePeriod(skipPendingCheck: boolean = false) {
    if (!previewData) return;

    const winner = previewData.ranking[0];
    if (!winner) {
      alert("Aucun gagnant éligible.");
      return;
    }

    const confirmMsg = `🏆 Valider ${winner.pseudo} comme gagnant avec +${winner.total_units}U sur ${winner.total_picks} picks ?\n\nUn email de félicitations + ${previewData.prize}€ lui sera envoyé immédiatement.`;
    if (!confirm(confirmMsg)) return;

    setClosing(true);
    try {
      const res = await fetch("/api/admin/tipster-concours", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "close",
          period_type: previewData.period_type,
          scope: previewData.period_start,
          skip_pending_check: skipPendingCheck,
          send_email: true,
        }),
      });
      const data = await res.json();

      if (data.error === "pending_exists") {
        const force = confirm(`⚠️ ${data.pending_total} pick(s) de cette période sont encore pending.\n\nForcer la clôture quand même ?`);
        if (force) {
          await closePeriod(true);
        }
        setClosing(false);
        return;
      }

      if (data.error) {
        alert(`Erreur : ${data.message || data.error}`);
        setClosing(false);
        return;
      }

      if (data.skipped) {
        alert(`Pas de clôture : ${data.message || data.reason}`);
        setClosing(false);
        setPreviewData(null);
        return;
      }

      const emailMsg = data.email_sent
        ? "✅ Gagnant validé et email envoyé"
        : data.email_error
          ? `⚠️ Gagnant validé MAIS échec email : ${data.email_error}`
          : "✅ Gagnant validé (pas d'email demandé)";
      alert(emailMsg);

      setPreviewData(null);
      fetchData();
    } catch (err) {
      alert(`Erreur : ${err instanceof Error ? err.message : "inconnu"}`);
    } finally {
      setClosing(false);
    }
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-neutral-500">Accès admin uniquement</p>
      </main>
    );
  }

  const filtered = winners.filter((w) => {
    if (filter === "unpaid") return !w.paid;
    if (filter === "paid") return w.paid;
    return true;
  });

  const totalUnpaid = winners.filter((w) => !w.paid).reduce((sum, w) => sum + Number(w.prize_amount), 0);
  const totalPaid = winners.filter((w) => w.paid).reduce((sum, w) => sum + Number(w.prize_amount), 0);

  function formatPeriod(start: string, end: string, type: "week" | "month") {
    const s = new Date(start);
    const e = new Date(end);
    if (type === "month") {
      return s.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    }
    return `${s.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} → ${e.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}`;
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
              <h1 className="mt-1 text-2xl font-black text-neutral-900">Gains Pronos Abonnés</h1>
              <p className="mt-1 text-sm text-neutral-500">
                Suivi des versements PayPal aux gagnants du concours
              </p>
            </div>
            <AdminPronosAbonnesNav active="gains" />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <div className="rounded-xl bg-white border border-neutral-200 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Total gagnants</p>
            <p className="mt-1 text-2xl font-black text-neutral-900">{winners.length}</p>
          </div>
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">À payer</p>
            <p className="mt-1 text-2xl font-black text-amber-700">{totalUnpaid.toFixed(2)} €</p>
          </div>
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Déjà payé</p>
            <p className="mt-1 text-2xl font-black text-emerald-700">{totalPaid.toFixed(2)} €</p>
          </div>
        </div>

        {/* Clôture manuelle */}
        <div className="rounded-xl bg-white border-2 border-emerald-300 p-5 mb-6">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-1">
            🏆 Clôture manuelle des concours
          </p>
          <p className="text-xs text-neutral-500 mb-4">
            Affiche le classement actuel, vérifie les pending picks, puis valide le gagnant (insertion + email automatique).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <button
              onClick={() => loadPreview("week", "current")}
              disabled={previewLoading}
              className="cursor-pointer rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              🏆 Semaine en cours
            </button>
            <button
              onClick={() => loadPreview("week", "previous")}
              disabled={previewLoading}
              className="cursor-pointer rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-50"
            >
              ⬅️ Semaine précédente
            </button>
            <button
              onClick={() => loadPreview("month", "current")}
              disabled={previewLoading}
              className="cursor-pointer rounded-xl bg-amber-600 px-4 py-3 text-sm font-bold text-white hover:bg-amber-500 disabled:opacity-50"
            >
              👑 Mois en cours
            </button>
            <button
              onClick={() => loadPreview("month", "previous")}
              disabled={previewLoading}
              className="cursor-pointer rounded-xl bg-amber-700 px-4 py-3 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-50"
            >
              ⬅️ Mois précédent
            </button>
          </div>
          {previewLoading && (
            <p className="mt-3 text-xs text-neutral-500">Chargement du classement...</p>
          )}
        </div>

        {/* Filter */}
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => setFilter("unpaid")}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
              filter === "unpaid" ? "bg-neutral-900 text-white" : "bg-white text-neutral-600 border border-neutral-200"
            }`}
          >
            À payer ({winners.filter((w) => !w.paid).length})
          </button>
          <button
            onClick={() => setFilter("paid")}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
              filter === "paid" ? "bg-neutral-900 text-white" : "bg-white text-neutral-600 border border-neutral-200"
            }`}
          >
            Payés ({winners.filter((w) => w.paid).length})
          </button>
          <button
            onClick={() => setFilter("all")}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
              filter === "all" ? "bg-neutral-900 text-white" : "bg-white text-neutral-600 border border-neutral-200"
            }`}
          >
            Tous ({winners.length})
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl bg-white border border-neutral-200 py-16 text-center">
            <p className="text-neutral-500 text-sm">
              {filter === "unpaid" ? "Aucun gain à payer actuellement" : "Aucun gagnant"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((w) => (
              <div key={w.id} className="rounded-2xl bg-white border border-neutral-200 p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4">
                  <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl text-xl ${
                    w.period_type === "week" ? "bg-emerald-100" : "bg-amber-100"
                  }`}>
                    {w.period_type === "week" ? "🏆" : "👑"}
                  </div>

                  <div className="flex-1 min-w-0 mt-2 sm:mt-0">
                    <p className="font-extrabold text-neutral-900 truncate">
                      {w.users?.pseudo || "?"}
                      <span className="ml-2 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                        {w.period_type === "week" ? "Semaine" : "Mois"}
                      </span>
                      {w.email_sent_at && (
                        <span className="ml-2 text-[10px] font-bold text-emerald-600">📧 Email envoyé</span>
                      )}
                    </p>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {formatPeriod(w.period_start, w.period_end, w.period_type)} · +{w.total_units}U · {w.picks_count} picks
                    </p>
                    <div className="mt-1 text-xs text-neutral-600">
                      <span className="font-bold">Email :</span> {w.users?.email || "-"}
                    </div>
                    <div className="text-xs">
                      <span className="font-bold text-neutral-600">PayPal :</span>{" "}
                      {w.users?.paypal_email ? (
                        <span className="text-emerald-600 font-semibold">{w.users.paypal_email}</span>
                      ) : (
                        <span className="text-red-500 font-semibold">⚠️ Non renseigné</span>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 sm:mt-0 text-right">
                    <p className={`text-2xl font-black ${
                      w.period_type === "week" ? "text-emerald-600" : "text-amber-600"
                    }`}>
                      {w.prize_amount}€
                    </p>
                    {w.paid ? (
                      <p className="text-[10px] text-emerald-700 font-bold mt-0.5">
                        ✓ Payé le {w.paid_at ? new Date(w.paid_at).toLocaleDateString("fr-FR") : "-"}
                      </p>
                    ) : null}
                  </div>
                </div>

                {!w.paid ? (
                  <div className="mt-4 pt-4 border-t border-neutral-100 flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      placeholder="Note (ex: Viré PayPal le 28/04, ref 12345)"
                      value={noteInput[w.id] || ""}
                      onChange={(e) => setNoteInput({ ...noteInput, [w.id]: e.target.value })}
                      className="flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                    />
                    <button
                      onClick={() => markAsPaid(w.id, true)}
                      className="cursor-pointer rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500"
                    >
                      ✓ Marquer payé
                    </button>
                    <button
                      onClick={() => deleteWinner(w.id)}
                      className="cursor-pointer rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-100"
                    >
                      🗑️ Supprimer
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center justify-between">
                    {w.paid_note && (
                      <p className="text-xs text-neutral-500 italic">
                        📝 {w.paid_note}
                      </p>
                    )}
                    <button
                      onClick={() => markAsPaid(w.id, false)}
                      className="cursor-pointer text-[11px] font-bold text-neutral-400 hover:text-red-500 ml-auto"
                    >
                      Annuler le paiement
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Preview */}
      {previewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-emerald-600">
                  Preview clôture
                </p>
                <h2 className="text-lg font-black text-neutral-900">
                  {previewData.period_type === "week" ? "🏆 Concours hebdo" : "👑 Concours mensuel"} · Période {formatPeriod(previewData.period_start, previewData.period_end, previewData.period_type)}
                </h2>
              </div>
              <button
                onClick={() => setPreviewData(null)}
                className="cursor-pointer text-2xl text-neutral-400 hover:text-neutral-900"
              >
                ×
              </button>
            </div>

            <div className="p-6">
              {/* Warning si déjà clôturé */}
              {previewData.already_closed && (
                <div className="rounded-xl bg-blue-50 border-2 border-blue-300 p-4 mb-4">
                  <p className="text-sm font-bold text-blue-900">
                    ℹ️ Cette période est déjà clôturée
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    Gagnant enregistré : <strong>{previewData.existing_winner?.users?.pseudo}</strong>. Pour refaire le calcul, supprime d'abord le row existant dans la liste des gagnants.
                  </p>
                </div>
              )}

              {/* Warning si pending */}
              {previewData.pending_total > 0 && !previewData.already_closed && (
                <div className="rounded-xl bg-amber-50 border-2 border-amber-300 p-4 mb-4">
                  <p className="text-sm font-bold text-amber-900">
                    ⚠️ {previewData.pending_total} pick(s) de cette période sont encore pending
                  </p>
                  <p className="text-xs text-amber-700 mt-1">
                    Tu peux clôturer quand même mais le classement ne sera pas définitif. Idéalement résous tous les pending avant.
                  </p>
                </div>
              )}

              {/* Info prize */}
              <div className="rounded-xl bg-gradient-to-br from-neutral-50 to-white border border-neutral-200 p-4 mb-4 grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Prize</p>
                  <p className="text-xl font-black text-emerald-600">{previewData.prize}€</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Min picks</p>
                  <p className="text-xl font-black text-neutral-900">{previewData.min_picks}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Pending</p>
                  <p className={`text-xl font-black ${previewData.pending_total > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                    {previewData.pending_total}
                  </p>
                </div>
              </div>

              {/* Classement éligible */}
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">
                Classement éligibles ({previewData.ranking.length})
              </p>
              {previewData.ranking.length === 0 ? (
                <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-6 text-center">
                  <p className="text-sm text-neutral-500">Aucun tipster n'a atteint le minimum de {previewData.min_picks} picks résolus</p>
                </div>
              ) : (
                <div className="rounded-xl overflow-hidden border border-neutral-200 mb-4">
                  <table className="w-full text-sm">
                    <thead className="bg-neutral-50 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                      <tr>
                        <th className="px-3 py-2 text-left">#</th>
                        <th className="px-3 py-2 text-left">Pseudo</th>
                        <th className="px-3 py-2 text-right">Picks</th>
                        <th className="px-3 py-2 text-right">Pending</th>
                        <th className="px-3 py-2 text-right">Units</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {previewData.ranking.map((r, i) => (
                        <tr key={r.user_id} className={i === 0 ? "bg-emerald-50" : ""}>
                          <td className="px-3 py-2 font-extrabold">
                            {i === 0 ? "🏆" : i + 1}
                          </td>
                          <td className="px-3 py-2 font-bold">{r.pseudo}</td>
                          <td className="px-3 py-2 text-right">{r.total_picks}</td>
                          <td className="px-3 py-2 text-right">
                            {r.pending_picks > 0 ? (
                              <span className="text-amber-600 font-bold">{r.pending_picks}</span>
                            ) : (
                              <span className="text-neutral-300">0</span>
                            )}
                          </td>
                          <td className={`px-3 py-2 text-right font-extrabold tabular-nums ${r.total_units > 0 ? "text-emerald-600" : r.total_units < 0 ? "text-red-600" : "text-neutral-500"}`}>
                            {r.total_units >= 0 ? "+" : ""}{r.total_units.toFixed(2)}U
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Non-éligibles */}
              {previewData.non_eligible.length > 0 && (
                <details className="mb-4">
                  <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-neutral-400">
                    Non-éligibles ({previewData.non_eligible.length}) — moins de {previewData.min_picks} picks
                  </summary>
                  <div className="mt-2 rounded-xl bg-neutral-50 border border-neutral-200 p-3 space-y-1">
                    {previewData.non_eligible.map((r) => (
                      <div key={r.user_id} className="flex justify-between text-xs">
                        <span className="text-neutral-700">{r.pseudo}</span>
                        <span className="text-neutral-500">
                          {r.total_picks} picks · {r.total_units >= 0 ? "+" : ""}{r.total_units.toFixed(2)}U
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {/* Boutons d'action */}
              {!previewData.already_closed && previewData.ranking.length > 0 && (
                <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-neutral-200">
                  <button
                    onClick={() => closePeriod(false)}
                    disabled={closing}
                    className="flex-1 cursor-pointer rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {closing ? "Validation..." : `✅ Valider ${previewData.ranking[0].pseudo} (+${previewData.ranking[0].total_units}U) + envoyer email`}
                  </button>
                  <button
                    onClick={() => setPreviewData(null)}
                    disabled={closing}
                    className="cursor-pointer rounded-xl border border-neutral-200 bg-white px-6 py-3 text-sm font-bold text-neutral-700 hover:bg-neutral-50"
                  >
                    Annuler
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}