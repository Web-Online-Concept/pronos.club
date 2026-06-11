const BOT_TOKEN = (process.env.TELEGRAM_PREMIUM_BOT_TOKEN || "").trim();
const GROUP_ID = (process.env.TELEGRAM_GROUP_ID || "").trim();
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

const MAX_RETRIES = 3;
const REQUEST_TIMEOUT_MS = 10000;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

type TelegramResponse = {
  ok: boolean;
  result?: unknown;
  description?: string;
  error_code?: number;
  parameters?: { retry_after?: number };
};

/**
 * Helper centralisé pour tous les appels Telegram.
 *
 * Gère :
 * - Timeout par requête (10s)
 * - Retry automatique sur erreur réseau (UND_ERR_SOCKET, ECONNRESET, etc.)
 * - Retry automatique sur 5xx (serveur Telegram en panne ponctuelle)
 * - Respect du retry_after officiel sur 429 (rate limit Telegram)
 * - Exponential backoff (1s, 2s, 4s) entre les tentatives
 * - Echec definitif apres MAX_RETRIES tentatives
 *
 * Retourne la reponse parsee meme en cas d'erreur applicative (data.ok = false),
 * pour que les callers puissent loguer le detail. Throw uniquement sur echec
 * reseau total ou timeout apres tous les retries.
 */
async function telegramRequest(
  method: string,
  body: Record<string, unknown>
): Promise<TelegramResponse> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(`${TELEGRAM_API}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      // 429 : rate limit, on respecte retry_after
      if (res.status === 429) {
        const data = (await res.json()) as TelegramResponse;
        const waitSec = data.parameters?.retry_after ?? 1;
        console.warn(
          `[telegram] rate limited on ${method}, waiting ${waitSec}s`
        );
        await sleep(waitSec * 1000);
        continue;
      }

      // 5xx : erreur serveur Telegram, on retry
      if (res.status >= 500) {
        const waitMs = 1000 * Math.pow(2, attempt);
        console.warn(
          `[telegram] server error ${res.status} on ${method}, retrying in ${waitMs}ms`
        );
        await sleep(waitMs);
        continue;
      }

      // 2xx ou 4xx applicatif : on retourne, le caller decide
      return (await res.json()) as TelegramResponse;
    } catch (err) {
      lastError = err;

      // Erreur reseau ou timeout : on retry sauf si dernier essai
      const isLastAttempt = attempt === MAX_RETRIES - 1;
      if (isLastAttempt) break;

      const waitMs = 1000 * Math.pow(2, attempt);
      console.warn(
        `[telegram] network error on ${method} (attempt ${attempt + 1}/${MAX_RETRIES}), retrying in ${waitMs}ms`,
        err
      );
      await sleep(waitMs);
    }
  }

  // Tous les retries ont echoue
  throw lastError instanceof Error
    ? lastError
    : new Error(`[telegram] ${method} failed after ${MAX_RETRIES} attempts`);
}

export async function createInviteLink(userId: string): Promise<string | null> {
  try {
    const data = await telegramRequest("createChatInviteLink", {
      chat_id: GROUP_ID,
      creates_join_request: true, // User must be approved — webhook gets the invite link info
      expire_date: Math.floor(Date.now() / 1000) + 60 * 60 * 48, // 48h
      name: `premium-${userId.slice(0, 8)}`,
    });

    if (data.ok && (data.result as { invite_link?: string })?.invite_link) {
      return (data.result as { invite_link: string }).invite_link;
    }
    console.error("[telegram] createInviteLink error:", data);
    return null;
  } catch (err) {
    console.error("[telegram] createInviteLink failed:", err);
    return null;
  }
}

export async function kickMember(telegramUserId: number): Promise<boolean> {
  try {
    // Ban the user (removes from group)
    const banData = await telegramRequest("banChatMember", {
      chat_id: GROUP_ID,
      user_id: telegramUserId,
    });

    if (!banData.ok) {
      console.error("[telegram] banChatMember error:", banData);
      return false;
    }

    // Unban immediately so they can rejoin later if they resubscribe.
    // Si l'unban echoue, on retourne quand meme true car le ban a reussi
    // (l'utilisateur est ejecte, c'est l'objectif principal de kickMember).
    try {
      await telegramRequest("unbanChatMember", {
        chat_id: GROUP_ID,
        user_id: telegramUserId,
        only_if_banned: true,
      });
    } catch (unbanErr) {
      console.warn(
        "[telegram] unbanChatMember failed (member still banned, will not auto-rejoin):",
        unbanErr
      );
    }

    return true;
  } catch (err) {
    console.error("[telegram] kickMember failed:", err);
    return false;
  }
}

export async function revokeInviteLink(inviteLink: string): Promise<boolean> {
  try {
    const data = await telegramRequest("revokeChatInviteLink", {
      chat_id: GROUP_ID,
      invite_link: inviteLink,
    });
    return data.ok === true;
  } catch (err) {
    console.error("[telegram] revokeInviteLink failed:", err);
    return false;
  }
}

/**
 * Renvoie le statut d'un membre dans le groupe :
 *   "creator" | "administrator" | "member" | "restricted" | "left" | "kicked"
 * ou null si l'appel échoue.
 *
 * Sert au cron de réconciliation pour savoir qui est RÉELLEMENT présent
 * dans le groupe avant de tenter un kick (évite de polluer les logs avec
 * des kicks sur des gens déjà partis).
 */
export async function getChatMemberStatus(
  telegramUserId: number
): Promise<string | null> {
  try {
    const data = await telegramRequest("getChatMember", {
      chat_id: GROUP_ID,
      user_id: telegramUserId,
    });
    if (data.ok && (data.result as { status?: string })?.status) {
      return (data.result as { status: string }).status;
    }
    return null;
  } catch (err) {
    console.error("[telegram] getChatMemberStatus failed:", err);
    return null;
  }
}

/**
 * True si l'utilisateur est présent et actif dans le groupe
 * (creator, administrator, member ou restricted présent).
 * False s'il est parti/banni, null inconnu => traité comme "pas sûr".
 */
export async function isUserInGroup(
  telegramUserId: number
): Promise<boolean | null> {
  const status = await getChatMemberStatus(telegramUserId);
  if (status === null) return null;
  return ["creator", "administrator", "member", "restricted"].includes(status);
}