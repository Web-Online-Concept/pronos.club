// src/lib/stripe/has-other-active-sub.ts
//
// Garde-fou doublon centralisé.
//
// Vérifie si un client Stripe possède un AUTRE abonnement actif (ou en essai)
// que celui qu'on est en train de traiter. Utilisé avant toute révocation de
// premium (kick Telegram inclus), pour ne JAMAIS virer un abonné qui paie
// encore via un second abonnement.
//
// Comportement prudent : si l'appel Stripe échoue, on retourne `true`
// (= "il a un autre abo") pour NE PAS révoquer par erreur. Mieux vaut un accès
// de trop qu'un abonné payant viré à tort.

import { stripe } from "@/lib/stripe/config";

export async function hasOtherActiveSubscription(
  customerId: string,
  currentSubscriptionId: string
): Promise<boolean> {
  try {
    const activeSubs = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 10,
    });
    if (activeSubs.data.some((s) => s.id !== currentSubscriptionId)) {
      return true;
    }

    const trialingSubs = await stripe.subscriptions.list({
      customer: customerId,
      status: "trialing",
      limit: 10,
    });
    if (trialingSubs.data.some((s) => s.id !== currentSubscriptionId)) {
      return true;
    }

    return false;
  } catch (err) {
    // Prudence : en cas d'échec Stripe, on NE révoque PAS.
    console.error(
      "[stripe] hasOtherActiveSubscription check failed — assuming user keeps access:",
      err
    );
    return true;
  }
}