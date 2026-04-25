import { trackApiCost } from "./cost-tracker";
import {
  GeneratorOutputSchema,
  type GeneratorResult,
} from "@/types/ai-picks-v2";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-4-6";
const ANTHROPIC_VERSION = "2023-06-01";
const MAX_TOKENS = 8000;
const TEMPERATURE = 0.3;
const REQUEST_TIMEOUT_MS = 120000;
const MAX_RETRIES = 2;

const PRICING_PER_MTOKEN: Record<
  string,
  {
    input: number;
    output: number;
    cacheWrite: number;
    cacheRead: number;
  }
> = {
  "claude-sonnet-4-6": {
    input: 3.0,
    output: 15.0,
    cacheWrite: 3.75,
    cacheRead: 0.3,
  },
  "claude-opus-4-7": {
    input: 15.0,
    output: 75.0,
    cacheWrite: 18.75,
    cacheRead: 1.5,
  },
  "claude-haiku-4-5": {
    input: 1.0,
    output: 5.0,
    cacheWrite: 1.25,
    cacheRead: 0.1,
  },
};

const computeCostUsd = (
  model: string,
  tokensInput: number,
  tokensOutput: number,
  tokensCacheRead: number,
  tokensCacheWrite: number
): number => {
  const p = PRICING_PER_MTOKEN[model] ?? PRICING_PER_MTOKEN["claude-sonnet-4-6"];
  return (
    (tokensInput / 1_000_000) * p.input +
    (tokensOutput / 1_000_000) * p.output +
    (tokensCacheRead / 1_000_000) * p.cacheRead +
    (tokensCacheWrite / 1_000_000) * p.cacheWrite
  );
};

type AnthropicMessage = {
  role: "user" | "assistant";
  content:
    | string
    | Array<{
        type: "text";
        text: string;
        cache_control?: { type: "ephemeral" };
      }>;
};

type AnthropicSystemBlock = {
  type: "text";
  text: string;
  cache_control?: { type: "ephemeral" };
};

type AnthropicRequestBody = {
  model: string;
  max_tokens: number;
  temperature: number;
  system: AnthropicSystemBlock[];
  messages: AnthropicMessage[];
};

type AnthropicUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
};

type AnthropicResponse = {
  id: string;
  type: string;
  role: string;
  content: Array<{ type: string; text?: string }>;
  model: string;
  stop_reason: string;
  usage: AnthropicUsage;
};

type AnthropicErrorResponse = {
  type: "error";
  error: {
    type: string;
    message: string;
  };
};

const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

const callAnthropic = async (
  body: AnthropicRequestBody
): Promise<AnthropicResponse> => {
  const apiKey = process.env.CLAUDE_API_KEY_AI_PICKS;
  if (!apiKey) {
    throw new Error("CLAUDE_API_KEY_AI_PICKS is missing in environment variables");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errBody = (await response.json().catch(() => null)) as
        | AnthropicErrorResponse
        | null;
      const message =
        errBody?.error?.message ?? `HTTP ${response.status}`;
      throw new Error(`Anthropic API error: ${message}`);
    }

    const json = (await response.json()) as AnthropicResponse;
    return json;
  } finally {
    clearTimeout(timeout);
  }
};

export type RunClaudeGeneratorInput = {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  pickId?: string | null;
  enableCache?: boolean;
};

export const runClaudeGenerator = async (
  input: RunClaudeGeneratorInput
): Promise<GeneratorResult> => {
  const model = input.model ?? DEFAULT_MODEL;
  const startedAt = Date.now();
  const enableCache = input.enableCache ?? true;

  let lastError: unknown = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const systemBlocks: AnthropicSystemBlock[] = [
        {
          type: "text",
          text: input.systemPrompt,
          ...(enableCache ? { cache_control: { type: "ephemeral" } } : {}),
        },
      ];

      const body: AnthropicRequestBody = {
        model,
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
        system: systemBlocks,
        messages: [
          {
            role: "user",
            content: input.userPrompt,
          },
        ],
      };

      const response = await callAnthropic(body);
      const latencyMs = Date.now() - startedAt;

      const tokensInput = response.usage.input_tokens;
      const tokensOutput = response.usage.output_tokens;
      const tokensCacheRead = response.usage.cache_read_input_tokens ?? 0;
      const tokensCacheWrite =
        response.usage.cache_creation_input_tokens ?? 0;

      const costUsd = computeCostUsd(
        model,
        tokensInput,
        tokensOutput,
        tokensCacheRead,
        tokensCacheWrite
      );

      const meta = {
        model,
        provider: "anthropic" as const,
        tokensInput,
        tokensOutput,
        tokensCached: tokensCacheRead,
        costUsd,
        latencyMs,
      };

      await trackApiCost({
        eventType: "generate",
        provider: "anthropic",
        model,
        pickId: input.pickId ?? null,
        tokensInput,
        tokensOutput,
        tokensCached: tokensCacheRead,
        costUsd,
        metadata: { tokensCacheWrite },
      });

      const textBlock = response.content.find((c) => c.type === "text");
      const rawText = textBlock?.text ?? "";

      if (!rawText) {
        return {
          output: null,
          meta,
          rawResponse: "",
          error: "Claude returned empty response",
        };
      }

      const cleaned = rawText
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(cleaned);
      } catch (jsonErr) {
        return {
          output: null,
          meta,
          rawResponse: rawText,
          error: `JSON parse failed: ${
            jsonErr instanceof Error ? jsonErr.message : "unknown"
          }`,
        };
      }

      const validated = GeneratorOutputSchema.safeParse(parsedJson);
      if (!validated.success) {
        return {
          output: null,
          meta,
          rawResponse: rawText,
          error: `Schema validation failed: ${validated.error.message}`,
        };
      }

      return {
        output: validated.data,
        meta,
        rawResponse: rawText,
      };
    } catch (err) {
      lastError = err;
      if (attempt === MAX_RETRIES - 1) break;
      await sleep(2000 * (attempt + 1));
    }
  }

  return {
    output: null,
    meta: {
      model,
      provider: "anthropic",
      tokensInput: 0,
      tokensOutput: 0,
      tokensCached: 0,
      costUsd: 0,
      latencyMs: Date.now() - startedAt,
    },
    error:
      lastError instanceof Error ? lastError.message : "Unknown Claude error",
  };
};

export type RunClaudeDossierInput = {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  pickId?: string | null;
  maxTokens?: number;
  enableCache?: boolean;
};

export type RunClaudeDossierResult = {
  text: string;
  tokensInput: number;
  tokensOutput: number;
  tokensCached: number;
  costUsd: number;
  latencyMs: number;
  model: string;
  error?: string;
};

export const runClaudeDossier = async (
  input: RunClaudeDossierInput
): Promise<RunClaudeDossierResult> => {
  const model = input.model ?? DEFAULT_MODEL;
  const startedAt = Date.now();
  const enableCache = input.enableCache ?? true;

  try {
    const systemBlocks: AnthropicSystemBlock[] = [
      {
        type: "text",
        text: input.systemPrompt,
        ...(enableCache ? { cache_control: { type: "ephemeral" } } : {}),
      },
    ];

    const body: AnthropicRequestBody = {
      model,
      max_tokens: input.maxTokens ?? 4000,
      temperature: 0.5,
      system: systemBlocks,
      messages: [
        {
          role: "user",
          content: input.userPrompt,
        },
      ],
    };

    const response = await callAnthropic(body);

    const tokensInput = response.usage.input_tokens;
    const tokensOutput = response.usage.output_tokens;
    const tokensCacheRead = response.usage.cache_read_input_tokens ?? 0;
    const tokensCacheWrite =
      response.usage.cache_creation_input_tokens ?? 0;

    const costUsd = computeCostUsd(
      model,
      tokensInput,
      tokensOutput,
      tokensCacheRead,
      tokensCacheWrite
    );

    const textBlock = response.content.find((c) => c.type === "text");
    const text = textBlock?.text ?? "";

    await trackApiCost({
      eventType: "analysis",
      provider: "anthropic",
      model,
      pickId: input.pickId ?? null,
      tokensInput,
      tokensOutput,
      tokensCached: tokensCacheRead,
      costUsd,
      metadata: { tokensCacheWrite },
    });

    return {
      text,
      tokensInput,
      tokensOutput,
      tokensCached: tokensCacheRead,
      costUsd,
      latencyMs: Date.now() - startedAt,
      model,
    };
  } catch (err) {
    return {
      text: "",
      tokensInput: 0,
      tokensOutput: 0,
      tokensCached: 0,
      costUsd: 0,
      latencyMs: Date.now() - startedAt,
      model,
      error: err instanceof Error ? err.message : "Unknown Claude error",
    };
  }
};