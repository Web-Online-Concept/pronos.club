/**
 * ═══════════════════════════════════════════════════════════════════
 * /api/og/bilan-hebdo/[semaine] — OG image bilan hebdo
 * ═══════════════════════════════════════════════════════════════════
 *
 * Image OG dynamique pour partage Telegram/X/WhatsApp d'un bilan hebdo.
 * Format 1200x630.
 *
 * Look impact : gradient violet/fuchsia + ROI géant en couleur (vert si
 * positif, rouge si négatif) + V/D/N + winrate + logo.
 *
 * Path : src/app/api/og/bilan-hebdo/[semaine]/route.tsx
 * ═══════════════════════════════════════════════════════════════════
 */

import { ImageResponse } from "next/og";
import { getWeeklyBilanBySlug } from "@/lib/bilan/hebdo-generator";

export const runtime = "nodejs"; // node car on lit Supabase

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://pronos.club";

export async function GET(
  _request: Request,
  context: { params: Promise<{ semaine: string }> }
) {
  const { semaine } = await context.params;
  const bilan = await getWeeklyBilanBySlug(semaine);

  // Si le bilan n'existe pas → image générique
  if (!bilan) {
    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background:
              "linear-gradient(135deg, #4c1d95 0%, #7c3aed 50%, #c026d3 100%)",
            color: "white",
            fontSize: 60,
            fontWeight: 900,
          }}
        >
          Bilan introuvable
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }

  const roiSign = bilan.roi_pct >= 0 ? "+" : "";
  const profitSign = bilan.total_profit_units >= 0 ? "+" : "";
  const isPositive = bilan.roi_pct > 0;
  const isNegative = bilan.roi_pct < 0;

  // Couleur du ROI géant
  const roiColor = isPositive
    ? "#10b981" // emerald-500
    : isNegative
      ? "#ef4444" // red-500
      : "#a1a1aa"; // zinc-400

  // Emoji selon ROI
  const roiEmoji = isPositive ? "🟢" : isNegative ? "🔴" : "⚪";

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #4c1d95 0%, #7c3aed 50%, #c026d3 100%)",
          padding: "50px 60px",
          position: "relative",
        }}
      >
        {/* Pattern décoratif */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              "radial-gradient(circle at 80% 20%, rgba(255,255,255,0.12) 0%, transparent 50%)",
          }}
        />

        {/* HEADER : badge BILAN HEBDO + logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            zIndex: 10,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                background: "rgba(255,255,255,0.15)",
                padding: "8px 18px",
                borderRadius: "999px",
                color: "white",
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "2px",
                width: "fit-content",
              }}
            >
              📊 BILAN HEBDO
            </div>
            <div
              style={{
                fontSize: 28,
                color: "rgba(255,255,255,0.85)",
                fontWeight: 500,
              }}
            >
              Semaine {bilan.week_number} · {bilan.week_year}
            </div>
          </div>

          {/* Logo */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${BASE_URL}/android-chrome-512x512.png`}
            width="100"
            height="100"
            alt="PRONOS.CLUB"
            style={{ borderRadius: "16px" }}
          />
        </div>

        {/* CONTENU CENTRAL : ROI géant */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
          }}
        >
          <div
            style={{
              fontSize: 28,
              color: "rgba(255,255,255,0.85)",
              fontWeight: 600,
              letterSpacing: "3px",
              marginBottom: "10px",
            }}
          >
            {roiEmoji} ROI DE LA SEMAINE
          </div>
          <div
            style={{
              fontSize: 200,
              fontWeight: 900,
              color: roiColor,
              letterSpacing: "-6px",
              textShadow: "0 8px 30px rgba(0,0,0,0.4)",
              lineHeight: 1,
            }}
          >
            {roiSign}{bilan.roi_pct.toFixed(2)}%
          </div>
          <div
            style={{
              fontSize: 36,
              color: "white",
              fontWeight: 700,
              marginTop: "20px",
            }}
          >
            💰 {profitSign}{bilan.total_profit_units.toFixed(2)}U sur {bilan.total_picks} picks
          </div>
        </div>

        {/* FOOTER : V/D/N + winrate + CLV */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-around",
            alignItems: "center",
            background: "rgba(0,0,0,0.3)",
            padding: "20px 30px",
            borderRadius: "16px",
            backdropFilter: "blur(10px)",
            zIndex: 10,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: 18, color: "rgba(255,255,255,0.6)", letterSpacing: "2px" }}>
              GAGNÉS
            </div>
            <div style={{ fontSize: 44, color: "#10b981", fontWeight: 900 }}>
              {bilan.picks_won}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: 18, color: "rgba(255,255,255,0.6)", letterSpacing: "2px" }}>
              PERDUS
            </div>
            <div style={{ fontSize: 44, color: "#ef4444", fontWeight: 900 }}>
              {bilan.picks_lost}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: 18, color: "rgba(255,255,255,0.6)", letterSpacing: "2px" }}>
              WINRATE
            </div>
            <div style={{ fontSize: 44, color: "white", fontWeight: 900 }}>
              {bilan.winrate_pct.toFixed(1)}%
            </div>
          </div>
          {bilan.clv_avg_pct !== null && bilan.clv_picks_count > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <div style={{ fontSize: 18, color: "rgba(255,255,255,0.6)", letterSpacing: "2px" }}>
                CLV MOYEN
              </div>
              <div
                style={{
                  fontSize: 44,
                  color: bilan.clv_avg_pct > 0 ? "#fbbf24" : "white",
                  fontWeight: 900,
                }}
              >
                {bilan.clv_avg_pct >= 0 ? "+" : ""}{bilan.clv_avg_pct.toFixed(2)}%
              </div>
            </div>
          )}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}