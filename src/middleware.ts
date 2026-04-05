import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

const intlMiddleware = createMiddleware(routing);

async function updateSupabaseSession(request: NextRequest, response: NextResponse) {
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
            const persistentOptions = {
              ...options,
              maxAge: 60 * 60 * 24 * 7,
              sameSite: "lax" as const,
              secure: true,
            };
            request.cookies.set(name, value);
            response.cookies.set(name, value, persistentOptions);
          });
        },
      },
    }
  );

  await supabase.auth.getUser();

  return response;
}

// Known search engine bots that should bypass SITE_PASSWORD
function isSearchBot(request: NextRequest): boolean {
  const ua = request.headers.get("user-agent") || "";
  return /Googlebot|bingbot|Baiduspider|YandexBot|DuckDuckBot|Slurp|facebookexternalhit|Twitterbot|LinkedInBot|WhatsApp/i.test(ua);
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

  // ── Search bots bypass SITE_PASSWORD (SEO indexing) ──
  if (isSearchBot(request)) {
    const response = intlMiddleware(request);
    return updateSupabaseSession(request, response);
  }

  // ── Check site password cookie ──
  const accessCookie = request.cookies.get("site_access");
  if (accessCookie?.value === "granted") {
    const response = intlMiddleware(request);
    // noindex tant que le site est protégé par mot de passe
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