"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const MONTH_NAMES = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

function formatMonth(ym: string) {
  const [y, m] = ym.split("-");
  return `${MONTH_NAMES[parseInt(m) - 1]} ${y}`;
}

interface Bilan {
  id: string;
  title: string;
  slug: string;
  month: string;
  content: string;
  summary: string | null;
  cover_image: string | null;
  profit: number;
  roi: number;
  win_rate: number;
  total_picks: number;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
}

export default function AdminBilansPage() {
  const [bilans, setBilans] = useState<Bilan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Bilan | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // New bilan form
  const [newMonth, setNewMonth] = useState("");
  const [newTitle, setNewTitle] = useState("");

  useEffect(() => {
    fetchBilans();
  }, []);

  async function fetchBilans() {
    setLoading(true);
    const res = await fetch("/api/admin/bilans");
    const data = await res.json();
    setBilans(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  async function createBilan() {
    if (!newMonth || !newTitle) return;
    setSaving(true);

    const res = await fetch("/api/admin/bilans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle, month: newMonth }),
    });

    if (res.ok) {
      const bilan = await res.json();
      setBilans((prev) => [bilan, ...prev]);
      setCreating(false);
      setNewMonth("");
      setNewTitle("");
      setEditing(bilan);
    }

    setSaving(false);
  }

  async function saveBilan() {
    if (!editing) return;
    setSaving(true);
    setSaved(false);

    const res = await fetch("/api/admin/bilans", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing),
    });

    if (res.ok) {
      const updated = await res.json();
      setBilans((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      setEditing(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }

    setSaving(false);
  }

  async function togglePublish() {
    if (!editing) return;
    const updated = { ...editing, is_published: !editing.is_published };
    setEditing(updated);

    await fetch("/api/admin/bilans", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editing.id, is_published: !editing.is_published }),
    });

    setBilans((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
  }

  const inputClass =
    "w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 [color-scheme:dark] placeholder-white/20";

  const textareaClass = inputClass + " min-h-[200px] resize-y";

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="flex flex-col items-center gap-3 py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
          <p className="text-sm text-white/30">Chargement...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/fr/admin" className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-white/30 transition hover:text-white/60">
        ← Dashboard
      </Link>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: "rgba(16,185,129,0.15)" }}>
            <span className="text-lg">📊</span>
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-white">Bilans mensuels</h1>
            <p className="text-xs text-white/30">{bilans.length} bilan{bilans.length > 1 ? "s" : ""}</p>
          </div>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="cursor-pointer rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-400"
        >
          + Nouveau bilan
        </button>
      </div>

      {/* Create form */}
      {creating && (
        <div className="mt-4 rounded-xl border border-white/10 p-4" style={{ background: "linear-gradient(135deg, #111 0%, #0a3d2a 100%)" }}>
          <p className="text-sm font-bold text-white">Nouveau bilan</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">Mois</label>
              <input
                type="month"
                value={newMonth}
                onChange={(e) => {
                  setNewMonth(e.target.value);
                  if (e.target.value) setNewTitle(`Bilan ${formatMonth(e.target.value)}`);
                }}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">Titre</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Bilan Mars 2026"
                className={inputClass}
              />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={createBilan} disabled={saving || !newMonth || !newTitle} className="cursor-pointer rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
              {saving ? "..." : "Créer"}
            </button>
            <button onClick={() => setCreating(false)} className="cursor-pointer rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold text-white/50">
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Bilans list */}
      <div className="mt-6 space-y-2">
        {bilans.map((bilan) => (
          <button
            key={bilan.id}
            onClick={() => { setEditing({ ...bilan }); setSaved(false); }}
            className="flex w-full cursor-pointer items-center gap-4 rounded-xl border border-white/[0.06] p-4 text-left transition hover:border-white/10"
            style={{ background: "linear-gradient(135deg, #111 0%, #151515 100%)" }}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/[0.06] text-center">
              <div>
                <p className="text-xs font-extrabold text-white">{bilan.month.split("-")[1]}</p>
                <p className="text-[8px] text-white/30">{bilan.month.split("-")[0]}</p>
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-white">{bilan.title}</p>
                {bilan.is_published ? (
                  <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[8px] font-bold uppercase text-emerald-400">Publié</span>
                ) : (
                  <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[8px] font-bold uppercase text-amber-400">Brouillon</span>
                )}
              </div>
              <div className="mt-0.5 flex items-center gap-3 text-[10px] text-white/30">
                <span>{bilan.total_picks} picks</span>
                <span>WR {bilan.win_rate}%</span>
                <span>ROI {bilan.roi >= 0 ? "+" : ""}{bilan.roi}%</span>
                <span className={bilan.profit >= 0 ? "text-emerald-400/60" : "text-red-400/60"}>
                  {bilan.profit >= 0 ? "+" : ""}{bilan.profit}U
                </span>
              </div>
            </div>
            <span className="text-white/20">→</span>
          </button>
        ))}
      </div>

      {bilans.length === 0 && !creating && (
        <div className="mt-12 text-center">
          <p className="text-4xl">📊</p>
          <p className="mt-2 text-sm text-white/30">Aucun bilan pour le moment</p>
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-8 backdrop-blur-sm" onClick={() => setEditing(null)}>
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 shadow-2xl" style={{ background: "linear-gradient(135deg, #111111 0%, #0a2a1f 100%)" }} onClick={(e) => e.stopPropagation()}>
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
              <div>
                <p className="text-sm font-bold text-white">{editing.title}</p>
                <p className="text-[10px] text-white/30">{formatMonth(editing.month)}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={togglePublish}
                  className={`cursor-pointer rounded-lg px-3 py-1.5 text-[10px] font-bold transition ${
                    editing.is_published
                      ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                      : "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                  }`}
                >
                  {editing.is_published ? "Dépublier" : "Publier"}
                </button>
                <button onClick={() => setEditing(null)} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white/50 transition hover:bg-white/20">×</button>
              </div>
            </div>

            <div className="max-h-[75vh] overflow-y-auto px-6 py-4">
              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">Titre</label>
                  <input type="text" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className={inputClass} />
                </div>

                {/* Stats row */}
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-white/[0.06]" />
                  <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-neutral-500">Chiffres du mois</span>
                  <div className="h-px flex-1 bg-white/[0.06]" />
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">Total picks</label>
                    <input type="number" value={editing.total_picks} onChange={(e) => setEditing({ ...editing, total_picks: parseInt(e.target.value) || 0 })} className={inputClass} />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">Win rate %</label>
                    <input type="number" step="0.1" value={editing.win_rate} onChange={(e) => setEditing({ ...editing, win_rate: parseFloat(e.target.value) || 0 })} className={inputClass} />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">ROI %</label>
                    <input type="number" step="0.1" value={editing.roi} onChange={(e) => setEditing({ ...editing, roi: parseFloat(e.target.value) || 0 })} className={inputClass} />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">Profit (U)</label>
                    <input type="number" step="0.1" value={editing.profit} onChange={(e) => setEditing({ ...editing, profit: parseFloat(e.target.value) || 0 })} className={inputClass} />
                  </div>
                </div>

                {/* Summary */}
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">Résumé court (affiché dans la liste)</label>
                  <input type="text" value={editing.summary ?? ""} onChange={(e) => setEditing({ ...editing, summary: e.target.value })} placeholder="Mois positif avec un ROI solide..." className={inputClass} />
                </div>

                {/* Content */}
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-white/[0.06]" />
                  <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-neutral-500">Contenu du bilan</span>
                  <div className="h-px flex-1 bg-white/[0.06]" />
                </div>

                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">
                    Contenu (texte libre — saut de ligne = nouveau paragraphe)
                  </label>
                  <textarea
                    value={editing.content}
                    onChange={(e) => setEditing({ ...editing, content: e.target.value })}
                    placeholder={"Résultats du mois, meilleurs picks, pires picks, contexte sportif, objectifs du mois suivant..."}
                    className={textareaClass}
                    rows={12}
                  />
                </div>

                {/* Cover image */}
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">Image de couverture (URL)</label>
                  <input type="text" value={editing.cover_image ?? ""} onChange={(e) => setEditing({ ...editing, cover_image: e.target.value })} placeholder="/bilans/2026-03.jpg" className={inputClass} />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-white/[0.06] px-6 py-4">
              <button
                onClick={saveBilan}
                disabled={saving}
                className="w-full cursor-pointer rounded-xl py-3 text-sm font-bold text-white transition disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)", boxShadow: "0 4px 14px rgba(16,185,129,0.3)" }}
              >
                {saving ? "Enregistrement..." : saved ? "✅ Enregistré !" : "💾 Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}