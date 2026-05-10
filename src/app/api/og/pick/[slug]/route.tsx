/**
 * ═══════════════════════════════════════════════════════════════════
 * /api/og/pick/[slug] — OG image pour un pick individuel
 * ═══════════════════════════════════════════════════════════════════
 *
 * Image OG dynamique pour partage Telegram/X/WhatsApp d'un pick V3.5.
 * Format 1200x630.
 *
 * Look : gradient violet/fuchsia + sport emoji + match + cote géante +
 * tier badge coloré.
 *
 * Path : src/app/api/og/pick/[slug]/route.tsx
 * ═══════════════════════════════════════════════════════════════════
 */

import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://pronos.club";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SPORT_EMOJI: Record<string, string> = {
  football: "⚽",
  tennis: "🎾",
  basketball: "🏀",
  hockey: "🏒",
  baseball: "⚾",
  mma: "🥊",
  "football-americain": "🏈",
  rugby: "🏉",
  handball: "🤾",
  "formula-1": "🏎️",
};

const TIER_DISPLAY: Record<string, { emoji: string; label: string; bg: string; text: string }> = {
  lock: { emoji: "🔒", label: "LOCK", bg: "#10b981", text: "#fff" },
  strong: { emoji: "💪", label: "STRONG", bg: "#3b82f6", text: "#fff" },
  value: { emoji: "💎", label: "VALUE", bg: "#7c3aed", text: "#fff" },
  coup_de_coeur: { emoji: "❤️", label: "COUP DE CŒUR", bg: "#ec4899", text: "#fff" },
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;

  const { data: pick } = await supabaseAdmin
    .from("ai_picks")
    .select(
      "event_name, sport, league, selection, odds, tier, classic_number, status"
    )
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();

  if (!pick) {
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
          Pick introuvable
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }

  const sportEmoji = SPORT_EMOJI[pick.sport] ?? "🎯";
  const tierInfo = pick.tier ? TIER_DISPLAY[pick.tier] : null;
  const oddsValue = typeof pick.odds === "number" ? pick.odds : Number(pick.odds);

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

        {/* HEADER */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            zIndex: 10,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
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
              🤖 PRONOSTIC IA
              {pick.classic_number && (
                <span style={{ marginLeft: "8px", color: "rgba(255,255,255,0.7)" }}>
                  · #{String(pick.classic_number).padStart(4, "0")}
                </span>
              )}
            </div>
            <div
              style={{
                fontSize: 26,
                color: "rgba(255,255,255,0.85)",
                fontWeight: 500,
              }}
            >
              {sportEmoji} {pick.league}
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

        {/* CONTENU CENTRAL */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            zIndex: 10,
          }}
        >
          {/* Match name */}
          <div
            style={{
              fontSize: 54,
              fontWeight: 900,
              color: "white",
              letterSpacing: "-1px",
              lineHeight: 1.1,
              textShadow: "0 4px 20px rgba(0,0,0,0.4)",
              marginBottom: "30px",
            }}
          >
            {pick.event_name.length > 60
              ? pick.event_name.slice(0, 60) + "..."
              : pick.event_name}
          </div>

          {/* Tier badge si présent */}
          {tierInfo && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                background: tierInfo.bg,
                color: tierInfo.text,
                padding: "12px 28px",
                borderRadius: "999px",
                fontSize: 36,
                fontWeight: 900,
                letterSpacing: "2px",
                width: "fit-content",
                marginBottom: "20px",
                boxShadow: "0 6px 20px rgba(0,0,0,0.3)",
              }}
            >
              {tierInfo.emoji} {tierInfo.label}
            </div>
          )}

          {/* Selection + cote */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "30px",
              marginTop: "10px",
            }}
          >
            <div
              style={{
                fontSize: 38,
                color: "rgba(255,255,255,0.95)",
                fontWeight: 700,
                flex: 1,
              }}
            >
              {pick.selection.length > 35
                ? pick.selection.slice(0, 35) + "..."
                : pick.selection}
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                background: "rgba(0,0,0,0.3)",
                padding: "18px 36px",
                borderRadius: "20px",
                backdropFilter: "blur(10px)",
              }}
            >
              <div
                style={{
                  fontSize: 18,
                  color: "rgba(255,255,255,0.7)",
                  letterSpacing: "3px",
                }}
              >
                COTE
              </div>
              <div
                style={{
                  fontSize: 80,
                  color: "#fbbf24",
                  fontWeight: 900,
                  letterSpacing: "-2px",
                  lineHeight: 1,
                }}
              >
                {!isNaN(oddsValue) ? oddsValue.toFixed(2) : "—"}
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            zIndex: 10,
          }}
        >
          <div
            style={{
              fontSize: 24,
              color: "rgba(255,255,255,0.7)",
              fontWeight: 500,
              letterSpacing: "3px",
            }}
          >
            PRONOS.CLUB · IA gratuite · 9 sports
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}