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
};

export default withNextIntl(nextConfig);