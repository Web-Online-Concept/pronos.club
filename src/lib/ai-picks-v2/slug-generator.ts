const ACCENT_MAP: Record<string, string> = {
  à: "a", â: "a", ä: "a", á: "a", ã: "a", å: "a",
  ç: "c",
  è: "e", é: "e", ê: "e", ë: "e",
  ì: "i", í: "i", î: "i", ï: "i",
  ñ: "n",
  ò: "o", ó: "o", ô: "o", ö: "o", õ: "o",
  ù: "u", ú: "u", û: "u", ü: "u",
  ý: "y", ÿ: "y",
  æ: "ae", œ: "oe",
  ß: "ss",
};

const removeAccents = (input: string): string => {
  let result = "";
  for (const char of input) {
    const lowered = char.toLowerCase();
    result += ACCENT_MAP[lowered] ?? lowered;
  }
  return result;
};

const slugifyPart = (input: string): string => {
  return removeAccents(input)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
};

const truncateAtBoundary = (input: string, maxLength: number): string => {
  if (input.length <= maxLength) return input;
  const truncated = input.slice(0, maxLength);
  const lastDash = truncated.lastIndexOf("-");
  return lastDash > 0 ? truncated.slice(0, lastDash) : truncated;
};

const formatDateDDMMYYYY = (isoDate: string): string => {
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return "";
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${day}-${month}-${year}`;
};

export type SlugMatchInput = {
  homeTeam: string;
  awayTeam: string;
  league: string;
  eventDate: string;
};

export const buildMatchSlug = (input: SlugMatchInput): string => {
  const home = slugifyPart(input.homeTeam);
  const away = slugifyPart(input.awayTeam);
  const league = slugifyPart(input.league);
  const date = formatDateDDMMYYYY(input.eventDate);

  const homeShort = truncateAtBoundary(home, 30);
  const awayShort = truncateAtBoundary(away, 30);
  const leagueShort = truncateAtBoundary(league, 35);

  const raw = `${homeShort}-vs-${awayShort}-${leagueShort}-${date}`;
  return truncateAtBoundary(raw, 120);
};

export type SlugScorerInput = {
  playerName: string;
  homeTeam: string;
  awayTeam: string;
  eventDate: string;
};

export const buildScorerSlug = (input: SlugScorerInput): string => {
  const player = slugifyPart(input.playerName);
  const home = slugifyPart(input.homeTeam);
  const away = slugifyPart(input.awayTeam);
  const date = formatDateDDMMYYYY(input.eventDate);

  const playerShort = truncateAtBoundary(player, 35);
  const matchPart = `${truncateAtBoundary(home, 20)}-${truncateAtBoundary(away, 20)}`;

  const raw = `buteur-${playerShort}-${matchPart}-${date}`;
  return truncateAtBoundary(raw, 120);
};