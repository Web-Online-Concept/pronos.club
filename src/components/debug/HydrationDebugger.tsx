"use client";

/**
 * ═══════════════════════════════════════════════════════════════════
 * HYDRATION DEBUGGER
 * ═══════════════════════════════════════════════════════════════════
 *
 * À placer dans le layout racine TEMPORAIREMENT.
 * Ce composant intercepte les warnings React en production et
 * affiche le vrai message d'erreur d'hydratation dans la console,
 * même quand React est minifié.
 *
 * Une fois le bug trouvé, SUPPRIMER ce composant du layout.
 * ═══════════════════════════════════════════════════════════════════
 */

import { useEffect } from "react";


export default function HydrationDebugger() {
  useEffect(() => {
    // Intercepte console.error pour capturer les warnings React
    const originalError = console.error;
    console.error = function (...args) {
      // On affiche tout — avec un préfixe très visible pour les warnings hydration
      const msg = args[0]?.toString?.() ?? "";
      if (
        msg.includes("Hydration") ||
        msg.includes("hydrat") ||
        msg.includes("did not match") ||
        msg.includes("Text content") ||
        msg.includes("suppressHydration")
      ) {
        originalError.apply(console, [
          "%c🔥 HYDRATION ERROR DETECTED 🔥",
          "background:#ef4444;color:white;padding:4px 8px;border-radius:4px;font-weight:bold;",
        ]);
      }
      originalError.apply(console, args);
    };

    // Comparaison HTML serveur vs DOM après hydration
    // Si le DOM a changé juste après le chargement, c'est un indice
    const htmlBefore = document.documentElement.outerHTML;
    setTimeout(() => {
      const htmlAfter = document.documentElement.outerHTML;
      if (htmlBefore !== htmlAfter) {
        console.log(
          "%c💡 DOM modifié après hydratation",
          "background:#8b5cf6;color:white;padding:4px 8px;border-radius:4px;",
        );
        console.log("Taille HTML initiale:", htmlBefore.length);
        console.log("Taille HTML après:", htmlAfter.length);
      }
    }, 100);

    return () => {
      console.error = originalError;
    };
  }, []);

  return null;
}