import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

const intlMiddleware = createMiddleware(routing);

async function updateSupabaseSession(request: NextRequest, response: NextResponse) {
  // Create a Supabase client that reads/writes cookies on the request/response
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // This refreshes the session if expired — MUST be called
  await supabase.auth.getUser();

  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sitePassword = process.env.SITE_PASSWORD;

  // ── No password set → site is public ──
  if (!sitePassword) {
    const response = intlMiddleware(request);
    return updateSupabaseSession(request, response);
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

  // ── Check site password cookie ──
  const accessCookie = request.cookies.get("site_access");
  if (accessCookie?.value === "granted") {
    // Authenticated for site → run i18n + refresh Supabase session + noindex
    const response = intlMiddleware(request);
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return updateSupabaseSession(request, response);
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