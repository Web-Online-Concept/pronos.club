// src/lib/over-05-buts-equipes/auth.ts
//
// Auth whitelist pour l'outil "Over 0.5 buts Equipes" (projet privé Bertrand).
//
// Seuls les emails listés ici peuvent acceder a la tuile, la page, et toutes
// les routes API liees. Les emails sont compares en lowercase pour eviter
// les soucis de casse.

/**
 * Liste blanche des emails autorises a utiliser l'outil.
 * Pour ajouter un nouvel utilisateur : ajouter son email ici (en lowercase).
 */
export const O05_AUTHORIZED_EMAILS = [
  "flotoulouse7@gmail.com",
  "bertrandwebjob@yahoo.fr",
] as const;


/**
 * Verifie si un email est autorise a acceder a l'outil.
 * @param email Email a verifier (peut etre null/undefined)
 * @returns true si l'email est dans la whitelist
 */
export const isO05Authorized = (email: string | null | undefined): boolean => {
  if (!email) return false;
  return O05_AUTHORIZED_EMAILS.includes(
    email.toLowerCase() as (typeof O05_AUTHORIZED_EMAILS)[number]
  );
};


/**
 * Helper pour les routes API Next.js.
 * A utiliser apres avoir recupere le user depuis Supabase.
 */
export const requireO05Auth = (userEmail: string | null | undefined): void => {
  if (!isO05Authorized(userEmail)) {
    throw new Error("Forbidden: O05 tool requires whitelist authorization");
  }
};