/**
 * PRONOS.CLUB — X API Publisher (V3.5)
 *
 * Helper de publication sur X (Twitter) via X API v2.
 *
 * Auth : OAuth 1.0a User Context (les 4 tokens user, pas Bearer Token API)
 *   - X_API_KEY        (consumer key)
 *   - X_API_SECRET     (consumer secret)
 *   - X_ACCESS_TOKEN   (user access token)
 *   - X_ACCESS_TOKEN_SECRET (user access token secret)
 *
 * X_BEARER_TOKEN n'est pas utilisé pour POST /tweets (c'est pour les endpoints
 * read-only "App-only auth"). On l'a en config mais on ne l'utilise pas ici.
 *
 * 2 fonctions exportées :
 *   - postTweet(text)       : post simple (≤280 chars)
 *   - postThread(texts)     : post en thread (1er post + replies)
 *
 * Limites X API gratuit (Free tier) :
 *   - 17 tweets / 24h global
 *   - 50 tweets / mois (vérifie côté X dashboard)
 *
 * Stratégie filtrage côté caller :
 *   - publish-batch.ts → uniquement picks tier=lock|strong (Q8-A)
 *   - publish-results → 1 thread bilan jour (~5 posts)
 *   - bilan-hebdo → 1 thread (~5 posts) le dimanche
 *   - Total estimé : 6-12 posts/jour, ~80-150 posts/mois
 */

import OAuth from "oauth-1.0a";
import crypto from "crypto";

// ============================================================================
// CONFIGURATION
// ============================================================================

const X_API_KEY = process.env.X_API_KEY ?? "";
const X_API_SECRET = process.env.X_API_SECRET ?? "";
const X_ACCESS_TOKEN = process.env.X_ACCESS_TOKEN ?? "";
const X_ACCESS_TOKEN_SECRET = process.env.X_ACCESS_TOKEN_SECRET ?? "";

const X_API_TWEETS_ENDPOINT = "https://api.twitter.com/2/tweets";

/** Délai entre 2 posts d'un thread (anti rate-limit + ordre garanti) */
const THROTTLE_MS_THREAD = 2000;

/** Limite hard X par tweet (en grapheme units, mais 280 chars char en pratique) */
export const X_MAX_TWEET_LENGTH = 280;

// ============================================================================
// TYPES
// ============================================================================

export type PostTweetResult = {
  success: boolean;
  tweet_id?: string;
  error?: string;
  status_code?: number;
};

export type PostThreadResult = {
  success: boolean;
  posted_count: number;
  total_count: number;
  tweet_ids: string[];
  errors: Array<{ index: number; error: string }>;
};

type XApiTweetResponse = {
  data?: { id: string; text: string };
  errors?: Array<{ message: string; code?: number }>;
  detail?: string;
  status?: number;
  title?: string;
};

// ============================================================================
// HELPERS
// ============================================================================

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Initialise un client OAuth 1.0a configuré avec les credentials X.
 * Lazy : on ne le crée que si on a besoin de poster.
 */
const getOAuthClient = (): OAuth | null => {
  if (!X_API_KEY || !X_API_SECRET) return null;

  return new OAuth({
    consumer: { key: X_API_KEY, secret: X_API_SECRET },
    signature_method: "HMAC-SHA1",
    hash_function: (baseString, key) =>
      crypto.createHmac("sha1", key).update(baseString).digest("base64"),
  });
};

/**
 * Construit les headers OAuth 1.0a pour une requête donnée.
 */
const buildOAuthHeader = (
  oauth: OAuth,
  url: string,
  method: "POST" | "GET"
): string => {
  const requestData = { url, method };
  const token = {
    key: X_ACCESS_TOKEN,
    secret: X_ACCESS_TOKEN_SECRET,
  };
  const auth = oauth.authorize(requestData, token);
  const headers = oauth.toHeader(auth);
  return headers.Authorization;
};

/**
 * Vérifie qu'un texte est valide pour X.
 * - Non vide
 * - ≤ 280 caractères (compte UTF-16, approximatif mais OK)
 */
const isValidTweetText = (text: string): { valid: boolean; reason?: string } => {
  if (!text || text.trim().length === 0) {
    return { valid: false, reason: "Empty text" };
  }
  if (text.length > X_MAX_TWEET_LENGTH) {
    return {
      valid: false,
      reason: `Text length ${text.length} > ${X_MAX_TWEET_LENGTH}`,
    };
  }
  return { valid: true };
};

// ============================================================================
// POST TWEET (simple)
// ============================================================================

/**
 * Poste un tweet simple sur X.
 *
 * @param text Texte du tweet (≤280 chars)
 * @param replyToTweetId Optional, si fourni le tweet sera une reply (pour les threads)
 * @returns {success, tweet_id?, error?}
 */
export const postTweet = async (
  text: string,
  replyToTweetId?: string
): Promise<PostTweetResult> => {
  // ─── 1. Vérifs préalables
  const validation = isValidTweetText(text);
  if (!validation.valid) {
    return { success: false, error: validation.reason };
  }

  if (
    !X_API_KEY ||
    !X_API_SECRET ||
    !X_ACCESS_TOKEN ||
    !X_ACCESS_TOKEN_SECRET
  ) {
    return {
      success: false,
      error: "X API credentials missing (X_API_KEY / X_API_SECRET / X_ACCESS_TOKEN / X_ACCESS_TOKEN_SECRET)",
    };
  }

  const oauth = getOAuthClient();
  if (!oauth) {
    return { success: false, error: "OAuth client init failed" };
  }

  // ─── 2. Build payload
  const body: Record<string, unknown> = { text };
  if (replyToTweetId) {
    body.reply = { in_reply_to_tweet_id: replyToTweetId };
  }

  // ─── 3. Build OAuth header
  const authHeader = buildOAuthHeader(oauth, X_API_TWEETS_ENDPOINT, "POST");

  // ─── 4. Send (retry 2x sur 5xx ou 429)
  const MAX_RETRIES = 2;
  let lastError = "";
  let lastStatus = 0;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(X_API_TWEETS_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      lastStatus = response.status;
      const data = (await response.json()) as XApiTweetResponse;

      if (response.ok && data.data?.id) {
        return { success: true, tweet_id: data.data.id, status_code: 200 };
      }

      // Erreur explicite
      if (data.errors && data.errors.length > 0) {
        lastError = data.errors.map((e) => e.message).join("; ");
      } else if (data.detail) {
        lastError = data.detail;
      } else {
        lastError = `HTTP ${response.status}`;
      }

      // Retry sur 429 (rate limit) ou 5xx
      if (
        response.status === 429 ||
        (response.status >= 500 && response.status < 600)
      ) {
        if (attempt < MAX_RETRIES) {
          await sleep(2000 * (attempt + 1));
          continue;
        }
      }

      return {
        success: false,
        error: lastError,
        status_code: response.status,
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt < MAX_RETRIES) {
        await sleep(1000 * (attempt + 1));
        continue;
      }
    }
  }

  return { success: false, error: lastError, status_code: lastStatus };
};

// ============================================================================
// POST THREAD (suite de tweets en reply chain)
// ============================================================================

/**
 * Poste un thread X (suite de tweets liés en reply).
 *
 * @param texts Array de textes (chacun ≤280 chars)
 * @returns {success, posted_count, total_count, tweet_ids, errors}
 *
 * Stratégie : si le 1er post échoue → on stop tout (pas de thread orphelin).
 *             Si un reply ultérieur échoue → on continue (le thread est partiellement publié,
 *             mieux qu'aucun post).
 *
 * Throttle 2s entre chaque post pour respecter rate-limit X + garantir l'ordre.
 */
export const postThread = async (texts: string[]): Promise<PostThreadResult> => {
  const result: PostThreadResult = {
    success: false,
    posted_count: 0,
    total_count: texts.length,
    tweet_ids: [],
    errors: [],
  };

  if (texts.length === 0) {
    result.errors.push({ index: -1, error: "Empty texts array" });
    return result;
  }

  // ─── 1. Premier tweet (root du thread)
  const firstResult = await postTweet(texts[0]);
  if (!firstResult.success || !firstResult.tweet_id) {
    result.errors.push({
      index: 0,
      error: firstResult.error ?? "Unknown error on root tweet",
    });
    return result;
  }

  result.tweet_ids.push(firstResult.tweet_id);
  result.posted_count = 1;

  // Si un seul texte → terminé
  if (texts.length === 1) {
    result.success = true;
    return result;
  }

  // ─── 2. Replies en chain (chaque reply pointe vers le PREMIER tweet du thread)
  // Note : sur X, un thread = chaîne de replies sur le tweet racine, pas chaîne sur le précédent.
  // En pratique, on peut faire les 2 stratégies. On choisit "chaîne sur le précédent"
  // pour avoir un vrai thread linéaire.
  let previousTweetId = firstResult.tweet_id;

  for (let i = 1; i < texts.length; i++) {
    await sleep(THROTTLE_MS_THREAD);

    const replyResult = await postTweet(texts[i], previousTweetId);
    if (replyResult.success && replyResult.tweet_id) {
      result.tweet_ids.push(replyResult.tweet_id);
      result.posted_count++;
      previousTweetId = replyResult.tweet_id;
    } else {
      result.errors.push({
        index: i,
        error: replyResult.error ?? "Unknown error on reply",
      });
      // On continue malgré l'erreur (le thread sera partiellement publié)
    }
  }

  // Success si au moins le root + 80% des replies sont passés
  result.success = result.posted_count >= Math.ceil(texts.length * 0.8);

  return result;
};