import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const title = searchParams.get("title") || "PRONOS.CLUB";
  const subtitle = searchParams.get("subtitle") || "";
  const logoUrl = searchParams.get("logo") || "";

  // Load site logo as base64 data URI
  let logoSrc = "";
  try {
    const origin = new URL(req.url).origin;
    const logoRes = await fetch(`${origin}/pronos_club.png`);
    if (logoRes.ok) {
      const buf = await logoRes.arrayBuffer();
      const base64 = Buffer.from(buf).toString("base64");
      const contentType = logoRes.headers.get("content-type") || "image/png";
      logoSrc = `data:${contentType};base64,${base64}`;
    }
  } catch {}

  // Load bookmaker logo if provided
  let bookLogoSrc = "";
  if (logoUrl) {
    try {
      const res = await fetch(logoUrl);
      if (res.ok) {
        const buf = await res.arrayBuffer();
        const base64 = Buffer.from(buf).toString("base64");
        const contentType = res.headers.get("content-type") || "image/png";
        bookLogoSrc = `data:${contentType};base64,${base64}`;
      }
    } catch {}
  }

  const titleSize = title.length > 50 ? 34 : title.length > 35 ? 40 : 48;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)",
          padding: "0",
          fontFamily: "sans-serif",
        }}
      >
        {/* Top accent bar */}
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "5px",
            background: "linear-gradient(90deg, #059669, #10b981, #34d399, #10b981, #059669)",
          }}
        />

        {/* Main content area */}
        <div
          style={{
            display: "flex",
            flex: 1,
            padding: "50px 70px 20px 70px",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          {/* Left column */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              maxWidth: bookLogoSrc ? "750px" : "1000px",
            }}
          >
            {/* Logo */}
            {logoSrc ? (
              <img
                src={logoSrc}
                alt="PRONOS.CLUB"
                height={65}
                style={{ objectFit: "contain" }}
              />
            ) : (
              <div style={{ display: "flex", alignItems: "center" }}>
                <span style={{ fontSize: 44, fontWeight: 900, color: "white", letterSpacing: "2px" }}>PRONOS</span>
                <span style={{ fontSize: 44, fontWeight: 900, color: "#10b981", letterSpacing: "2px" }}>.CLUB</span>
              </div>
            )}

            {/* Separator line */}
            <div
              style={{
                display: "flex",
                width: "400px",
                height: "3px",
                marginTop: "28px",
                background: "linear-gradient(90deg, #059669, #10b981, transparent)",
                borderRadius: "2px",
              }}
            />

            {/* Title */}
            <div
              style={{
                display: "flex",
                marginTop: "28px",
                fontSize: titleSize,
                fontWeight: 800,
                color: "white",
                lineHeight: 1.2,
              }}
            >
              {title}
            </div>

            {/* Subtitle */}
            {subtitle && (
              <div
                style={{
                  display: "flex",
                  marginTop: "16px",
                  fontSize: 22,
                  color: "#10b981",
                  fontWeight: 600,
                }}
              >
                {subtitle}
              </div>
            )}
          </div>

          {/* Right column — bookmaker logo */}
          {bookLogoSrc && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "220px",
                height: "150px",
                borderRadius: "20px",
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(16,185,129,0.25)",
              }}
            >
              <img
                src={bookLogoSrc}
                alt=""
                width={180}
                height={120}
                style={{ objectFit: "contain" }}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "0 70px 30px 70px",
            fontSize: 13,
            color: "rgba(255,255,255,0.25)",
            letterSpacing: "2px",
          }}
        >
          <span>PRONOS.CLUB — PRONOSTICS SPORTIFS TRANSPARENTS</span>
          <span>pronos.club</span>
        </div>

        {/* Bottom accent bar */}
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "5px",
            background: "linear-gradient(90deg, #059669, #10b981, #34d399, #10b981, #059669)",
          }}
        />
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
      },
    }
  );
}