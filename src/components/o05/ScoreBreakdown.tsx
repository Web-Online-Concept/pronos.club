// src/components/o05/ScoreBreakdown.tsx
//
// Affiche le detail du calcul du score d'un match.
// Reproduit la structure de l'Excel Bertrand : attaque /8 + defense /8
// + bonus/malus = total /18.5 -> note /10 -> verdict.

"use client";

type ScoreBreakdownProps = {
  attackScore: number | null;
  attackXg: number | null;
  attackTc: number | null;
  attackGo: number | null;
  attackEfficiency: number | null;
  attackBonusProjet: number | null;
  defenseScore: number | null;
  defenseXgc: number | null;
  defenseTcSubis: number | null;
  defenseGoConceded: number | null;
  defenseCleanSheets: number | null;
  defenseBonusProjet: number | null;
  matchupBonus: number | null;
  homeBonus: number | null;
  closedMatchMalus: number | null;
  totalScore: number | null;
  note10: number | null;
  verdict: "TRÈS BON" | "BON" | "MOYEN" | "FAIBLE" | null;
};

export default function ScoreBreakdown(p: ScoreBreakdownProps) {
  return (
    <div
      className="overflow-hidden rounded-xl border border-white/[0.06] p-6"
      style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}
    >
      <h3 className="text-base font-black text-white">📊 Décomposition du score</h3>

      {/* ATTAQUE */}
      <div className="mt-5">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <h4 className="text-sm font-bold text-emerald-300">⚔️ ATTAQUE de la cible</h4>
          <span className="text-2xl font-black text-emerald-300">
            {p.attackScore?.toFixed(1) ?? "-"}<span className="text-sm font-normal opacity-60">/8</span>
          </span>
        </div>
        <div className="mt-3 space-y-2 text-sm">
          <StatRow label="xG pondéré" value={p.attackXg} format="number" thresholds={[1.2, 1.5]} hint="≥1.5: +2 / ≥1.2: +1" />
          <StatRow label="Tirs cadrés" value={p.attackTc} format="number" thresholds={[3, 4]} hint="≥4: +2 / ≥3: +1" />
          <StatRow label="Grosses occasions" value={p.attackGo} format="number" thresholds={[1, 2]} hint="≥2: +2 / ≥1: +1" />
          <StatRow
            label="Efficacité (buts/xG)"
            value={p.attackEfficiency}
            format="number"
            thresholds={[0.8, 1.3]}
            invert
            hint="<0.80: +2 / 0.80-1.30: +1 / >1.30: -1"
          />
        </div>
        {p.attackBonusProjet !== null && p.attackBonusProjet !== 0 && (
          <BonusRow label="Bonus PROJET" value={p.attackBonusProjet} />
        )}
      </div>

      {/* DEFENSE */}
      <div className="mt-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <h4 className="text-sm font-bold text-emerald-300">🛡️ DÉFENSE de l'adversaire</h4>
          <span className="text-2xl font-black text-emerald-300">
            {p.defenseScore?.toFixed(1) ?? "-"}<span className="text-sm font-normal opacity-60">/8</span>
          </span>
        </div>
        <p className="mt-2 text-xs text-white/40">
          Plus le score est élevé, plus la défense adverse est fragile (favorable à la cible).
        </p>
        <div className="mt-3 space-y-2 text-sm">
          <StatRow label="xG concédés (xGC)" value={p.defenseXgc} format="number" thresholds={[1.2, 1.5]} hint="≥1.5: +2 / ≥1.2: +1" />
          <StatRow label="Tirs cadrés subis" value={p.defenseTcSubis} format="number" thresholds={[3, 4]} hint="≥4: +2 / ≥3: +1" />
          <StatRow label="GO concédées" value={p.defenseGoConceded} format="number" thresholds={[0.5, 1]} hint="≥1: +2 / ≥0.5: +1" />
          <StatRow
            label="Clean sheets sur 3 matchs"
            value={p.defenseCleanSheets}
            format="integer"
            invert
            hint="0 CS: +2 / 1 CS: +1 / 2-3 CS: 0"
          />
        </div>
        {p.defenseBonusProjet !== null && p.defenseBonusProjet !== 0 && (
          <BonusRow label="Bonus PROJET (adv)" value={p.defenseBonusProjet} />
        )}
      </div>

      {/* BONUS / MALUS */}
      {(p.matchupBonus || p.homeBonus || p.closedMatchMalus) && (
        <div className="mt-6">
          <h4 className="text-sm font-bold text-yellow-300">⚡ Bonus & Malus</h4>
          <div className="mt-3 space-y-2 text-sm">
            {p.matchupBonus !== null && p.matchupBonus !== 0 && (
              <BonusRow label="Match-up explosif (attaque forte × défense fragile)" value={p.matchupBonus} />
            )}
            {p.homeBonus !== null && p.homeBonus !== 0 && (
              <BonusRow label="Avantage domicile" value={p.homeBonus} />
            )}
            {p.closedMatchMalus !== null && p.closedMatchMalus !== 0 && (
              <BonusRow label="Match fermé probable" value={p.closedMatchMalus} />
            )}
          </div>
        </div>
      )}

      {/* TOTAL */}
      <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-white">TOTAL SCORE</span>
          <span className="text-2xl font-black text-emerald-300">
            {p.totalScore?.toFixed(2) ?? "-"}<span className="text-sm font-normal opacity-60">/18.5</span>
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-sm font-bold text-white">NOTE</span>
          <span className="text-3xl font-black text-emerald-300">
            {p.note10?.toFixed(1) ?? "-"}<span className="text-base font-normal opacity-60">/10</span>
          </span>
        </div>
        {p.verdict && (
          <div className="mt-3 text-center text-lg font-black tracking-wider text-white">
            VERDICT : <span className={getVerdictColor(p.verdict)}>{p.verdict}</span>
          </div>
        )}
      </div>
    </div>
  );
}


function StatRow({
  label,
  value,
  format,
  thresholds,
  invert,
  hint,
}: {
  label: string;
  value: number | null;
  format: "number" | "integer";
  thresholds?: [number, number];
  invert?: boolean;
  hint?: string;
}) {
  const display =
    value == null
      ? "-"
      : format === "integer"
      ? Math.round(value).toString()
      : value.toFixed(2);

  // Couleur selon seuils
  let color = "text-white/70";
  if (value != null && thresholds) {
    const [t1, t2] = thresholds;
    if (invert) {
      // Pour efficience : moins = mieux (sous-perf attaque = bon)
      if (value < t1) color = "text-emerald-400";
      else if (value <= t2) color = "text-yellow-400";
      else color = "text-red-400";
    } else {
      if (value >= t2) color = "text-emerald-400";
      else if (value >= t1) color = "text-yellow-400";
      else color = "text-white/60";
    }
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <span className="text-white/80">{label}</span>
        {hint && <span className="ml-2 text-[10px] text-white/30">{hint}</span>}
      </div>
      <span className={`font-bold ${color}`}>{display}</span>
    </div>
  );
}

function BonusRow({ label, value }: { label: string; value: number }) {
  const positive = value > 0;
  return (
    <div className="flex items-center justify-between rounded-md bg-white/5 px-2 py-1">
      <span className="text-xs text-white/70">{label}</span>
      <span className={`text-sm font-bold ${positive ? "text-emerald-400" : "text-red-400"}`}>
        {positive ? "+" : ""}{value.toFixed(1)}
      </span>
    </div>
  );
}

function getVerdictColor(verdict: string): string {
  switch (verdict) {
    case "TRÈS BON":
      return "text-emerald-400";
    case "BON":
      return "text-yellow-400";
    case "MOYEN":
      return "text-orange-400";
    case "FAIBLE":
      return "text-red-400";
    default:
      return "text-white";
  }
}