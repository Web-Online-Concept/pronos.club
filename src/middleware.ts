import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

const intlMiddleware = createMiddleware(routing);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sitePassword = process.env.SITE_PASSWORD;

  // ── No password set → site is public, just run i18n ──
  if (!sitePassword) {
    return intlMiddleware(request);
  }

  // ── Skip protection for static/API/password routes ──
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/password" ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|webp|css|js|woff|woff2)$/)
  ) {
    return NextResponse.next();
  }

  // ── Check cookie ──
  const accessCookie = request.cookies.get("site_access");
  if (accessCookie?.value === "granted") {
    // Authenticated → run i18n middleware + add noindex
    const response = intlMiddleware(request);
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  }

  // ── Not authenticated → show password page ──
  const url = request.nextUrl.clone();
  url.pathname = "/password";
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: [
    "/((?!api|_next|.*\\..*).*)",
  ],
};