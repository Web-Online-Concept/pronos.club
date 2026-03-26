"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Review {
  id: string;
  user_id: string;
  pseudo: string;
  avatar_url: string | null;
  rating: number;
  content: string;
  status: string;
  admin_note: string | null;
  created_at: string;
  approved_at: string | null;
}

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState<Review | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchReviews();
  }, []);

  async function fetchReviews() {
    setLoading(true);
    const res = await fetch("/api/reviews?admin=true");
    const data = await res.json();
    setReviews(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  async function updateStatus(id: string, status: string) {
    setSaving(true);
    await fetch("/api/reviews", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    setReviews((prev) => prev.map((r) => r.id === id ? { ...r, status, approved_at: status === "approved" ? new Date().toISOString() : r.approved_at } : r));
    setSaving(false);
  }

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    const res = await fetch("/api/reviews", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editing.id, content: editing.content, admin_note: editing.admin_note }),
    });
    if (res.ok) {
      const updated = await res.json();
      setReviews((prev) => prev.map((r) => r.id === updated.id ? updated : r));
      setEditing(null);
    }
    setSaving(false);
  }

  async function deleteReview(id: string) {
    if (!confirm("Supprimer cet avis définitivement ?")) return;
    await fetch(`/api/reviews?id=${id}`, { method: "DELETE" });
    setReviews((prev) => prev.filter((r) => r.id !== id));
  }

  const filtered = filter === "all" ? reviews : reviews.filter((r) => r.status === filter);
  const pending = reviews.filter((r) => r.status === "pending").length;

  const statusColors: Record<string, string> = {
    pending: "bg-amber-500/20 text-amber-400",
    approved: "bg-emerald-500/20 text-emerald-400",
    rejected: "bg-red-500/20 text-red-400",
  };

  const statusLabels: Record<string, string> = {
    pending: "En attente",
    approved: "Approuvé",
    rejected: "Refusé",
  };

  const inputClass = "w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 placeholder-white/20";

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/fr/admin" className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-white/30 transition hover:text-white/60">
        ← Dashboard
      </Link>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: "rgba(245,158,11,0.15)" }}>
            <span className="text-lg">⭐</span>
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-white">Avis clients</h1>
            <p className="text-xs text-white/30">
              {reviews.length} avis · {pending > 0 && <span className="text-amber-400">{pending} en attente</span>}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-6 flex gap-2">
        {[
          { value: "all", label: "Tous" },
          { value: "pending", label: `En attente (${pending})` },
          { value: "approved", label: "Approuvés" },
          { value: "rejected", label: "Refusés" },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`cursor-pointer rounded-lg px-3 py-1.5 text-[10px] font-bold transition ${
              filter === f.value ? "bg-emerald-500/20 text-emerald-400" : "bg-white/[0.05] text-white/30 hover:text-white/50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Reviews list */}
      {loading ? (
        <div className="mt-8 flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-12 text-center">
          <p className="text-4xl">⭐</p>
          <p className="mt-2 text-sm text-white/30">Aucun avis {filter !== "all" ? statusLabels[filter]?.toLowerCase() : ""}</p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {filtered.map((review) => (
            <div
              key={review.id}
              className="overflow-hidden rounded-xl border border-white/[0.06] p-4"
              style={{ background: "linear-gradient(135deg, #111 0%, #151515 100%)" }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 text-sm font-bold text-emerald-400">
                    {review.avatar_url ? (
                      <img src={review.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
                    ) : (
                      review.pseudo.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{review.pseudo}</p>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <span key={s} className="text-xs" style={{ color: s <= review.rating ? "#f59e0b" : "#4b5563" }}>★</span>
                        ))}
                      </div>
                      <span className="text-[10px] text-white/20">
                        {new Date(review.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </div>
                  </div>
                </div>
                <span className={`rounded px-2 py-0.5 text-[8px] font-bold uppercase ${statusColors[review.status]}`}>
                  {statusLabels[review.status]}
                </span>
              </div>

              <p className="mt-3 text-sm text-white/50 leading-relaxed">{review.content}</p>

              {review.admin_note && (
                <p className="mt-2 text-[10px] text-amber-400/60">Note admin : {review.admin_note}</p>
              )}

              {/* Actions */}
              <div className="mt-3 flex flex-wrap gap-2 border-t border-white/[0.04] pt-3">
                {review.status !== "approved" && (
                  <button onClick={() => updateStatus(review.id, "approved")} disabled={saving} className="cursor-pointer rounded-lg bg-emerald-500/20 px-3 py-1 text-[10px] font-bold text-emerald-400 transition hover:bg-emerald-500/30 disabled:opacity-50">
                    ✅ Approuver
                  </button>
                )}
                {review.status !== "rejected" && (
                  <button onClick={() => updateStatus(review.id, "rejected")} disabled={saving} className="cursor-pointer rounded-lg bg-red-500/20 px-3 py-1 text-[10px] font-bold text-red-400 transition hover:bg-red-500/30 disabled:opacity-50">
                    ❌ Refuser
                  </button>
                )}
                <button onClick={() => setEditing({ ...review })} className="cursor-pointer rounded-lg bg-white/[0.05] px-3 py-1 text-[10px] font-bold text-white/30 transition hover:text-white/50">
                  ✏️ Modifier
                </button>
                <button onClick={() => deleteReview(review.id)} className="cursor-pointer rounded-lg bg-white/[0.05] px-3 py-1 text-[10px] font-bold text-red-400/50 transition hover:text-red-400">
                  🗑 Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setEditing(null)}>
          <div className="w-full max-w-md rounded-2xl border border-white/10 p-6 shadow-2xl" style={{ background: "linear-gradient(135deg, #111111 0%, #0a2a1f 100%)" }} onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-white">Modifier l&apos;avis de {editing.pseudo}</h3>

            <div className="mt-4">
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">Contenu</label>
              <textarea
                value={editing.content}
                onChange={(e) => setEditing({ ...editing, content: e.target.value })}
                rows={5}
                className={inputClass}
              />
            </div>

            <div className="mt-3">
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">Note admin (privée)</label>
              <input
                type="text"
                value={editing.admin_note || ""}
                onChange={(e) => setEditing({ ...editing, admin_note: e.target.value })}
                placeholder="Raison de la modification..."
                className={inputClass}
              />
            </div>

            <div className="mt-4 flex gap-2">
              <button onClick={saveEdit} disabled={saving} className="cursor-pointer rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
                {saving ? "..." : "Enregistrer"}
              </button>
              <button onClick={() => setEditing(null)} className="cursor-pointer rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold text-white/50">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}