import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  htmlLimitedBots:
    /Googlebot|Bingbot|Yandex|Baiduspider|Twitterbot|facebookexternalhit|rogerbot|linkedinbot|embedly|quora link preview|showyoubot|outbrain|pinterest|slackbot|vkShare|W3C_Validator|whatsapp|TelegramBot/,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "gcbgghuxxskxlknhmpaz.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Empêche l'embedding en iframe (clickjacking)
          { key: "X-Frame-Options", value: "DENY" },
          // Empêche le sniffing de type MIME
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Contrôle les infos envoyées dans le Referer
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Désactive caméra, micro, géoloc
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // Protection XSS navigateurs anciens
          { key: "X-XSS-Protection", value: "1; mode=block" },
          // Force HTTPS pendant 1 an
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);