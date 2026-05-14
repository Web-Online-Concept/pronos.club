// src/components/o05/PsychoSection.tsx
//
// Module 5 PSYCHO : flags + notes saisis manuellement par l'utilisateur.
// Version mise a jour : appelle /api/over-05/match/[id] PATCH au lieu
// de l'ancien endpoint /api/over-05-buts-equipes/opportunities.
//
// Conservation des flags et style visuel de l'ancienne version.

"use client";

import { useState } from "react";

type PsychoFlags = {
  derby?: boolean;
  injury_key?: boolean;
  suspension_key?: boolean;
  motivation_strong?: boolean;
  weather_bad?: boolean;
  long_travel?: boolean;
};

type PsychoSectionProps = {
  matchId: string;
  initialNotes: string | null;
  initialFlags: PsychoFlags | null;
};

const FLAG_LABELS: Array<{ key: keyof PsychoFlags; label: string; emoji: string }> = [
  { key: "derby", label: "Derby / rivalité forte", emoji: "🏆" },
  { key: "injury_key", label: "Blessure clé attaquant/défense", emoji: "🚑" },
  { key: "suspension_key", label: "Suspension importante", emoji: "🚫" },
  { key: "motivation_strong", label: "Motivation extra forte", emoji: "🔥" },
  { key: "weather_bad", label: "Météo défavorable", emoji: "☔" },
  { key: "long_travel", label: "Voyage long / fatigue", emoji: "✈️" },
];

export default function PsychoSection({
  matchId,
  initialNotes,
  initialFlags,
}: PsychoSectionProps) {
  const [notes, setNotes] = useState(initialNotes || "");
  const [flags, setFlags] = useState<PsychoFlags>(initialFlags || {});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const toggleFlag = (key: keyof PsychoFlags) => {
    setFlags((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/over-05/match/${matchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          psycho_notes: notes,
          psycho_flags: flags,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert("Erreur : " + (err.error || res.status));
        return;
      }
      setSavedAt(new Date());
    } catch {
      alert("Erreur réseau");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="overflow-hidden rounded-xl border border-white/[0.06] p-6"
      style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}
    >
      <h3 className="text-base font-black text-white">
        🧠 Module 5 — Analyse psychologique
      </h3>
      <p className="mt-1 text-xs text-white/40">
        Saisis ici les éléments contextuels que l&apos;outil ne peut pas détecter automatiquement.
      </p>

      {/* Flags structurés */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {FLAG_LABELS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => toggleFlag(f.key)}
            className={`flex items-center gap-2 rounded-xl border-2 p-3 text-xs font-bold transition ${
              flags[f.key]
                ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                : "border-white/10 bg-white/5 text-white/60 hover:border-white/20"
            }`}
          >
            <span className="text-base">{f.emoji}</span>
            <span className="text-left">{f.label}</span>
          </button>
        ))}
      </div>

      {/* Notes texte libre */}
      <div className="mt-4">
        <label className="text-xs font-bold uppercase tracking-wider text-white/40">
          Notes complémentaires
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ex: l'équipe revient d'un déplacement européen jeudi soir, ou alors elle a besoin de gagner pour assurer le titre, ou encore c'est un derby régional avec ambiance bouillante..."
          rows={4}
          className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-emerald-500"
        />
      </div>

      {/* Save */}
      <div className="mt-4 flex items-center justify-between">
        {savedAt && (
          <span className="text-xs text-emerald-400">
            ✓ Enregistré à {savedAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="ml-auto rounded-xl bg-emerald-600 px-6 py-2 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
        >
          {saving ? "..." : "💾 Enregistrer"}
        </button>
      </div>
    </div>
  );
}