// Default Open Graph and SEO metadata for PRONOS.CLUB
// Import and spread in any page's metadata

export const defaultOpenGraph = {
  siteName: "PRONOS.CLUB",
  type: "website" as const,
  locale: "fr_FR",
  url: "https://pronos.club",
  images: [
    {
      url: "https://pronos.club/og-image.jpg",
      width: 1200,
      height: 630,
      alt: "PRONOS.CLUB — Pronostics Sportifs Transparents",
    },
  ],
};

export const defaultTwitter = {
  card: "summary_large_image" as const,
  site: "@pronos_club_",
  images: ["https://pronos.club/og-image.jpg"],
};

// Per-page SEO metadata (French)
export const pageSEO: Record<string, { title: string; description: string }> = {
  home: {
    title: "PRONOS.CLUB — Pronostics Sportifs Transparents",
    description: "Suivez les pronostics d'un tipster vérifié. Statistiques transparentes, historique complet, ROI prouvé. Plus de 50 pronostics par mois.",
  },
  pronostics: {
    title: "Pronostics Sportifs du Jour — PRONOS.CLUB",
    description: "Consultez les pronostics sportifs du jour. Picks simples et combinés, cotes analysées, résultats vérifiables en temps réel.",
  },
  historique: {
    title: "Historique des Pronostics — PRONOS.CLUB",
    description: "Historique complet et vérifiable de tous nos pronostics sportifs. Les bons mois comme les mauvais, zéro triche.",
  },
  statistiques: {
    title: "Statistiques et Performances — PRONOS.CLUB",
    description: "ROI, taux de réussite, profit par sport, courbe de bankroll. Toutes les statistiques du tipster en toute transparence.",
  },
  bilans: {
    title: "Bilans Mensuels — PRONOS.CLUB",
    description: "Bilans mensuels détaillés avec ROI, profit, win rate et analyse des performances. Transparence totale.",
  },
  tipster: {
    title: "Notre Tipster — PRONOS.CLUB",
    description: "Découvrez la méthode, la philosophie et les résultats de notre tipster professionnel. Analyse, discipline et value betting.",
  },
  bookmakers: {
    title: "Bookmakers Recommandés — PRONOS.CLUB",
    description: "Comparatif des meilleurs bookmakers pour les paris sportifs. Codes bonus, avantages et guide d'inscription.",
  },
  blog: {
    title: "Blog — PRONOS.CLUB",
    description: "Actualités sportives, guides paris sportifs, analyses et previews. Tout le contenu pour devenir un parieur rentable.",
  },
  abonnement: {
    title: "Abonnement Premium — PRONOS.CLUB",
    description: "Accédez à tous les pronostics premium, groupe Telegram exclusif, alertes en temps réel. 20€/mois, sans engagement.",
  },
  contact: {
    title: "Contact — PRONOS.CLUB",
    description: "Contactez l'équipe PRONOS.CLUB. Questions, suggestions, partenariats.",
  },
  "jeu-responsable": {
    title: "Jeu Responsable — PRONOS.CLUB",
    description: "Les paris sportifs comportent des risques. Informations sur le jeu responsable, numéros d'aide et ressources.",
  },
};