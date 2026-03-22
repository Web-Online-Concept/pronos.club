import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-04-30.basil",
});

export const PLAN = {
  name: "Premium",
  price: 20,
  currency: "EUR",
  interval: "month" as const,
  priceId: process.env.STRIPE_PRICE_MONTHLY_ID!,
  features: [
    "Tous les pronostics premium",
    "Analyses détaillées",
    "Screenshots des tickets",
    "Notifications en temps réel",
    "Accès à l'historique complet",
  ],
};
