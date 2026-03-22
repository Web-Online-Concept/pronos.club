import { NextResponse } from "next/server";

export async function GET() {
  const sitePassword = process.env.SITE_PASSWORD;

  // If site is password-protected, block all crawlers
  if (sitePassword) {
    return new NextResponse(
      `User-agent: *\nDisallow: /\n`,
      { headers: { "Content-Type": "text/plain" } }
    );
  }

  // Site is public — allow crawling
  return new NextResponse(
    `User-agent: *\nAllow: /\n\nSitemap: https://pronos.club/sitemap.xml\n`,
    { headers: { "Content-Type": "text/plain" } }
  );
}