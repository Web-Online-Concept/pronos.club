"use client";

/**
 * ═══════════════════════════════════════════════════════════════════
 * Composant client : BilanMensuelCharts
 * ═══════════════════════════════════════════════════════════════════
 *
 * Affiche les 4 graphiques recharts du bilan mensuel :
 *   1. Bankroll cumulée jour par jour (LineChart)
 *   2. Répartition V/D/N (PieChart donut)
 *   3. ROI par tier (BarChart)
 *   4. Profit par sport (BarChart horizontal)
 *
 * Path : src/components/bilan/BilanMensuelCharts.tsx
 * ═══════════════════════════════════════════════════════════════════
 */

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  ReferenceLine,
} from "recharts";
import type { BilanMensuel } from "@/lib/bilan/mensuel-generator";

// ============================================================================
// CONSTANTS
// ============================================================================

const COLORS = {
  positive: "#10b981",   // emerald-500
  negative: "#ef4444",   // red-500
  neutral: "#71717a",    // zinc-500
  primary: "#7c3aed",    // violet-600
  bg: "#f4f4f5",         // zinc-100
  border: "#e4e4e7",     // zinc-200
};

const TIER_COLORS: Record<string, string> = {
  lock: "#10b981",       // emerald-500
  strong: "#3b82f6",     // blue-500
  value: "#7c3aed",      // violet-600
  coup_de_coeur: "#ec4899", // pink-500
};

const SPORT_LABELS: Record<string, string> = {
  football: "⚽ Football",
  tennis: "🎾 Tennis",
  basketball: "🏀 Basketball",
  hockey: "🏒 Hockey",
  baseball: "⚾ Baseball",
  mma: "🥊 MMA",
  "football-americain": "🏈 NFL",
  rugby: "🏉 Rugby",
  handball: "🤾 Handball",
  "formula-1": "🏎️ F1",
  multi: "🎯 Multi",
};

const TIER_LABELS: Record<string, string> = {
  lock: "🔒 Lock",
  strong: "💪 Strong",
  value: "💎 Value",
  coup_de_coeur: "❤️ CDC",
};

// ============================================================================
// HELPERS
// ============================================================================

const formatDayLabel = (dateStr: string): string => {
  const d = new Date(`${dateStr}T12:00:00Z`);
  return d.toLocaleDateString("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "short",
    day: "2-digit",
  });
};

/**
 * Helpers pour parser les valeurs reçues par les tooltips recharts.
 * Le type ValueType de recharts est `string | number | (string | number)[]`,
 * donc on a besoin de coerce vers number safely.
 */
const toNumber = (v: unknown): number => {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return isNaN(n) ? 0 : n;
  }
  return 0;
};

// ============================================================================
// COMPONENT
// ============================================================================

type Props = {
  bilan: BilanMensuel;
};

// Types des datasets de chaque chart (utiles pour cast les payloads tooltip)
type BankrollDatum = {
  day: string;
  fullDate: string;
  cumulative: number;
  daily: number;
  picks: number;
};

type TierDatum = {
  tier: string;
  tierKey: string;
  roi: number;
  profit: number;
  count: number;
  color: string;
};

type SportDatum = {
  sport: string;
  sportKey: string;
  profit: number;
  count: number;
  won: number;
  color: string;
};

export function BilanMensuelCharts({ bilan }: Props) {
  // ─── Data prep
  // Graph 1 : Bankroll evolution
  const bankrollData: BankrollDatum[] = bilan.bankroll_evolution.map((p) => ({
    day: formatDayLabel(p.date),
    fullDate: p.date,
    cumulative: p.cumulative_profit,
    daily: p.daily_profit,
    picks: p.picks_count,
  }));

  // Graph 2 : Donut V/D/N
  const stakedTotal = bilan.picks_won + bilan.picks_lost;
  const donutData = [
    { name: "Gagnés", value: bilan.picks_won, color: COLORS.positive },
    { name: "Perdus", value: bilan.picks_lost, color: COLORS.negative },
    ...(bilan.picks_void > 0
      ? [{ name: "Annulés", value: bilan.picks_void, color: COLORS.neutral }]
      : []),
  ];

  // Graph 3 : ROI par tier
  const tierOrder: Array<keyof BilanMensuel["picks_by_tier"]> = [
    "lock",
    "strong",
    "value",
    "coup_de_coeur",
  ];
  const tierData: TierDatum[] = tierOrder
    .filter((t) => bilan.picks_by_tier[t]?.count > 0)
    .map((t) => ({
      tier: TIER_LABELS[t],
      tierKey: t,
      roi: bilan.picks_by_tier[t].roi_pct,
      profit: bilan.picks_by_tier[t].profit,
      count: bilan.picks_by_tier[t].count,
      color: TIER_COLORS[t],
    }));

  // Graph 4 : Profit par sport
  const sportData: SportDatum[] = Object.entries(bilan.picks_by_sport)
    .filter(([, s]) => s.count > 0)
    .map(([sport, stats]) => ({
      sport: SPORT_LABELS[sport] ?? sport,
      sportKey: sport,
      profit: stats.profit,
      count: stats.count,
      won: stats.won,
      color: stats.profit >= 0 ? COLORS.positive : COLORS.negative,
    }))
    .sort((a, b) => b.profit - a.profit);

  return (
    <div className="space-y-6">
      {/* ─── Graph 1 : Bankroll cumulée ───────────────────────── */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <h3 className="text-lg font-bold mb-1 text-zinc-900">
          📈 Évolution de la bankroll
        </h3>
        <p className="text-sm text-zinc-500 mb-6">
          Profit cumulé jour par jour sur le mois
        </p>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={bankrollData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
              <XAxis dataKey="day" stroke={COLORS.neutral} fontSize={12} />
              <YAxis
                stroke={COLORS.neutral}
                fontSize={12}
                tickFormatter={(v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}U`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: "8px",
                }}
                formatter={(value, name) => {
                  if (name === "cumulative") {
                    const v = toNumber(value);
                    return [`${v > 0 ? "+" : ""}${v.toFixed(2)}U`, "Cumul"];
                  }
                  return [String(value), String(name)];
                }}
              />
              <ReferenceLine y={0} stroke={COLORS.neutral} strokeDasharray="3 3" />
              <Line
                type="monotone"
                dataKey="cumulative"
                stroke={COLORS.primary}
                strokeWidth={3}
                dot={{ fill: COLORS.primary, r: 5 }}
                activeDot={{ r: 7 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ─── Graph 2 (donut V/D/N) + Graph 3 (ROI par tier) sur 2 colonnes ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Donut */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <h3 className="text-lg font-bold mb-1 text-zinc-900">
            🎯 Répartition des résultats
          </h3>
          <p className="text-sm text-zinc-500 mb-6">
            Sur {stakedTotal + bilan.picks_void} picks du mois
          </p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={85}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}
                >
                  {donutData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: "8px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bar tier */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <h3 className="text-lg font-bold mb-1 text-zinc-900">
            🏆 ROI par catégorie
          </h3>
          <p className="text-sm text-zinc-500 mb-6">
            Performance des picks selon leur niveau de confiance
          </p>
          <div className="h-64 w-full">
            {tierData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-zinc-400 text-sm">
                Aucune catégorie active ce mois
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tierData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
                  <XAxis dataKey="tier" stroke={COLORS.neutral} fontSize={11} />
                  <YAxis
                    stroke={COLORS.neutral}
                    fontSize={12}
                    tickFormatter={(v: number) => `${v > 0 ? "+" : ""}${v.toFixed(0)}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: "8px",
                    }}
                    formatter={(value, name, item) => {
                      if (name === "roi") {
                        const v = toNumber(value);
                        const sign = v >= 0 ? "+" : "";
                        // item.payload est typé `unknown` côté recharts, on cast
                        const payload = (item as { payload?: TierDatum }).payload;
                        const profit = payload?.profit ?? 0;
                        const count = payload?.count ?? 0;
                        const profitSign = profit >= 0 ? "+" : "";
                        return [
                          `ROI ${sign}${v.toFixed(1)}% (${profitSign}${profit.toFixed(2)}U sur ${count} picks)`,
                          "Performance",
                        ];
                      }
                      return [String(value), String(name)];
                    }}
                  />
                  <ReferenceLine y={0} stroke={COLORS.neutral} strokeDasharray="3 3" />
                  <Bar dataKey="roi" radius={[4, 4, 0, 0]}>
                    {tierData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.roi >= 0 ? COLORS.positive : COLORS.negative}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* ─── Graph 4 : Profit par sport (horizontal bar) ───────── */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <h3 className="text-lg font-bold mb-1 text-zinc-900">
          🏅 Performance par sport
        </h3>
        <p className="text-sm text-zinc-500 mb-6">
          Profit en unités, classé du plus rentable au moins rentable
        </p>
        <div
          className="w-full"
          style={{ height: `${Math.max(sportData.length * 50 + 60, 200)}px` }}
        >
          {sportData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-zinc-400 text-sm">
              Aucune donnée sport ce mois
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={sportData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
                <XAxis
                  type="number"
                  stroke={COLORS.neutral}
                  fontSize={12}
                  tickFormatter={(v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}U`}
                />
                <YAxis
                  type="category"
                  dataKey="sport"
                  stroke={COLORS.neutral}
                  fontSize={12}
                  width={120}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: "8px",
                  }}
                  formatter={(value, name, item) => {
                    if (name === "profit") {
                      const v = toNumber(value);
                      const sign = v >= 0 ? "+" : "";
                      const payload = (item as { payload?: SportDatum }).payload;
                      const won = payload?.won ?? 0;
                      const count = payload?.count ?? 0;
                      return [`${sign}${v.toFixed(2)}U (${won}/${count} gagnés)`, "Profit"];
                    }
                    return [String(value), String(name)];
                  }}
                />
                <ReferenceLine x={0} stroke={COLORS.neutral} strokeDasharray="3 3" />
                <Bar dataKey="profit" radius={[0, 4, 4, 0]}>
                  {sportData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.profit >= 0 ? COLORS.positive : COLORS.negative}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}