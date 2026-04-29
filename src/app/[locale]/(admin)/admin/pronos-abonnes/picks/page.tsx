// src/app/[locale]/(admin)/admin/pronos-abonnes/picks/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import AdminPronosAbonnesNav from "@/components/admin/AdminPronosAbonnesNav";

type Pick = {
  id: string;
  user_id: string;
  match_date: string;
  sport: string;
  odds: number;
  pick_type: "simple" | "combiné";
  image_url: string;
  submitted_at: string;
  status: "live" | "resolved" | "rejected";
  result: "won" | "half_won" | "refunded" | "half_lost" | "lost" | null;
  units_result: number | null;
  admin_note: string | null;
  resolved_at: string | null;
  users: { id: string; pseudo: string; avatar_url: string | null; email: string } | null;
};

const RESULT_LABELS: { value: string; label: string; color: string }[] = [
  { value: "won", label: "✓ Gagné", color: "bg-emerald-600 hover:bg-emerald-500" },
  { value: "half_won", label: "½ Gagné", color: "bg-emerald-500 hover:bg-emerald-400" },
  { value: "refunded", label: "↻ Remboursé", color: "bg-blue-600 hover:bg-blue-500" },
  { value: "half_lost", label: "½ Perdu", color: "bg-red-500 hover:bg-red-400" },
  { value: "lost", label: "✗ Perdu", color: "bg-red-600 hover:bg-red-500" },
];

export default function AdminTipsterPicksPage() {
  const { user } = useAuth();
  const isAdmin = user?.is_admin === true;

  const [picks, setPicks] = useState<Pick[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ready_to_resolve" | "live" | "resolved" | "all">("ready_to_resolve");
  const [openModal, setOpenModal] = useState<{ pick: Pick; mode: "resolve" | "change_result" | "reject" } | null>(null);
  const [selectedResult, setSelectedResult] = useState<string>("");
  const [adminNote, setAdminNote] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Modal image plein écran
  const [imageModalUrl, setImageModalUrl] = useState<string | null>(null);

  async function fetchPicks() {
    setLoading(true);
    const res = await fetch(`/api/admin/tipster-picks?filter=${filter}`);
    const data = await res.json();
    setPicks(data.picks || []);
    setLoading(false);
  }

  useEffect(() => {
    if (isAdmin) fetchPicks();
  }, [isAdmin, filter]);

  // Fermer la modal image avec Échap + verrouiller le scroll body
  useEffect(() => {
    if (!imageModalUrl) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setImageModalUrl(null);
    };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [imageModalUrl]);

  async function handleSubmitModal() {
    if (!openModal) return;
    setSaving(true);

    const body: any = { pick_id: openModal.pick.id, action: openModal.mode };
    if (openModal.mode === "resolve" || openModal.mode === "change_result") {
      if (!selectedResult) {
        alert("Choisis un résultat");
        setSaving(false);
        return;
      }
      body.result = selectedResult;
    }
    if (adminNote) body.admin_note = adminNote;

    const res = await fetch("/api/admin/tipster-picks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setSaving(false);
    if (data.error) {
      alert(data.error);
      return;
    }
    setOpenModal(null);
    setSelectedResult("");
    setAdminNote("");
    fetchPicks();
  }

  async function handleReopen(pickId: string) {
    if (!confirm("Remettre ce pick en live ? Il perdra son résultat actuel.")) return;
    const res = await fetch("/api/admin/tipster-picks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pick_id: pickId, action: "reopen" }),
    });
    const data = await res.json();
    if (data.error) { alert(data.error); return; }
    fetchPicks();
  }

  async function handleDelete(pickId: string) {
    if (!confirm("Supprimer DÉFINITIVEMENT ce pick ? L'image sera supprimée aussi.")) return;
    const res = await fetch(`/api/admin/tipster-picks?id=${pickId}`, { method: "DELETE" });
    const data = await res.json();
    if (data.error) { alert(data.error); return; }
    fetchPicks();
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-neutral-500">Accès admin uniquement</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="bg-white border-b border-neutral-200">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.3em] text-emerald-600">
                🔒 Admin · Pronos Abonnés
              </p>
              <h1 className="mt-1 text-2xl font-black text-neutral-900">Modération des picks</h1>
              <p className="mt-1 text-sm text-neutral-500">
                Valide, modifie ou rejette les pronostics postés par les tipsters
              </p>
            </div>
            <AdminPronosAbonnesNav active="picks" />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Filtres */}
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => setFilter("ready_to_resolve")}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
              filter === "ready_to_resolve"
                ? "bg-amber-600 text-white shadow-lg"
                : "bg-white text-neutral-700 border-2 border-amber-300 hover:border-amber-500"
            }`}
          >
            🎯 À résoudre (prioritaire)
          </button>
          <button
            onClick={() => setFilter("live")}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
              filter === "live" ? "bg-neutral-900 text-white" : "bg-white text-neutral-600 border border-neutral-200"
            }`}
          >
            En cours
          </button>
          <button
            onClick={() => setFilter("resolved")}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
              filter === "resolved" ? "bg-neutral-900 text-white" : "bg-white text-neutral-600 border border-neutral-200"
            }`}
          >
            Résolus
          </button>
          <button
            onClick={() => setFilter("all")}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
              filter === "all" ? "bg-neutral-900 text-white" : "bg-white text-neutral-600 border border-neutral-200"
            }`}
          >
            Tous
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          </div>
        ) : picks.length === 0 ? (
          <div className="rounded-3xl bg-white py-16 text-center">
            <p className="text-neutral-500">Aucun pick à afficher dans ce filtre.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {picks.map((pick) => {
              const matchDate = new Date(pick.match_date);
              const matchPassed = matchDate.getTime() < Date.now();
              return (
                <div key={pick.id} className="bg-white rounded-2xl border border-neutral-200 overflow-hidden flex flex-col">
                  {/* Header tipster */}
                  <div className="p-3 border-b border-neutral-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {pick.users?.avatar_url ? (
                        <img src={pick.users.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-neutral-200 flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">{pick.users?.pseudo ?? "?"}</p>
                        <p className="text-[10px] text-neutral-500 truncate">{pick.users?.email}</p>
                      </div>
                    </div>
                    <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full flex-shrink-0 ${
                      pick.status === "live" ? "bg-emerald-100 text-emerald-700" :
                      pick.status === "resolved" ? "bg-neutral-200 text-neutral-700" :
                      "bg-red-100 text-red-700"
                    }`}>
                      {pick.status === "live" ? "Live" : pick.status === "resolved" ? "Résolu" : "Rejeté"}
                    </span>
                  </div>

                  {/* Image — clic pour zoom plein écran */}
                  <button
                    type="button"
                    onClick={() => setImageModalUrl(pick.image_url)}
                    className="relative aspect-square bg-neutral-100 cursor-zoom-in group overflow-hidden"
                    aria-label="Voir l'image en plein écran"
                  >
                    <img
                      src={pick.image_url}
                      alt=""
                      className="w-full h-full"
                      style={{ objectFit: "contain", background: "rgba(0,0,0,0.04)" }}
                    />
                    {/* Indicateur visuel "cliquable" au hover */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/95 rounded-full px-3 py-1.5 text-xs font-bold text-neutral-900 shadow-lg">
                        🔍 Voir en grand
                      </div>
                    </div>
                  </button>

                  {/* Info */}
                  <div className="p-4 space-y-2">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-neutral-50 rounded-lg py-2 px-1">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-neutral-500">Sport</p>
                        <p className="text-xs font-bold mt-0.5 truncate">{pick.sport}</p>
                      </div>
                      <div className="bg-neutral-50 rounded-lg py-2 px-1">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-neutral-500">Cote</p>
                        <p className="text-xs font-bold mt-0.5">{parseFloat(String(pick.odds)).toFixed(2)}</p>
                      </div>
                      <div className="bg-neutral-50 rounded-lg py-2 px-1">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-neutral-500">Type</p>
                        <p className="text-xs font-bold mt-0.5">{pick.pick_type === "combiné" ? "Combi" : "Simple"}</p>
                      </div>
                    </div>

                    <p className="text-xs text-neutral-600">
                      <strong>Match :</strong> {matchDate.toLocaleString("fr-FR", {
                        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                      })}
                      {matchPassed && pick.status === "live" && (
                        <span className="ml-2 text-amber-700 font-bold">⏰ Match terminé</span>
                      )}
                    </p>
                    <p className="text-[10px] text-neutral-400">
                      Posté le {new Date(pick.submitted_at).toLocaleString("fr-FR", {
                        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                      })}
                    </p>

                    {/* Résultat actuel */}
                    {pick.result && (
                      <div className={`rounded-lg px-3 py-2 text-sm font-bold text-center ${
                        pick.result === "won" || pick.result === "half_won" ? "bg-emerald-50 text-emerald-800" :
                        pick.result === "refunded" ? "bg-blue-50 text-blue-800" :
                        "bg-red-50 text-red-800"
                      }`}>
                        {RESULT_LABELS.find(r => r.value === pick.result)?.label} · {pick.units_result! >= 0 ? "+" : ""}{pick.units_result}U
                      </div>
                    )}

                    {pick.admin_note && (
                      <p className="text-[10px] italic text-neutral-500 bg-amber-50 border border-amber-200 rounded p-2">
                        📝 {pick.admin_note}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="p-3 border-t bg-neutral-50 flex flex-wrap gap-2">
                    {pick.status === "live" && (
                      <>
                        <button
                          onClick={() => { setOpenModal({ pick, mode: "resolve" }); setSelectedResult(""); setAdminNote(""); }}
                          className="flex-1 cursor-pointer rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500"
                        >
                          ✓ Résoudre
                        </button>
                        <button
                          onClick={() => { setOpenModal({ pick, mode: "reject" }); setAdminNote(""); }}
                          className="cursor-pointer rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-500"
                        >
                          🚫 Rejeter
                        </button>
                      </>
                    )}
                    {pick.status === "resolved" && (
                      <>
                        <button
                          onClick={() => { setOpenModal({ pick, mode: "change_result" }); setSelectedResult(pick.result || ""); setAdminNote(pick.admin_note || ""); }}
                          className="flex-1 cursor-pointer rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white hover:bg-amber-500"
                        >
                          ✏️ Modifier résultat
                        </button>
                        <button
                          onClick={() => handleReopen(pick.id)}
                          className="cursor-pointer rounded-lg bg-neutral-700 px-3 py-2 text-xs font-bold text-white hover:bg-neutral-600"
                        >
                          ↻ Ré-ouvrir
                        </button>
                      </>
                    )}
                    {pick.status === "rejected" && (
                      <button
                        onClick={() => handleReopen(pick.id)}
                        className="flex-1 cursor-pointer rounded-lg bg-neutral-700 px-3 py-2 text-xs font-bold text-white hover:bg-neutral-600"
                      >
                        ↻ Ré-ouvrir
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(pick.id)}
                      className="cursor-pointer rounded-lg bg-white border-2 border-red-300 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal résolution */}
      {openModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setOpenModal(null)}>
          <div className="bg-white rounded-3xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-black text-neutral-900 mb-2">
              {openModal.mode === "resolve" ? "✓ Résoudre ce pick" :
               openModal.mode === "change_result" ? "✏️ Modifier le résultat" :
               "🚫 Rejeter ce pick"}
            </h2>
            <p className="text-xs text-neutral-500 mb-4">
              <strong>{openModal.pick.users?.pseudo}</strong> · {openModal.pick.sport} @ {parseFloat(String(openModal.pick.odds)).toFixed(2)}
            </p>

            {(openModal.mode === "resolve" || openModal.mode === "change_result") && (
              <div className="space-y-2 mb-4">
                <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Résultat</p>
                {RESULT_LABELS.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => setSelectedResult(r.value)}
                    className={`w-full cursor-pointer rounded-xl px-4 py-3 text-sm font-bold text-white transition ${
                      selectedResult === r.value ? `${r.color} ring-4 ring-offset-2 ring-emerald-300` : `${r.color} opacity-70 hover:opacity-100`
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            )}

            <div className="mb-4">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                Note admin (optionnel)
              </label>
              <textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder={openModal.mode === "reject" ? "Ex: Cote boostée non autorisée" : "Note interne visible seulement par l'admin"}
                className="mt-2 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
                rows={3}
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setOpenModal(null)}
                className="flex-1 cursor-pointer rounded-xl bg-neutral-200 px-4 py-3 text-sm font-bold text-neutral-700 hover:bg-neutral-300"
              >
                Annuler
              </button>
              <button
                onClick={handleSubmitModal}
                disabled={saving}
                className="flex-1 cursor-pointer rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {saving ? "Enregistrement..." : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal image plein écran */}
      {imageModalUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.92)", backdropFilter: "blur(8px)" }}
          onClick={() => setImageModalUrl(null)}
        >
          {/* Bouton fermer */}
          <button
            type="button"
            onClick={() => setImageModalUrl(null)}
            className="absolute top-4 right-4 h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 text-white text-2xl flex items-center justify-center transition cursor-pointer"
            aria-label="Fermer"
          >
            ✕
          </button>

          {/* Image en contain pour la voir entièrement */}
          <img
            src={imageModalUrl}
            alt=""
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-full"
            style={{ objectFit: "contain" }}
          />
        </div>
      )}
    </main>
  );
}