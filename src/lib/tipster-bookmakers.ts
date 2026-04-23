// src/lib/tipster-bookmakers.ts
// Liste centralisée des bookmakers autorisés pour les Pronos Abonnés
// Ajouter / retirer des bookmakers ici se répercute partout (form, validation API, affichage)

export const BOOKMAKERS = [
  // France (légaux ANJ)
  "Winamax",
  "Betclic",
  "Unibet",
  "PMU",
  "Bwin",
  "Parions Sport",
  "Netbet",
  "Zebet",
  "Vbet",
  // Internationaux connus
  "Bet365",
  "Pinnacle",
  "PS3838",
  "Stake",
  "1xBet",
] as const;

export type Bookmaker = typeof BOOKMAKERS[number];