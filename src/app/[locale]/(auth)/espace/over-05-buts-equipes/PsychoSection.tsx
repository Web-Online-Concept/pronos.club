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
  opportunityId: string;
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

export default function PsychoSection({ opportunityId, initialNotes, initialFlags }: PsychoSectionProps) {
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
      const res = await fetch("/api/over-05-buts-equipes/opportunities", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opportunity_id: opportunityId,
          psycho_notes: notes,
          psycho_flags: flags,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert("Erreur : " + (err.error || res.status));
        return;
      }
      setSavedAt(new Date());
    } catch (err) {
      alert("Erreur réseau");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-black text-neutral-900">🧠 Module 5 — Analyse psychologique</h3>
      <p className="mt-1 text-xs text-neutral-500">
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
                ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300"
            }`}
          >
            <span className="text-base">{f.emoji}</span>
            <span className="text-left">{f.label}</span>
          </button>
        ))}
      </div>

      {/* Notes texte libre */}
      <div className="mt-4">
        <label className="text-xs font-bold uppercase tracking-wider text-neutral-500">
          Notes complémentaires
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ex: l'équipe revient d'un déplacement européen jeudi soir, ou alors elle a besoin de gagner pour assurer le titre, ou encore c'est un derby régional avec ambiance bouillante..."
          rows={4}
          className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 placeholder-neutral-400 outline-none focus:border-emerald-500"
        />
      </div>

      {/* Save */}
      <div className="mt-4 flex items-center justify-between">
        {savedAt && (
          <span className="text-xs text-emerald-600">
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