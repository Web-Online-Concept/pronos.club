import { ogImageUrl } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ pseudo: string }> }) {
  const { pseudo } = await params;
  const displayName = decodeURIComponent(pseudo);
  const title = `${displayName} — Tipster | PRONOS.CLUB`;
  const description = `Profil complet du tipster ${displayName} sur PRONOS.CLUB. Statistiques détaillées, historique des pronostics, ROI et taux de réussite vérifiables.`;
  const image = ogImageUrl({ title: `Tipster ${displayName}`, subtitle: "Statistiques et historique vérifiables" });
  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: image, width: 1200, height: 630 }], siteName: "PRONOS.CLUB" },
    twitter: { card: "summary_large_image" as const, site: "@pronos_club_", title, description, images: [image] },
  };
}

export default function Layout({ children }: { children: React.ReactNode }) { return children; }