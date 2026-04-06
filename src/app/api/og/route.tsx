import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const title = searchParams.get("title") || "PRONOS.CLUB";
  const subtitle = searchParams.get("subtitle") || "";
  const logoUrl = searchParams.get("logo") || "";
  const coverUrl = searchParams.get("cover") || "";

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
      const fullLogoUrl = logoUrl.startsWith("/") ? `${new URL(req.url).origin}${logoUrl}` : logoUrl;
      const res = await fetch(fullLogoUrl);
      if (res.ok) {
        const buf = await res.arrayBuffer();
        const base64 = Buffer.from(buf).toString("base64");
        const contentType = res.headers.get("content-type") || "image/png";
        bookLogoSrc = `data:${contentType};base64,${base64}`;
      }
    } catch {}
  }

  // Load cover image if provided (for blog articles)
  let coverSrc = "";
  if (coverUrl) {
    try {
      const fullCoverUrl = coverUrl.startsWith("/") ? `${new URL(req.url).origin}${coverUrl}` : coverUrl;
      const res = await fetch(fullCoverUrl);
      if (res.ok) {
        const buf = await res.arrayBuffer();
        const base64 = Buffer.from(buf).toString("base64");
        const contentType = res.headers.get("content-type") || "image/jpeg";
        coverSrc = `data:${contentType};base64,${base64}`;
      }
    } catch {}
  }

  const titleSize = title.length > 50 ? 32 : title.length > 35 ? 38 : 44;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)",
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

        {/* Main content — 2 columns */}
        <div
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            padding: "30px 70px",
          }}
        >
          {/* LEFT — Big PRONOS.CLUB logo */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "420px",
              flexShrink: 0,
            }}
          >
            {logoSrc ? (
              <img
                src={logoSrc}
                alt="PRONOS.CLUB"
                width={350}
                height={280}
                style={{ objectFit: "contain" }}
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <span style={{ fontSize: 64, fontWeight: 900, color: "white", letterSpacing: "3px" }}>PRONOS</span>
                <span style={{ fontSize: 64, fontWeight: 900, color: "#10b981", letterSpacing: "3px" }}>.CLUB</span>
              </div>
            )}
          </div>

          {/* RIGHT — Bookmaker logo + Title + Subtitle */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              paddingLeft: "40px",
              alignItems: "center",
            }}
          >
            {/* Cover image (blog) or Bookmaker logo */}
            {coverSrc ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "420px",
                  height: "220px",
                  borderRadius: "16px",
                  overflow: "hidden",
                  marginBottom: "20px",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <img
                  src={coverSrc}
                  alt=""
                  width={420}
                  height={220}
                  style={{ objectFit: "cover", width: "100%", height: "100%" }}
                />
              </div>
            ) : bookLogoSrc ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "320px",
                  height: "180px",
                  borderRadius: "20px",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  marginBottom: "24px",
                }}
              >
                <img
                  src={bookLogoSrc}
                  alt=""
                  width={280}
                  height={150}
                  style={{ objectFit: "contain" }}
                />
              </div>
            ) : null}

            {/* Separator */}
            <div
              style={{
                display: "flex",
                width: "300px",
                height: "3px",
                background: "linear-gradient(90deg, #059669, #10b981, #059669)",
                borderRadius: "2px",
                marginBottom: "20px",
              }}
            />

            {/* Title */}
            <div
              style={{
                display: "flex",
                fontSize: titleSize,
                fontWeight: 800,
                color: "white",
                lineHeight: 1.2,
                textAlign: "center",
              }}
            >
              {title}
            </div>

            {/* Subtitle */}
            {subtitle && (
              <div
                style={{
                  display: "flex",
                  marginTop: "12px",
                  fontSize: 20,
                  color: "#10b981",
                  fontWeight: 600,
                  maxWidth: "500px",
                  textAlign: "center",
                }}
              >
                {subtitle}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "0 70px 25px 70px",
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