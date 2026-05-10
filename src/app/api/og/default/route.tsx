/**
 * ═══════════════════════════════════════════════════════════════════
 * /api/og/default — Image OG par défaut V3.5
 * ═══════════════════════════════════════════════════════════════════
 *
 * Image générée pour les pages V3.5 qui n'ont pas d'OG image dédiée.
 * Format 1200x630 (ratio Open Graph standard).
 *
 * Look : gradient violet/fuchsia + logo + slogan principal.
 *
 * Path : src/app/api/og/default/route.tsx
 * ═══════════════════════════════════════════════════════════════════
 */

import { ImageResponse } from "next/og";

export const runtime = "edge";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://pronos.club";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #4c1d95 0%, #7c3aed 50%, #c026d3 100%)",
          padding: "60px",
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
              "radial-gradient(circle at 20% 80%, rgba(255,255,255,0.15) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.1) 0%, transparent 50%)",
          }}
        />

        {/* Logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${BASE_URL}/android-chrome-512x512.png`}
          width="180"
          height="180"
          alt="PRONOS.CLUB"
          style={{ marginBottom: "40px", borderRadius: "24px" }}
        />

        {/* Titre */}
        <div
          style={{
            fontSize: 90,
            fontWeight: 900,
            color: "white",
            letterSpacing: "-2px",
            textAlign: "center",
            textShadow: "0 4px 20px rgba(0,0,0,0.4)",
          }}
        >
          PRONOS.CLUB
        </div>

        {/* Sous-titre */}
        <div
          style={{
            fontSize: 36,
            fontWeight: 600,
            color: "rgba(255,255,255,0.95)",
            marginTop: "20px",
            textAlign: "center",
          }}
        >
          🤖 Pronostics IA gratuits, 9 sports
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 24,
            fontWeight: 500,
            color: "rgba(255,255,255,0.75)",
            marginTop: "30px",
            textAlign: "center",
          }}
        >
          Transparence totale · ROI public · CLV mesuré
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}