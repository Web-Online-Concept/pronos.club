"use client";

/**
 * ═══════════════════════════════════════════════════════════════════
 * HYDRATION DEBUGGER v2
 * ═══════════════════════════════════════════════════════════════════
 *
 * Compare le HTML avant/après hydratation et affiche les diffs exacts.
 * Identifie quels éléments ont changé pour trouver la source du bug #418.
 * ═══════════════════════════════════════════════════════════════════
 */

import { useEffect } from "react";


export default function HydrationDebugger() {
  useEffect(() => {
    const htmlBefore = document.documentElement.outerHTML;

    setTimeout(() => {
      const htmlAfter = document.documentElement.outerHTML;

      if (htmlBefore === htmlAfter) {
        console.log("%c✅ HTML identique avant/après hydratation", "color:green;font-weight:bold");
        return;
      }

      console.log(
        "%c🔍 HYDRATION DIFF DETECTED",
        "background:#ef4444;color:white;padding:6px 12px;border-radius:4px;font-weight:bold;font-size:14px",
      );
      console.log("Taille avant:", htmlBefore.length);
      console.log("Taille après:", htmlAfter.length);
      console.log("Différence:", htmlAfter.length - htmlBefore.length, "caractères");

      // Découpe par tag
      const tagsBefore = htmlBefore.split(/(?<=>)/);
      const tagsAfter = htmlAfter.split(/(?<=>)/);

      // Trouve les premières différences (max 5)
      const minLen = Math.min(tagsBefore.length, tagsAfter.length);
      const diffs: number[] = [];
      for (let i = 0; i < minLen && diffs.length < 5; i++) {
        if (tagsBefore[i] !== tagsAfter[i]) {
          diffs.push(i);
        }
      }

      if (diffs.length === 0) {
        console.log("Pas de différence détectée par tag, mais taille différente → ajout à la fin ?");
        console.log("Fin avant:", htmlBefore.slice(-300));
        console.log("Fin après:", htmlAfter.slice(-300));
      } else {
        console.log("%c📍 " + diffs.length + " différence(s) détectée(s)", "color:#8b5cf6;font-weight:bold");
        diffs.forEach((idx) => {
          console.log(
            "%c[AVANT #" + idx + "]%c " + (tagsBefore[idx]?.substring(0, 250) ?? "(absent)"),
            "background:red;color:white;padding:1px 4px;font-weight:bold",
            "color:red",
          );
          console.log(
            "%c[APRÈS #" + idx + "]%c " + (tagsAfter[idx]?.substring(0, 250) ?? "(absent)"),
            "background:green;color:white;padding:1px 4px;font-weight:bold",
            "color:green",
          );
        });
      }

      // Détecte les nouveaux éléments ajoutés
      const setBefore = new Set(tagsBefore);
      const newTags = tagsAfter.filter((t) => !setBefore.has(t)).slice(0, 10);
      if (newTags.length > 0) {
        console.log("%c🆕 Nouveaux éléments :", "color:#06b6d4;font-weight:bold");
        newTags.forEach((t, i) => console.log("  #" + i + ": " + t.substring(0, 300)));
      }
    }, 1500);
  }, []);

  return null;
}