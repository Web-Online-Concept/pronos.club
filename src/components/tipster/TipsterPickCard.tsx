// src/components/tipster/TipsterPickCard.tsx
"use client";

import Link from "next/link";

type Pick = {
  id: string;
  user_id: string;
  match_date: string;
  sport: string;
  odds: number;
  pick_type: "simple" | "combiné";
  bookmaker: string | null;
  image_url: string;
  submitted_at: string;
  status: "live" | "resolved" | "rejected";
  result: "won" | "half_won" | "refunded" | "half_lost" | "lost" | null;
  units_result: number | null;
  users: { id: string; pseudo: string; avatar_url: string | null } | null;
};

export default function TipsterPickCard({
  pick,
  locale,
  showPseudo = true,
  showResult = false,
  canDelete = false,
  onDelete,
}: {
  pick: Pick;
  locale: string;
  showPseudo?: boolean;
  showResult?: boolean;
  canDelete?: boolean;
  onDelete?: () => void;
}) {
  const pseudo = pick.users?.pseudo || "TIPSTER";
  const avatar = pick.users?.avatar_url;

  const theme = pick.result === "won"
    ? { accent: "#10b981", bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.2)", ring: "rgba(16,185,129,0.4)", text: "#34d399", label: "Gagné" }
    : pick.result === "half_won"
    ? { accent: "#10b981", bg: "rgba(16,185,129,0.06)", border: "rgba(16,185,129,0.15)", ring: "rgba(16,185,129,0.3)", text: "#6ee7b7", label: "½ Gagné" }
    : pick.result === "refunded"
    ? { accent: "#3b82f6", bg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.2)", ring: "rgba(59,130,246,0.4)", text: "#93c5fd", label: "Remboursé" }
    : pick.result === "half_lost"
    ? { accent: "#ef4444", bg: "rgba(239,68,68,0.06)", border: "rgba(239,68,68,0.15)", ring: "rgba(239,68,68,0.3)", text: "#fca5a5", label: "½ Perdu" }
    : pick.result === "lost"
    ? { accent: "#ef4444", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.2)", ring: "rgba(239,68,68,0.4)", text: "#fca5a5", label: "Perdu" }
    : { accent: "#fbbf24", bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.2)", ring: "rgba(255,255,255,0.06)", text: "rgba(251,191,36,0.9)", label: "En cours" };

  const matchDate = new Date(pick.match_date);
  const matchDateStr = matchDate.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  }).toUpperCase();
  const matchTimeStr = matchDate.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div>
      <div
        style={{
          position: "relative",
          background: "linear-gradient(180deg, #0f1a17 0%, #0a1410 100%)",
          borderRadius: "16px",
          overflow: "hidden",
          boxShadow: `0 4px 24px rgba(0,0,0,0.3), inset 0 0 0 1px ${theme.ring}`,
        }}
      >
        {/* Accent bar top */}
        <div
          style={{
            position: "absolute", top: 0, left: 0, right: 0, height: "3px",
            background: `linear-gradient(90deg, transparent 0%, ${theme.accent} 30%, ${theme.accent} 70%, transparent 100%)`,
          }}
        />

        {/* Header : Sport + Logo + Date */}
        <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px dashed rgba(255,255,255,0.08)" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", minWidth: "80px" }}>
            <span style={{ fontSize: "9px", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.2em" }}>Sport</span>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#ffffff", lineHeight: 1.1, textAlign: "center" }}>
              {pick.sport}
            </span>
          </div>

          <img
            src="/pronos_club.png"
            alt="PRONOS.CLUB"
            style={{ width: "48px", height: "48px", objectFit: "contain" }}
          />

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", minWidth: "80px" }}>
            <span style={{ fontSize: "10px", fontWeight: 700, color: "#ffffff", letterSpacing: "0.05em" }}>
              {matchDateStr}
            </span>
            <span style={{ fontSize: "12px", fontWeight: 800, color: "#ffffff" }}>
              {matchTimeStr}
            </span>
          </div>
        </div>

        {/* Image du pick */}
        <div style={{ padding: "12px", background: "rgba(0,0,0,0.2)" }}>
          <div
            style={{
              width: "100%",
              aspectRatio: "1/1",
              borderRadius: "8px",
              overflow: "hidden",
              background: "rgba(255,255,255,0.02)",
              position: "relative",
            }}
          >
            <img
              src={pick.image_url}
              alt="Pronostic"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          </div>
        </div>

        {/* Data grid : Type + Cote + (Units si résolu) */}
        <div style={{ padding: "0 16px 14px", display: "grid", gridTemplateColumns: showResult && pick.units_result !== null ? "1fr 1fr 1fr" : "1fr 1fr", gap: "6px" }}>
          <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: "8px", padding: "8px", textAlign: "center" }}>
            <p style={{ fontSize: "9px", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.15em", margin: 0 }}>Type</p>
            <p style={{ fontSize: "13px", fontWeight: 700, color: pick.pick_type === "combiné" ? "#fbbf24" : "white", margin: "2px 0 0" }}>
              {pick.pick_type === "combiné" ? "Combiné" : "Simple"}
            </p>
          </div>
          <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: "8px", padding: "8px", textAlign: "center" }}>
            <p style={{ fontSize: "9px", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.15em", margin: 0 }}>Cote</p>
            <p style={{ fontSize: "13px", fontWeight: 700, color: "white", margin: "2px 0 0", fontVariantNumeric: "tabular-nums" }}>
              {parseFloat(String(pick.odds)).toFixed(2)}
            </p>
            {pick.bookmaker && (
              <p style={{ fontSize: "9px", fontWeight: 600, color: "rgba(255,255,255,0.5)", margin: "1px 0 0", textTransform: "lowercase" }}>
                {pick.bookmaker}
              </p>
            )}
          </div>
          {showResult && pick.units_result !== null && (
            <div style={{
              background: theme.bg,
              borderRadius: "8px",
              padding: "8px",
              textAlign: "center",
              border: `1px solid ${theme.border}`,
            }}>
              <p style={{ fontSize: "9px", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.15em", margin: 0 }}>Résultat</p>
              <p style={{ fontSize: "13px", fontWeight: 700, color: theme.text, margin: "2px 0 0", fontVariantNumeric: "tabular-nums" }}>
                {pick.units_result >= 0 ? "+" : ""}{parseFloat(String(pick.units_result)).toFixed(2)}U
              </p>
            </div>
          )}
        </div>

        {/* Status badge */}
        <div style={{
          padding: "10px 16px",
          background: theme.bg,
          borderTop: `1px solid ${theme.border}`,
          textAlign: "center",
        }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 700, color: theme.text }}>
            {pick.result === "won" && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7" /></svg>
            )}
            {pick.result === "half_won" && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7" opacity="0.6" /></svg>
            )}
            {pick.result === "refunded" && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M4 4v5h5M20 20v-5h-5M4 9a9 9 0 0114.65-4.65M20 15a9 9 0 01-14.65 4.65" /></svg>
            )}
            {pick.result === "half_lost" && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 18L18 6M6 6l12 12" opacity="0.6" /></svg>
            )}
            {pick.result === "lost" && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 18L18 6M6 6l12 12" /></svg>
            )}
            {!pick.result && (
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "rgba(251,191,36,0.9)", display: "inline-block" }} />
            )}
            {theme.label}
          </span>
        </div>

        {/* Footer : pseudo tipster */}
        {showPseudo && (
          <div style={{
            padding: "8px 14px",
            background: "rgba(0,0,0,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            borderTop: "1px solid rgba(255,255,255,0.04)",
          }}>
            {avatar ? (
              <img src={avatar} alt="" style={{ width: "20px", height: "20px", borderRadius: "50%", objectFit: "cover" }} />
            ) : (
              <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 700, color: "#ffffff" }}>
                {pseudo.charAt(0).toUpperCase()}
              </div>
            )}
            <Link
              href={`/${locale}/pronos-abonnes/${encodeURIComponent(pseudo)}`}
              style={{ fontSize: "11px", fontWeight: 700, color: "#ffffff", letterSpacing: "0.1em", textTransform: "uppercase", textDecoration: "none" }}
            >
              {pseudo}
            </Link>
          </div>
        )}
      </div>

      {canDelete && onDelete && (() => {
        const submittedAt = new Date(pick.submitted_at).getTime();
        const deadline = submittedAt + 10 * 60 * 1000;
        const now = Date.now();
        const secondsLeft = Math.floor((deadline - now) / 1000);

        if (secondsLeft <= 0) {
          // Fenêtre expirée : plus de bouton, juste un message discret
          return (
            <p className="mt-2 text-center text-[10px] text-neutral-400 italic">
              Pronostic verrouillé (fenêtre de modification expirée)
            </p>
          );
        }

        const minutes = Math.floor(secondsLeft / 60);
        const seconds = secondsLeft % 60;
        const timeStr = minutes > 0 ? `${minutes}min ${seconds}s` : `${seconds}s`;

        return (
          <>
            <button
              onClick={onDelete}
              className="mt-2 w-full cursor-pointer rounded-lg px-3 py-2 text-xs font-bold text-white transition hover:bg-red-500/20"
              style={{ background: "#1a2a3a", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              🗑 Supprimer
            </button>
            <p className="mt-1 text-center text-[10px] text-amber-600">
              ⏱ Fenêtre de suppression : encore {timeStr}
            </p>
          </>
        );
      })()}
    </div>
  );
}