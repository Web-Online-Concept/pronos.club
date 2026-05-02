/**
 * PRONOS.CLUB — Dictionnaire d'alias d'équipes
 *
 * Quand the-odds-api et api-football utilisent des noms différents pour la même équipe,
 * on définit ici les alias bidirectionnels pour que le matching de fixtures fonctionne.
 *
 * Tous les noms doivent être en LOWERCASE et NORMALISÉS (sans accents, sans ponctuation).
 *
 * Construction : si "Team A" peut être appelée "Team B" ailleurs, on met :
 *   "team a": ["team b"]
 *   "team b": ["team a"]
 *
 * Le dico fonctionne en complément du fuzzy matching par tokens.
 * À ajouter ici uniquement les cas où les tokens ne suffisent pas
 * (ex: "QPR" ↔ "Queens Park Rangers" — pas de tokens en commun).
 */

export const TEAM_ALIASES: Record<string, string[]> = {
  // ──────────── ANGLETERRE ────────────
  "queens park rangers": ["qpr"],
  "qpr": ["queens park rangers"],
  "wolverhampton wanderers": ["wolves"],
  "wolves": ["wolverhampton wanderers"],
  "brighton and hove albion": ["brighton"],
  "brighton": ["brighton and hove albion"],
  "newcastle united": ["newcastle"],
  "newcastle": ["newcastle united"],
  "west ham united": ["west ham"],
  "west ham": ["west ham united"],
  "sheffield united": ["sheffield utd"],
  "sheffield utd": ["sheffield united"],
  "west bromwich albion": ["west brom"],
  "west brom": ["west bromwich albion"],
  "manchester united": ["man united", "man utd"],
  "manchester city": ["man city"],

  // ──────────── ESPAGNE ────────────
  "athletic bilbao": ["athletic club"],
  "athletic club": ["athletic bilbao"],
  "atletico madrid": ["atlético madrid"],
  "cadiz": ["cádiz cf"],
  "cádiz cf": ["cadiz", "cádiz"],

  // ──────────── ALLEMAGNE ────────────
  "tsg hoffenheim": ["1899 hoffenheim", "hoffenheim"],
  "1899 hoffenheim": ["tsg hoffenheim", "hoffenheim"],
  "bayern munich": ["bayern münchen", "bayern muenchen"],
  "bayern münchen": ["bayern munich"],

  // ──────────── BELGIQUE ────────────
  "sint truiden": ["st. truiden", "sint-truiden", "stvv"],
  "st. truiden": ["sint truiden"],
  "union saint-gilloise": ["union st. gilloise", "union sg"],
  "union st. gilloise": ["union saint-gilloise"],

  // ──────────── AUTRICHE ────────────
  "fc blau-weiß linz": ["fc bw linz", "blau-weiss linz", "bw linz"],
  "fc bw linz": ["fc blau-weiß linz"],

  // ──────────── ARABIE SAOUDITE ────────────
  "al-khaleej": ["al khaleej saihat", "al khaleej"],
  "al khaleej saihat": ["al-khaleej"],
  "al-hilal": ["al-hilal saudi fc", "al hilal"],
  "al-hilal saudi fc": ["al-hilal"],
  "al-hazem": ["al-hazm", "al hazm", "al hazem"],
  "al-hazm": ["al-hazem"],
  "neom": ["neom sc"],

  // ──────────── GRÈCE ────────────
  "ael": ["ael larisa", "larisa"],
  "ael larisa": ["ael"],
  "larisa": ["ael"],
};