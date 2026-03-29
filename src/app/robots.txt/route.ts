export async function GET() {
  const robots = `User-agent: *
Allow: /
Disallow: /api/
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