export async function GET() {
  const robots = `User-agent: *
Allow: /

Disallow: /api/auth/
Disallow: /api/user/
Disallow: /api/user-picks/
Disallow: /api/picks/
Disallow: /api/stats/
Disallow: /api/stats-full/
Disallow: /api/stripe/
Disallow: /api/admin/
Disallow: /api/blog/
Disallow: /api/contact/
Disallow: /api/cron/
Disallow: /api/telegram/
Disallow: /api/notifications/
Disallow: /api/bookmakers/
Disallow: /api/reviews/
Disallow: /api/ensure-profile/
Disallow: /fr/admin/
Disallow: /en/admin/
Disallow: /es/admin/
Disallow: /fr/espace/
Disallow: /en/espace/
Disallow: /es/espace/
Disallow: /fr/login
Disallow: /en/login
Disallow: /es/login

Sitemap: https://pronos.club/sitemap.xml
`;

  return new Response(robots, {
    headers: { "Content-Type": "text/plain" },
  });
}