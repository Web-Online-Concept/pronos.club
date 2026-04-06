import { ogImageUrl, pageSEO } from "@/lib/seo";

export async function generateMetadata() {
  const seo = pageSEO.tipster;
  const image = ogImageUrl({ title: seo.title });
  return {
    title: seo.title,
    description: seo.description,
    openGraph: { title: seo.title, description: seo.description, images: [{ url: image, width: 1200, height: 630 }], siteName: "PRONOS.CLUB" },
    twitter: { card: "summary_large_image" as const, site: "@pronos_club_", title: seo.title, description: seo.description, images: [image] },
  };
}

export default function Layout({ children }: { children: React.ReactNode }) { return children; }