import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
  typescript: true,
});

export const PLANS = {
  monthly: {
    name: "Mensuel",
    price: 1500, // centimes
    priceId: process.env.STRIPE_PRICE_MONTHLY_ID!,
    interval: "month" as const,
  },
  quarterly: {
    name: "Trimestriel",
    price: 3900,
    priceId: process.env.STRIPE_PRICE_QUARTERLY_ID!,
    interval: "month" as const,
    intervalCount: 3,
  },
  yearly: {
    name: "Annuel",
    price: 12900,
    priceId: process.env.STRIPE_PRICE_YEARLY_ID!,
    interval: "year" as const,
  },
} as const;
