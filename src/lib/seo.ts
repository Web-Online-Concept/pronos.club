// Default Open Graph and SEO metadata for PRONOS.CLUB

const BASE_URL = "https://pronos.club";

// Dynamic OG image URL builder
export function ogImageUrl(params: {
  title: string;
  subtitle?: string;
  cover?: string;
  logo?: string;
}): string {
  const url = new URL("/api/og", BASE_URL);
  url.searchParams.set("title", params.title);
  if (params.subtitle) url.searchParams.set("subtitle", params.subtitle);
  if (params.cover) url.searchParams.set("cover", params.cover);
  if (params.logo) url.searchParams.set("logo", params.logo);
  url.searchParams.set("v", "3");
  return url.toString();
}

export const defaultOpenGraph = {
  siteName: "PRONOS.CLUB",
  type: "website" as const,
  locale: "fr_FR",
  url: BASE_URL,
  images: [
    {
      url: ogImageUrl({ title: "Pronostics Sportifs Transparents", subtitle: "Statistiques vérifiables • ROI prouvé • +50 picks/mois" }),
      width: 1200,
      height: 630,
      alt: "PRONOS.CLUB — Pronostics Sportifs Transparents",
    },
  ],
};

export const defaultTwitter = {
  card: "summary_large_image" as const,
  site: "@pronos_club_",
  images: [ogImageUrl({ title: "Pronostics Sportifs Transparents", subtitle: "Statistiques vérifiables • ROI prouvé • +50 picks/mois" })],
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
  "mentions-legales": {
    title: "Mentions Légales — PRONOS.CLUB",
    description: "Mentions légales, éditeur du site, hébergement et informations juridiques de PRONOS.CLUB.",
  },
  cgu: {
    title: "Conditions Générales d'Utilisation — PRONOS.CLUB",
    description: "CGU de PRONOS.CLUB. Règles d'utilisation du site, responsabilités et droits des utilisateurs.",
  },
  cgv: {
    title: "Conditions Générales de Vente — PRONOS.CLUB",
    description: "CGV de PRONOS.CLUB. Abonnement Premium, paiement, résiliation et droit de rétractation.",
  },
  confidentialite: {
    title: "Politique de Confidentialité — PRONOS.CLUB",
    description: "Protection de vos données personnelles. RGPD, cookies, droits des utilisateurs.",
  },
  avis: {
    title: "Avis des Abonnés — PRONOS.CLUB",
    description: "Témoignages et avis vérifiés des abonnés Premium PRONOS.CLUB.",
  },
  login: {
    title: "Connexion — PRONOS.CLUB",
    description: "Connectez-vous ou créez votre compte PRONOS.CLUB. Accédez à vos pronostics et votre espace personnel.",
  },
  "pronos-abonnes": {
    title: "Pronos Abonnés — Communauté de Tipsters | PRONOS.CLUB",
    description: "Découvrez les pronostics sportifs de notre communauté d'abonnés. Suivez vos tipsters favoris, comparez les performances et participez aux concours hebdomadaires et mensuels.",
  },
  "pronos-abonnes-en-cours": {
    title: "Pronos Abonnés en Cours — PRONOS.CLUB",
    description: "Tous les pronostics sportifs en cours postés par la communauté d'abonnés PRONOS.CLUB. Picks simples et combinés, triés par heure de match.",
  },
  "pronos-abonnes-historique": {
    title: "Historique des Pronos Abonnés — PRONOS.CLUB",
    description: "Historique complet et vérifiable des pronostics sportifs postés par la communauté. Filtrez par sport, tipster et résultat. Transparence totale.",
  },
  "pronos-abonnes-classement": {
    title: "Classement des Tipsters — PRONOS.CLUB",
    description: "Classement des meilleurs tipsters de la communauté PRONOS.CLUB. Top semaine, top mois et all-time. ROI, profit et taux de réussite vérifiables.",
  },
  "pronos-abonnes-concours": {
    title: "Concours Tipsters — Gagnez Chaque Semaine | PRONOS.CLUB",
    description: "Participez aux concours hebdomadaires et mensuels réservés aux abonnés Premium. Gagnez des récompenses en cash en postant les meilleurs pronostics.",
  },
  "pronos-abonnes-fonctionnement": {
    title: "Comment Fonctionnent les Pronos Abonnés — PRONOS.CLUB",
    description: "Guide complet du système Pronos Abonnés : comment poster un pick, suivre les tipsters, gagner les concours et grimper au classement.",
  },
  "pronos-abonnes-tipster": {
    title: "Profil Tipster — PRONOS.CLUB",
    description: "Découvrez le profil complet d'un tipster de la communauté PRONOS.CLUB. Statistiques détaillées, historique des picks et ROI vérifiable.",
  },
};