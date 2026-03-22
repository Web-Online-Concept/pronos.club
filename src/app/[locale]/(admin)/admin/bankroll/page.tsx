"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type BkMode = "units_only" | "fixed_unit" | "percent_bankroll";
type AutoRecalc = "none" | "per_pick" | "weekly" | "monthly";

interface TipsterBankroll {
  mode: BkMode;
  initial_bankroll: number;
  current_bankroll: number;
  unit_value: number;
  unit_percent: number;
  auto_recalc: AutoRecalc;
  show_on_site: boolean;
}

const DEFAULT_CONFIG: TipsterBankroll = {
  mode: "units_only",
  initial_bankroll: 0,
  current_bankroll: 0,
  unit_value: 0,
  unit_percent: 0,
  auto_recalc: "none",
  show_on_site: false,
};

const MODE_OPTIONS: { value: BkMode; label: string; desc: string; icon: string; accent: string }[] = [
  {
    value: "units_only",
    label: "Unités uniquement",
    desc: "Suivi classique en unités, sans gestion monétaire.",
    icon: "📊",
    accent: "#9ca3af",
  },
  {
    value: "fixed_unit",
    label: "Mise fixe par unité",
    desc: "Vous définissez combien vaut 1 unité en euros. Simple et efficace.",
    icon: "💰",
    accent: "#f59e0b",
  },
  {
    value: "percent_bankroll",
    label: "% de bankroll",
    desc: "Votre mise s'adapte automatiquement à votre bankroll actuelle.",
    icon: "📈",
    accent: "#10b981",
  },
];

const RECALC_OPTIONS: { value: AutoRecalc; label: string; icon: string; desc: string }[] = [
  { value: "none", label: "Manuel", icon: "✋", desc: "Vous modifiez la valeur de l'unité quand vous le souhaitez." },
  { value: "per_pick", label: "Par prono", icon: "🎯", desc: "L'unité est recalculée après chaque résultat de prono." },
  { value: "weekly", label: "Hebdo", icon: "📅", desc: "L'unité est recalculée chaque lundi à partir de votre bankroll." },
  { value: "monthly", label: "Mensuel", icon: "📆", desc: "L'unité est recalculée le 1er de chaque mois." },
];

export default function TipsterBankrollPage() {
  const [config, setConfig] = useState<TipsterBankroll>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [mode, setMode] = useState<BkMode>("units_only");
  const [bankroll, setBankroll] = useState("");
  const [currentBk, setCurrentBk] = useState("");
  const [unitValue, setUnitValue] = useState("");
  const [unitPercent, setUnitPercent] = useState("");
  const [autoRecalc, setAutoRecalc] = useState<AutoRecalc>("none");
  const [showOnSite, setShowOnSite] = useState(false);

  useEffect(() => {
    fetch("/api/admin/tipster-bankroll")
      .then((r) => r.json())
      .then((data: TipsterBankroll) => {
        setConfig(data);
        setMode(data.mode ?? "units_only");
        setBankroll(data.initial_bankroll ? String(data.initial_bankroll) : "");
        setCurrentBk(data.current_bankroll ? String(data.current_bankroll) : "");
        setUnitValue(data.unit_value ? String(data.unit_value) : "");
        setUnitPercent(data.unit_percent ? String(data.unit_percent) : "");
        setAutoRecalc(data.auto_recalc ?? "none");
        setShowOnSite(data.show_on_site ?? false);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function handleModeChange(newMode: BkMode) {
    setMode(newMode);
    setError("");
    if (newMode === "units_only") {
      setAutoRecalc("none");
      setShowOnSite(false);
    }
  }

  // Validation
  const validate = useCallback((): string | null => {
    if (mode === "units_only") return null;

    const bk = parseFloat(bankroll);
    if (!bk || bk <= 0) return "Veuillez renseigner la bankroll de départ.";

    if (mode === "fixed_unit") {
      const uv = parseFloat(unitValue);
      if (!uv || uv <= 0) return "Veuillez renseigner la valeur de 1 unité.";
      const cbk = parseFloat(currentBk) || bk;
      if (uv > cbk) return "La valeur de l'unité ne peut pas dépasser votre bankroll.";
    }

    if (mode === "percent_bankroll") {
      const up = parseFloat(unitPercent);
      if (!up || up <= 0) return "Veuillez renseigner le pourcentage par unité.";
      if (up > 25) return "Un pourcentage supérieur à 25% est très risqué. La sauvegarde est quand même possible.";
    }

    return null;
  }, [mode, bankroll, currentBk, unitValue, unitPercent]);

  async function handleSave() {
    const validationError = validate();
    if (validationError && !validationError.includes("quand même possible")) {
      setError(validationError);
      return;
    }
    if (validationError) {
      setError(validationError);
    }

    setSaving(true);
    setSaved(false);
    setError("");

    const bk = parseFloat(bankroll) || 0;
    const cbk = parseFloat(currentBk) || bk;
    const uv = parseFloat(unitValue) || 0;
    const up = parseFloat(unitPercent) || 0;

    // Calculate initial_unit_count (fixed, set once)
    let initialUnitCount = 0;
    if (mode === "fixed_unit" && uv > 0 && bk > 0) {
      initialUnitCount = Math.round((bk / uv) * 100) / 100;
    } else if (mode === "percent_bankroll" && up > 0) {
      initialUnitCount = Math.round((100 / up) * 100) / 100;
    }

    const payload = {
      mode,
      initial_bankroll: mode === "units_only" ? 0 : bk,
      current_bankroll: mode === "units_only" ? 0 : cbk,
      unit_value: mode === "fixed_unit" ? uv : 0,
      unit_percent: mode === "percent_bankroll" ? up : 0,
      auto_recalc: mode === "fixed_unit" ? autoRecalc : mode === "percent_bankroll" ? "per_pick" : "none",
      show_on_site: mode === "units_only" ? false : showOnSite,
      initial_unit_count: mode === "units_only" ? 0 : initialUnitCount,
    };

    try {
      const res = await fetch("/api/admin/tipster-bankroll", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.error ?? "Erreur lors de l'enregistrement. Réessayez.");
      }
    } catch {
      setError("Erreur réseau. Vérifiez votre connexion.");
    }

    setSaving(false);
  }

  // Computed
  const bkValue = parseFloat(bankroll) || 0;
  const cbkValue = parseFloat(currentBk) || bkValue;
  const computedUnit = mode === "fixed_unit"
    ? parseFloat(unitValue) || 0
    : mode === "percent_bankroll"
    ? (cbkValue * (parseFloat(unitPercent) || 0)) / 100
    : 0;
  const pnl = cbkValue - bkValue;
  const pnlPercent = bkValue > 0 ? (pnl / bkValue) * 100 : 0;
  const unitsInBk = computedUnit > 0 ? Math.round(cbkValue / computedUnit) : 0;

  const inputClass =
    "w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-center font-mono text-lg font-bold text-white outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 [color-scheme:dark] placeholder-white/20";

  if (loading) {
    return (
      <main className="mx-auto max-w-lg px-4 py-8">
        <div className="flex flex-col items-center gap-3 py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
          <p className="text-sm text-white/30">Chargement...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <Link href="/fr/admin" className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-white/30 transition hover:text-white/60">
        ← Dashboard
      </Link>

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: "rgba(245,158,11,0.15)" }}>
          <span className="text-lg">🏦</span>
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-white">Bankroll Tipster</h1>
          <p className="text-xs text-white/30">Gérez votre capital et la valeur de l&apos;unité</p>
        </div>
      </div>

      {/* Current state card */}
      {config.mode !== "units_only" && config.current_bankroll > 0 && (
        <div
          className="mt-6 overflow-hidden rounded-2xl border border-white/[0.06] p-6 text-center"
          style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #2e1a06 100%)" }}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-amber-400/60">Bankroll actuelle</p>
          <p className="mt-2 font-mono text-4xl font-extrabold text-white">
            {config.current_bankroll.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}€
          </p>
          {config.initial_bankroll > 0 && (
            <div className="mt-2 inline-flex items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                config.current_bankroll >= config.initial_bankroll
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-red-500/15 text-red-400"
              }`}>
                {config.current_bankroll >= config.initial_bankroll ? "+" : ""}
                {(config.current_bankroll - config.initial_bankroll).toFixed(2)}€
              </span>
              <span className={`text-xs font-bold ${
                config.current_bankroll >= config.initial_bankroll ? "text-emerald-400/60" : "text-red-400/60"
              }`}>
                ({(((config.current_bankroll - config.initial_bankroll) / config.initial_bankroll) * 100).toFixed(1)}%)
              </span>
            </div>
          )}
          <div className="mt-3 flex flex-wrap justify-center gap-4 text-[10px] text-white/25">
            <span>Capital initial : {config.initial_bankroll.toLocaleString("fr-FR")}€</span>
            <span>Mode : {config.mode === "fixed_unit" ? `Mise fixe — 1U = ${config.unit_value}€` : `% de BK — 1U = ${config.unit_percent}%`}</span>
            <span>{config.show_on_site ? "✅ Visible sur le site" : "🔒 Masqué"}</span>
          </div>
        </div>
      )}

      {/* Mode selection */}
      <div className="mt-6">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">Choisissez votre mode de gestion</p>
        <div className="space-y-2">
          {MODE_OPTIONS.map((opt) => {
            const selected = mode === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => handleModeChange(opt.value)}
                className={`flex w-full cursor-pointer items-center gap-4 rounded-xl border p-4 text-left transition ${
                  selected
                    ? "border-amber-500/40 shadow-lg"
                    : "border-white/[0.06] hover:border-white/10"
                }`}
                style={{
                  background: selected
                    ? `linear-gradient(135deg, #111 0%, ${opt.accent}15 100%)`
                    : "linear-gradient(135deg, #111 0%, #151515 100%)",
                }}
              >
                <div
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-xl"
                  style={{ background: `${opt.accent}20` }}
                >
                  {opt.icon}
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-bold ${selected ? "text-white" : "text-white/60"}`}>
                    {opt.label}
                  </p>
                  <p className="mt-0.5 text-[11px] text-white/30">{opt.desc}</p>
                </div>
                {selected && (
                  <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-amber-500">
                    <span className="text-xs text-white">✓</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Configuration — only if not units_only */}
      {mode !== "units_only" && (
        <div className="mt-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-white/[0.06]" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">Configuration</span>
            <div className="h-px flex-1 bg-white/[0.06]" />
          </div>

          {/* Bankroll initiale */}
          <div
            className="rounded-xl border border-white/[0.06] p-4"
            style={{ background: "linear-gradient(135deg, #111 0%, #151515 100%)" }}
          >
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">
              🏦 Bankroll de départ
            </label>
            <p className="mb-2 text-[10px] text-white/15">Le montant total de votre capital de départ.</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.01"
                min="0"
                value={bankroll}
                onChange={(e) => {
                  setBankroll(e.target.value);
                  setError("");
                  if (!currentBk || currentBk === bankroll) setCurrentBk(e.target.value);
                }}
                placeholder="5000"
                className={inputClass}
                inputMode="decimal"
              />
              <span className="text-lg font-bold text-white/30">€</span>
            </div>
          </div>

          {/* Bankroll actuelle */}
          <div
            className="rounded-xl border border-white/[0.06] p-4"
            style={{ background: "linear-gradient(135deg, #111 0%, #151515 100%)" }}
          >
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">
              📊 Bankroll actuelle
            </label>
            <p className="mb-2 text-[10px] text-white/15">Votre capital actuel. Modifiez-le à tout moment.</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.01"
                min="0"
                value={currentBk}
                onChange={(e) => {
                  setCurrentBk(e.target.value);
                  setError("");
                }}
                placeholder={bankroll || "5000"}
                className={inputClass}
                inputMode="decimal"
              />
              <span className="text-lg font-bold text-white/30">€</span>
            </div>
            {bkValue > 0 && cbkValue > 0 && cbkValue !== bkValue && (
              <p className={`mt-2 text-center text-xs font-bold ${pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}€ ({pnlPercent >= 0 ? "+" : ""}{pnlPercent.toFixed(1)}%)
              </p>
            )}
          </div>

          {/* Unit value — fixed mode */}
          {mode === "fixed_unit" && (
            <div
              className="rounded-xl border border-white/[0.06] p-4"
              style={{ background: "linear-gradient(135deg, #111 0%, #151515 100%)" }}
            >
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">
                💰 Valeur de 1 unité
              </label>
              <p className="mb-2 text-[10px] text-white/15">Combien vaut 1U en euros. Ex: BK de 5000€ → 1U = 50€ (1% de la BK).</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={unitValue}
                  onChange={(e) => {
                    setUnitValue(e.target.value);
                    setError("");
                  }}
                  placeholder="50"
                  className={inputClass}
                  inputMode="decimal"
                />
                <span className="text-lg font-bold text-white/30">€</span>
              </div>
              {cbkValue > 0 && computedUnit > 0 && (
                <p className="mt-2 text-center text-xs text-white/30">
                  → <span className="font-bold text-white/50">{unitsInBk} unités</span> dans votre bankroll ({((computedUnit / cbkValue) * 100).toFixed(1)}% par unité)
                </p>
              )}
            </div>
          )}

          {/* Unit percent — percent mode */}
          {mode === "percent_bankroll" && (
            <div
              className="rounded-xl border border-white/[0.06] p-4"
              style={{ background: "linear-gradient(135deg, #111 0%, #151515 100%)" }}
            >
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">
                📈 1 unité = quel % de votre bankroll ?
              </label>
              <p className="mb-2 text-[10px] text-white/15">Conseil : entre 1% et 3% pour une gestion saine. Au-delà de 5%, le risque augmente.</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="100"
                  value={unitPercent}
                  onChange={(e) => {
                    setUnitPercent(e.target.value);
                    setError("");
                  }}
                  placeholder="1"
                  className={inputClass}
                  inputMode="decimal"
                />
                <span className="text-lg font-bold text-white/30">%</span>
              </div>
              {cbkValue > 0 && computedUnit > 0 && (
                <p className="mt-2 text-center text-xs text-white/30">
                  → Avec votre BK actuelle : <span className="font-bold text-amber-400">1U = {computedUnit.toFixed(2)}€</span> ({unitsInBk} unités)
                </p>
              )}
            </div>
          )}

          {/* Auto recalc — fixed_unit only */}
          {mode === "fixed_unit" && (
            <div
              className="rounded-xl border border-white/[0.06] p-4"
              style={{ background: "linear-gradient(135deg, #111 0%, #151515 100%)" }}
            >
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">
                🔄 Recalcul automatique de l&apos;unité
              </label>
              <p className="mb-2 text-[10px] text-white/15">Comment souhaitez-vous que la valeur de votre unité soit mise à jour ?</p>
              <div className="grid grid-cols-4 gap-1.5">
                {RECALC_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setAutoRecalc(opt.value)}
                    className={`cursor-pointer rounded-lg px-2 py-2.5 text-center transition ${
                      autoRecalc === opt.value
                        ? "bg-amber-500/20 ring-1 ring-amber-500/40"
                        : "bg-white/[0.03] hover:bg-white/[0.06]"
                    }`}
                  >
                    <span className="text-base">{opt.icon}</span>
                    <p className={`mt-0.5 text-[9px] font-bold ${
                      autoRecalc === opt.value ? "text-amber-400" : "text-white/30"
                    }`}>
                      {opt.label}
                    </p>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-center text-[10px] text-white/20">
                {RECALC_OPTIONS.find((o) => o.value === autoRecalc)?.desc}
              </p>
            </div>
          )}

          {/* Info bulle mode % */}
          {mode === "percent_bankroll" && (
            <div
              className="rounded-xl border border-amber-500/20 p-3"
              style={{ background: "rgba(245,158,11,0.05)" }}
            >
              <p className="text-center text-xs text-amber-400/70">
                💡 En mode % de bankroll, la mise est recalculée automatiquement après chaque résultat.
              </p>
              <p className="mt-1 text-center text-[10px] text-amber-400/40">
                Bankroll monte → mise monte. Bankroll descend → mise descend.
              </p>
            </div>
          )}

          {/* Show on site toggle */}
          <div
            className="flex items-center justify-between rounded-xl border border-white/[0.06] p-4"
            style={{ background: "linear-gradient(135deg, #111 0%, #151515 100%)" }}
          >
            <div>
              <p className="text-sm font-bold text-white/70">Afficher sur le site</p>
              <p className="mt-0.5 text-[10px] text-white/25">
                La bankroll et la valeur de l&apos;unité seront visibles par les utilisateurs sur les pages Stats et Pronostics.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowOnSite(!showOnSite)}
              className={`relative h-7 w-12 flex-shrink-0 cursor-pointer rounded-full transition ${
                showOnSite ? "bg-amber-500" : "bg-neutral-600"
              }`}
            >
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                  showOnSite ? "left-[22px]" : "left-0.5"
                }`}
              />
            </button>
          </div>

          {/* Preview */}
          {cbkValue > 0 && computedUnit > 0 && (
            <div
              className="overflow-hidden rounded-2xl border border-white/[0.06]"
              style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #2e1a06 100%)" }}
            >
              <div className="border-b border-white/[0.06] px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-amber-400">
                  ⚡ Aperçu — ce que verront les utilisateurs
                </p>
              </div>
              <div className="px-4 py-3">
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-xs text-white/40">Bankroll tipster</span>
                  <span className="font-mono text-sm font-bold text-white">{cbkValue.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}€</span>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-xs text-white/40">Valeur de 1U</span>
                  <span className="font-mono text-sm font-extrabold text-amber-400">{computedUnit.toFixed(2)}€</span>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-xs text-white/40">Unités disponibles</span>
                  <span className="font-mono text-sm font-bold text-white/50">{unitsInBk}U</span>
                </div>
                <div className="my-2 h-px bg-white/[0.06]" />
                <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-white/20">Mises affichées sur le site :</p>
                {[0.5, 1, 2, 3].map((stake) => (
                  <div key={stake} className="flex items-center justify-between py-1">
                    <span className="flex items-center gap-2 text-xs text-white/30">
                      <span className="inline-flex h-5 w-8 items-center justify-center rounded bg-white/5 font-mono text-[10px] font-bold text-white/50">
                        {stake}U
                      </span>
                      Mise
                    </span>
                    <span className="font-mono text-xs font-semibold text-white/60">{(computedUnit * stake).toFixed(2)}€</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-center text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-6 w-full cursor-pointer rounded-xl py-4 text-sm font-bold text-white transition disabled:opacity-50"
        style={{
          background: saved
            ? "linear-gradient(135deg, #92400e 0%, #b45309 100%)"
            : "linear-gradient(135deg, #d97706 0%, #f59e0b 100%)",
          boxShadow: "0 4px 20px rgba(245,158,11,0.3)",
        }}
      >
        {saving ? (
          <span className="flex items-center justify-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Enregistrement...
          </span>
        ) : saved ? (
          "✅ Configuration enregistrée !"
        ) : (
          "💾 Enregistrer"
        )}
      </button>

      {/* Reset to units only */}
      {config.mode !== "units_only" && mode !== "units_only" && (
        <button
          onClick={() => {
            handleModeChange("units_only");
            setBankroll("");
            setCurrentBk("");
            setUnitValue("");
            setUnitPercent("");
            setShowOnSite(false);
          }}
          className="mt-3 w-full cursor-pointer rounded-xl border border-white/[0.06] py-3 text-xs font-semibold text-white/30 transition hover:border-white/10 hover:text-white/50"
        >
          Désactiver la gestion monétaire
        </button>
      )}
    </main>
  );
}