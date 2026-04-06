import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const title = searchParams.get("title") || "PRONOS.CLUB";
  const subtitle = searchParams.get("subtitle") || "";
  const coverImage = searchParams.get("cover") || "";
  const logoUrl = searchParams.get("logo") || "";

  // Fetch the site logo
  let logoData: ArrayBuffer | null = null;
  try {
    const logoRes = await fetch(new URL("/pronos_club.png", req.url));
    if (logoRes.ok) logoData = await logoRes.arrayBuffer();
  } catch {}

  // Fetch bookmaker logo if provided
  let bookLogoData: ArrayBuffer | null = null;
  if (logoUrl) {
    try {
      const res = await fetch(logoUrl);
      if (res.ok) bookLogoData = await res.arrayBuffer();
    } catch {}
  }

  // Fetch cover image if provided
  let coverData: ArrayBuffer | null = null;
  if (coverImage) {
    try {
      const res = await fetch(coverImage);
      if (res.ok) coverData = await res.arrayBuffer();
    } catch {}
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          position: "relative",
          overflow: "hidden",
          fontFamily: "sans-serif",
        }}
      >
        {/* Background */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)",
            display: "flex",
          }}
        />

        {/* Cover image overlay if provided */}
        {coverData && (
          <div
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              width: 500,
              height: 630,
              display: "flex",
              overflow: "hidden",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverData as unknown as string}
              alt=""
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                opacity: 0.3,
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(90deg, #0a0a0a 0%, transparent 100%)",
                display: "flex",
              }}
            />
          </div>
        )}

        {/* Top accent bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 1200,
            height: 5,
            background: "linear-gradient(90deg, #059669, #10b981, #34d399, #10b981, #059669)",
            display: "flex",
          }}
        />

        {/* Bottom accent bar */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            width: 1200,
            height: 5,
            background: "linear-gradient(90deg, #059669, #10b981, #34d399, #10b981, #059669)",
            display: "flex",
          }}
        />

        {/* Content */}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "60px 80px",
            width: "100%",
            height: "100%",
          }}
        >
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {logoData && (
              <img
                src={logoData as unknown as string}
                alt="PRONOS.CLUB"
                style={{ height: 70, width: "auto" }}
              />
            )}
            {!logoData && (
              <div style={{ display: "flex", gap: 4 }}>
                <span style={{ fontSize: 42, fontWeight: 900, color: "white", letterSpacing: 2 }}>PRONOS</span>
                <span style={{ fontSize: 42, fontWeight: 900, color: "#10b981", letterSpacing: 2 }}>.CLUB</span>
              </div>
            )}
          </div>

          {/* Separator */}
          <div
            style={{
              marginTop: 30,
              width: 500,
              height: 3,
              background: "linear-gradient(90deg, #059669, #10b981, transparent)",
              borderRadius: 2,
              display: "flex",
            }}
          />

          {/* Title */}
          <div
            style={{
              marginTop: 30,
              fontSize: title.length > 40 ? 36 : 46,
              fontWeight: 800,
              color: "white",
              lineHeight: 1.2,
              maxWidth: bookLogoData ? 700 : 900,
              display: "flex",
            }}
          >
            {title}
          </div>

          {/* Subtitle */}
          {subtitle && (
            <div
              style={{
                marginTop: 16,
                fontSize: 22,
                color: "#10b981",
                fontWeight: 600,
                maxWidth: 700,
                display: "flex",
              }}
            >
              {subtitle}
            </div>
          )}

          {/* Footer */}
          <div
            style={{
              position: "absolute",
              bottom: 40,
              left: 80,
              fontSize: 14,
              color: "rgba(255,255,255,0.3)",
              letterSpacing: 3,
              display: "flex",
            }}
          >
            PRONOS.CLUB — PRONOSTICS SPORTIFS TRANSPARENTS
          </div>
          <div
            style={{
              position: "absolute",
              bottom: 40,
              right: 80,
              fontSize: 14,
              color: "rgba(255,255,255,0.3)",
              display: "flex",
            }}
          >
            pronos.club
          </div>
        </div>

        {/* Bookmaker logo on the right */}
        {bookLogoData && (
          <div
            style={{
              position: "absolute",
              right: 80,
              top: "50%",
              transform: "translateY(-50%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 220,
              height: 150,
              borderRadius: 20,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(16,185,129,0.2)",
            }}
          >
            <img
              src={bookLogoData as unknown as string}
              alt=""
              style={{ maxWidth: 180, maxHeight: 120, objectFit: "contain" }}
            />
          </div>
        )}
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}