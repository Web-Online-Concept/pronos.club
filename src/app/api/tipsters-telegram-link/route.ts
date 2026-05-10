// src/app/api/tipsters-telegram-link/route.ts
//
// V3.5 (10/05/2026) — DÉSACTIVÉ.
//
// Décision : suppression complète des notifications par DM Telegram.
// Cet endpoint était utilisé par la page Notifications pour permettre aux abonnés
// de lier leur compte Telegram au bot @pronos_abonnes_club_bot.
//
// Le toggle "Telegram" a été retiré de la page Notifications côté front, donc
// cet endpoint ne devrait plus être appelé. Mais par sécurité (en cas d'ancien
// front en cache, scripts tiers, etc.), on conserve les 3 méthodes en stubs :
//   - GET    → retourne { linked: false } (pour ne pas casser le front qui l'appelle au mount)
//   - POST   → retourne 410 Gone (impossible de générer un nouveau lien)
//   - DELETE → retourne { success: true } (no-op, pour compat ascendante)
//
// Pour réactiver complètement : restaurer la version git précédente de ce fichier.

import { NextResponse } from "next/server";

// ── GET : statut actuel (toujours "non lié" maintenant) ──
// Conservé en non-410 pour ne pas casser le mount de la page Notifications
// si elle l'appelle encore en cache navigateur.
export async function GET() {
  return NextResponse.json({
    linked: false,
    deprecated: true,
    message: "Telegram DM notifications have been disabled.",
  });
}

// ── POST : génération d'un lien désactivée ──
export async function POST() {
  console.log(
    "[tipsters-telegram-link DEPRECATED] POST tentative de génération de lien — endpoint désactivé"
  );
  return NextResponse.json(
    {
      error: "Telegram DM notifications have been disabled.",
      deprecated: true,
    },
    { status: 410 } // 410 Gone
  );
}

// ── DELETE : déliaison désactivée mais retourne success ──
// On garde ce comportement permissif au cas où le front l'appelle encore
// pour "désactiver" sa configuration Telegram. Pas d'effet en BDD.
export async function DELETE() {
  return NextResponse.json({
    success: true,
    deprecated: true,
    message: "Telegram DM notifications have been disabled. No-op.",
  });
}