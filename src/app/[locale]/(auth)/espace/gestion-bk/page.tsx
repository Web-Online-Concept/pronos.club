"use client";

import { useState, useEffect, useCallback } from "react";
import EspaceHero from "@/components/layout/EspaceHero";
import { useTranslations } from "next-intl";

type BkMode = "units_only" | "fixed_unit" | "percent_bankroll";
type AutoRecalc = "none" | "per_pick" | "weekly" | "monthly";

interface BankrollConfig {
  mode: BkMode;
  initial_bankroll: number;
  current_bankroll: number;
  unit_value: number;
  unit_percent: number;
  auto_recalc: AutoRecalc;
}

const DEFAULT_CONFIG: BankrollConfig = {
  mode: "units_only",
  initial_bankroll: 0,
  current_bankroll: 0,
  unit_value: 0,
  unit_percent: 0,
  auto_recalc: "none",
};

export default function GestionBKPage() {
  const t = useTranslations("bankroll");

  const MODE_OPTIONS: { value: BkMode; label: string; desc: string; icon: string; accent: string }[] = [
    { value: "units_only", label: t("m1_label"), desc: t("m1_desc"), icon: "📊", accent: "#9ca3af" },
    { value: "fixed_unit", label: t("m2_label"), desc: t("m2_desc"), icon: "💰", accent: "#f59e0b" },
    { value: "percent_bankroll", label: t("m3_label"), desc: t("m3_desc"), icon: "📈", accent: "#10b981" },
  ];

  const RECALC_OPTIONS: { value: AutoRecalc; label: string; icon: string; desc: string }[] = [
    { value: "none", label: t("recalc_manual"), icon: "✋", desc: t("recalc_manual_desc") },
    { value: "per_pick", label: t("recalc_pick"), icon: "🎯", desc: t("recalc_pick_desc") },
    { value: "weekly", label: t("recalc_weekly"), icon: "📅", desc: t("recalc_weekly_desc") },
    { value: "monthly", label: t("recalc_monthly"), icon: "📆", desc: t("recalc_monthly_desc") },
  ];

  const [config, setConfig] = useState<BankrollConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [mode, setMode] = useState<BkMode>("units_only");
  const [bankroll, setBankroll] = useState("");
  const [currentBk, setCurrentBk] = useState("");
  const [unitValue, setUnitValue] = useState("");
  const [unitPercent, setUnitPercent] = useState("");
  const [autoRecalc, setAutoRecalc] = useState<AutoRecalc>("none");

  useEffect(() => {
    fetch("/api/user-bankroll")
      .then((r) => r.json())
      .then((data: BankrollConfig) => {
        setConfig(data);
        setMode(data.mode);
        setBankroll(data.initial_bankroll ? String(data.initial_bankroll) : "");
        setCurrentBk(data.current_bankroll ? String(data.current_bankroll) : "");
        setUnitValue(data.unit_value ? String(data.unit_value) : "");
        setUnitPercent(data.unit_percent ? String(data.unit_percent) : "");
        setAutoRecalc(data.auto_recalc ?? "none");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function handleModeChange(newMode: BkMode) {
    setMode(newMode);
    setError("");
    if (newMode === "units_only") setAutoRecalc("none");
  }

  const validate = useCallback((): string | null => {
    if (mode === "units_only") return null;
    const bk = parseFloat(bankroll);
    if (!bk || bk <= 0) return t("val_bk");
    if (mode === "fixed_unit") {
      const uv = parseFloat(unitValue);
      if (!uv || uv <= 0) return t("val_unit");
      if (uv > bk) return t("val_unit_max");
    }
    if (mode === "percent_bankroll") {
      const up = parseFloat(unitPercent);
      if (!up || up <= 0) return t("val_pct");
      if (up > 25) return t("val_pct_warn");
    }
    return null;
  }, [mode, bankroll, unitValue, unitPercent, t]);

  async function handleSave() {
    const validationError = validate();
    if (validationError && !validationError.includes("?")) {
      setError(validationError);
      return;
    }
    if (validationError) setError(validationError);

    setSaving(true);
    setSaved(false);
    setError("");

    const bk = parseFloat(bankroll) || 0;
    const cbk = parseFloat(currentBk) || bk;
    const uv = parseFloat(unitValue) || 0;
    const up = parseFloat(unitPercent) || 0;

    let initialUnitCount = 0;
    if (mode === "fixed_unit" && uv > 0 && bk > 0) initialUnitCount = Math.round((bk / uv) * 100) / 100;
    else if (mode === "percent_bankroll" && up > 0) initialUnitCount = Math.round((100 / up) * 100) / 100;

    const payload: Record<string, unknown> = {
      mode,
      initial_bankroll: mode === "units_only" ? 0 : bk,
      current_bankroll: mode === "units_only" ? 0 : cbk,
      unit_value: mode === "fixed_unit" ? uv : 0,
      unit_percent: mode === "percent_bankroll" ? up : 0,
      auto_recalc: mode === "fixed_unit" ? autoRecalc : mode === "percent_bankroll" ? "per_pick" : "none",
      initial_unit_count: mode === "units_only" ? 0 : initialUnitCount,
    };

    try {
      const res = await fetch("/api/user-bankroll", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setError(t("err_save"));
      }
    } catch {
      setError(t("err_network"));
    }
    setSaving(false);
  }

  const bkValue = parseFloat(bankroll) || 0;
  const cbkValue = parseFloat(currentBk) || bkValue;
  const computedUnit = mode === "fixed_unit" ? parseFloat(unitValue) || 0 : mode === "percent_bankroll" ? (cbkValue * (parseFloat(unitPercent) || 0)) / 100 : 0;
  const pnl = cbkValue - bkValue;
  const pnlPercent = bkValue > 0 ? (pnl / bkValue) * 100 : 0;
  const unitsInBk = computedUnit > 0 ? Math.round(cbkValue / computedUnit) : 0;

  const inputClass = "w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-center font-mono text-lg font-bold text-white outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 [color-scheme:dark] placeholder-white/20";

  if (loading) {
    return (
      <>
        <EspaceHero title={t("hero")} />
        <main className="mx-auto max-w-lg px-4 py-8">
          <div className="flex flex-col items-center gap-3 py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            <p className="text-sm text-neutral-400">{t("loading")}</p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <EspaceHero title={t("hero")} />

      <main className="mx-auto max-w-lg px-4 pb-12 pt-6">
        <p className="text-center text-sm text-neutral-400">{t("subtitle")}</p>

        {config.mode !== "units_only" && config.current_bankroll > 0 && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-white/[0.06] p-6 text-center" style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 100%)" }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-400/60">{t("current_bk_tag")}</p>
            <p className="mt-2 font-mono text-4xl font-extrabold text-white">{config.current_bankroll.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}€</p>
            {config.initial_bankroll > 0 && (
              <div className="mt-2 inline-flex items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${config.current_bankroll >= config.initial_bankroll ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                  {config.current_bankroll >= config.initial_bankroll ? "+" : ""}{(config.current_bankroll - config.initial_bankroll).toFixed(2)}€
                </span>
                <span className={`text-xs font-bold ${config.current_bankroll >= config.initial_bankroll ? "text-emerald-400/60" : "text-red-400/60"}`}>
                  ({(((config.current_bankroll - config.initial_bankroll) / config.initial_bankroll) * 100).toFixed(1)}%)
                </span>
              </div>
            )}
            <div className="mt-3 flex flex-wrap justify-center gap-4 text-[10px] text-white/25">
              <span>{t("initial_capital")} : {config.initial_bankroll.toLocaleString("fr-FR")}€</span>
              <span>{config.mode === "fixed_unit" ? `${t("mode_fixed_label")} — 1U = ${config.unit_value}€` : `${t("mode_percent_label")} — 1U = ${config.unit_percent}%`}</span>
            </div>
          </div>
        )}

        <div className="mt-6">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">{t("mode_title")}</p>
          <div className="space-y-2">
            {MODE_OPTIONS.map((opt) => {
              const selected = mode === opt.value;
              return (
                <button key={opt.value} onClick={() => handleModeChange(opt.value)} className={`flex w-full cursor-pointer items-center gap-4 rounded-xl border p-4 text-left transition ${selected ? "border-emerald-500/40 shadow-lg" : "border-white/[0.06] hover:border-white/10"}`} style={{ background: selected ? `linear-gradient(135deg, #111 0%, ${opt.accent}15 100%)` : "linear-gradient(135deg, #111 0%, #151515 100%)" }}>
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-xl" style={{ background: `${opt.accent}20` }}>{opt.icon}</div>
                  <div className="flex-1">
                    <p className={`text-sm font-bold ${selected ? "text-white" : "text-white/60"}`}>{opt.label}</p>
                    <p className="mt-0.5 text-[11px] text-white/30">{opt.desc}</p>
                  </div>
                  {selected && (<div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500"><span className="text-xs text-white">✓</span></div>)}
                </button>
              );
            })}
          </div>
        </div>

        {mode !== "units_only" && (
          <div className="mt-6 space-y-5">
            <div className="flex items-center gap-3"><div className="h-px flex-1 bg-white/[0.06]" /><span className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">{t("config")}</span><div className="h-px flex-1 bg-white/[0.06]" /></div>

            <div className="rounded-xl border border-white/[0.06] p-4" style={{ background: "linear-gradient(135deg, #111 0%, #151515 100%)" }}>
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.15em] text-white/50">{t("bk_start_label")}</label>
              <p className="mb-2 text-[10px] text-white/35">{t("bk_start_desc")}</p>
              <div className="flex items-center gap-2">
                <input type="number" step="0.01" min="0" value={bankroll} onChange={(e) => { setBankroll(e.target.value); setError(""); if (!currentBk || currentBk === bankroll) setCurrentBk(e.target.value); }} placeholder="1000" className={inputClass} inputMode="decimal" />
                <span className="text-lg font-bold text-white/30">€</span>
              </div>
            </div>

            <div className="rounded-xl border border-white/[0.06] p-4" style={{ background: "linear-gradient(135deg, #111 0%, #151515 100%)" }}>
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.15em] text-white/50">{t("bk_current_label")}</label>
              <p className="mb-2 text-[10px] text-white/35">{t("bk_current_desc")}</p>
              <div className="flex items-center gap-2">
                <input type="number" step="0.01" min="0" value={currentBk} onChange={(e) => { setCurrentBk(e.target.value); setError(""); }} placeholder={bankroll || "1000"} className={inputClass} inputMode="decimal" />
                <span className="text-lg font-bold text-white/30">€</span>
              </div>
              {bkValue > 0 && cbkValue > 0 && cbkValue !== bkValue && (
                <p className={`mt-2 text-center text-xs font-bold ${pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>{pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}€ ({pnlPercent >= 0 ? "+" : ""}{pnlPercent.toFixed(1)}%)</p>
              )}
            </div>

            {mode === "fixed_unit" && (
              <div className="rounded-xl border border-white/[0.06] p-4" style={{ background: "linear-gradient(135deg, #111 0%, #151515 100%)" }}>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.15em] text-white/50">{t("unit_value_label")}</label>
                <p className="mb-2 text-[10px] text-white/35">{t("unit_value_desc")}</p>
                <div className="flex items-center gap-2">
                  <input type="number" step="0.01" min="0.01" value={unitValue} onChange={(e) => { setUnitValue(e.target.value); setError(""); }} placeholder="10" className={inputClass} inputMode="decimal" />
                  <span className="text-lg font-bold text-white/30">€</span>
                </div>
                {cbkValue > 0 && computedUnit > 0 && (
                  <p className="mt-2 text-center text-xs text-white/30" dangerouslySetInnerHTML={{ __html: t("units_in_bk", { units: unitsInBk, pct: ((computedUnit / cbkValue) * 100).toFixed(1) }) }} />
                )}
              </div>
            )}

            {mode === "percent_bankroll" && (
              <div className="rounded-xl border border-white/[0.06] p-4" style={{ background: "linear-gradient(135deg, #111 0%, #151515 100%)" }}>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.15em] text-white/50">{t("unit_pct_label")}</label>
                <p className="mb-2 text-[10px] text-white/35">{t("unit_pct_desc")}</p>
                <div className="flex items-center gap-2">
                  <input type="number" step="0.1" min="0.1" max="100" value={unitPercent} onChange={(e) => { setUnitPercent(e.target.value); setError(""); }} placeholder="1" className={inputClass} inputMode="decimal" />
                  <span className="text-lg font-bold text-white/30">%</span>
                </div>
                {cbkValue > 0 && computedUnit > 0 && (
                  <p className="mt-2 text-center text-xs text-white/30" dangerouslySetInnerHTML={{ __html: t("unit_pct_result", { value: computedUnit.toFixed(2), units: unitsInBk }) }} />
                )}
              </div>
            )}

            {mode === "fixed_unit" && (
              <div className="rounded-xl border border-white/[0.06] p-4" style={{ background: "linear-gradient(135deg, #111 0%, #151515 100%)" }}>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.15em] text-white/50">{t("recalc_label")}</label>
                <p className="mb-2 text-[10px] text-white/35">{t("recalc_desc")}</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {RECALC_OPTIONS.map((opt) => (
                    <button key={opt.value} onClick={() => setAutoRecalc(opt.value)} className={`cursor-pointer rounded-lg px-2 py-2.5 text-center transition ${autoRecalc === opt.value ? "bg-emerald-500/20 ring-1 ring-emerald-500/40" : "bg-white/[0.03] hover:bg-white/[0.06]"}`}>
                      <span className="text-base">{opt.icon}</span>
                      <p className={`mt-0.5 text-[9px] font-bold ${autoRecalc === opt.value ? "text-emerald-400" : "text-white/30"}`}>{opt.label}</p>
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-center text-[10px] text-white/20">{RECALC_OPTIONS.find((o) => o.value === autoRecalc)?.desc}</p>
              </div>
            )}

            {mode === "percent_bankroll" && (
              <div className="rounded-xl border border-emerald-500/20 p-3" style={{ background: "rgba(16,185,129,0.05)" }}>
                <p className="text-center text-xs text-emerald-400/70">{t("pct_info")}</p>
                <p className="mt-1 text-center text-[10px] text-emerald-400/40">{t("pct_info2")}</p>
              </div>
            )}

            {cbkValue > 0 && computedUnit > 0 && (
              <div className="overflow-hidden rounded-2xl border border-white/[0.06]" style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 100%)" }}>
                <div className="border-b border-white/[0.06] px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-400">{t("preview_tag")}</p></div>
                <div className="px-4 py-3">
                  <div className="flex items-center justify-between py-1.5"><span className="text-xs text-white/40">{t("preview_bk")}</span><span className="font-mono text-sm font-bold text-white">{cbkValue.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}€</span></div>
                  <div className="flex items-center justify-between py-1.5"><span className="text-xs text-white/40">{t("preview_unit")}</span><span className="font-mono text-sm font-extrabold text-emerald-400">{computedUnit.toFixed(2)}€</span></div>
                  <div className="flex items-center justify-between py-1.5"><span className="text-xs text-white/40">{t("preview_units")}</span><span className="font-mono text-sm font-bold text-white/50">{unitsInBk}U</span></div>
                  <div className="my-2 h-px bg-white/[0.06]" />
                  <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-white/20">{t("preview_publish")}</p>
                  {[0.5, 1, 2, 3].map((stake) => (
                    <div key={stake} className="flex items-center justify-between py-1">
                      <span className="flex items-center gap-2 text-xs text-white/30"><span className="inline-flex h-5 w-8 items-center justify-center rounded bg-white/5 font-mono text-[10px] font-bold text-white/50">{stake}U</span>{t("preview_stake")}</span>
                      <span className="font-mono text-xs font-semibold text-white/60">{(computedUnit * stake).toFixed(2)}€</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {error && (<div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-center text-xs text-red-400">{error}</div>)}

        <button onClick={handleSave} disabled={saving} className="mt-6 w-full cursor-pointer rounded-xl py-4 text-sm font-bold text-white transition disabled:opacity-50" style={{ background: saved ? "linear-gradient(135deg, #047857 0%, #059669 100%)" : "linear-gradient(135deg, #059669 0%, #10b981 100%)", boxShadow: "0 4px 20px rgba(16,185,129,0.3)" }}>
          {saving ? (<span className="flex items-center justify-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />{t("btn_saving")}</span>) : saved ? t("btn_saved") : t("btn_save")}
        </button>

        {config.mode !== "units_only" && mode !== "units_only" && (
          <button onClick={() => { handleModeChange("units_only"); setBankroll(""); setCurrentBk(""); setUnitValue(""); setUnitPercent(""); }} className="mt-3 w-full cursor-pointer rounded-xl border border-white/[0.06] py-3 text-xs font-semibold text-white/30 transition hover:border-white/10 hover:text-white/50">
            {t("btn_reset")}
          </button>
        )}
      </main>
    </>
  );
}