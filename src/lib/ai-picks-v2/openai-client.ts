import OpenAI from "openai";
import { trackApiCost } from "./cost-tracker";
import {
  GeneratorOutputSchema,
  type GeneratorResult,
} from "@/types/ai-picks-v2";

const DEFAULT_MODEL = "gpt-5.4";
const MAX_COMPLETION_TOKENS = 8000;
const TEMPERATURE = 0.3;
const REQUEST_TIMEOUT_MS = 120000;
const MAX_RETRIES = 2;

const PRICING_PER_MTOKEN: Record<string, { input: number; output: number }> = {
  "gpt-5.4": { input: 2.5, output: 15.0 },
  "gpt-5.2": { input: 1.75, output: 14.0 },
  "gpt-5.5": { input: 5.0, output: 30.0 },
};

const computeCostUsd = (
  model: string,
  tokensInput: number,
  tokensOutput: number
): number => {
  const pricing = PRICING_PER_MTOKEN[model] ?? PRICING_PER_MTOKEN["gpt-5.4"];
  return (
    (tokensInput / 1_000_000) * pricing.input +
    (tokensOutput / 1_000_000) * pricing.output
  );
};

let openaiInstance: OpenAI | null = null;

const getClient = (): OpenAI => {
  if (openaiInstance) return openaiInstance;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing in environment variables");
  }
  openaiInstance = new OpenAI({ apiKey, timeout: REQUEST_TIMEOUT_MS });
  return openaiInstance;
};

export type RunGptGeneratorInput = {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  pickId?: string | null;
};

export const runGptGenerator = async (
  input: RunGptGeneratorInput
): Promise<GeneratorResult> => {
  const model = input.model ?? DEFAULT_MODEL;
  const startedAt = Date.now();

  let lastError: unknown = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const client = getClient();

      const completion = await client.chat.completions.create({
        model,
        max_completion_tokens: MAX_COMPLETION_TOKENS,
        temperature: TEMPERATURE,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: input.systemPrompt },
          { role: "user", content: input.userPrompt },
        ],
      });

      const latencyMs = Date.now() - startedAt;
      const tokensInput = completion.usage?.prompt_tokens ?? 0;
      const tokensOutput = completion.usage?.completion_tokens ?? 0;
      const costUsd = computeCostUsd(model, tokensInput, tokensOutput);

      const meta = {
        model,
        provider: "openai" as const,
        tokensInput,
        tokensOutput,
        tokensCached: 0,
        costUsd,
        latencyMs,
      };

      await trackApiCost({
        eventType: "generate",
        provider: "openai",
        model,
        pickId: input.pickId ?? null,
        tokensInput,
        tokensOutput,
        tokensCached: 0,
        costUsd,
      });

      const rawText = completion.choices[0]?.message?.content ?? "";
      if (!rawText) {
        return {
          output: null,
          meta,
          rawResponse: "",
          error: "GPT returned empty response",
        };
      }

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(rawText);
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
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
  }

  return {
    output: null,
    meta: {
      model,
      provider: "openai",
      tokensInput: 0,
      tokensOutput: 0,
      tokensCached: 0,
      costUsd: 0,
      latencyMs: Date.now() - startedAt,
    },
    error:
      lastError instanceof Error ? lastError.message : "Unknown OpenAI error",
  };
};

export type RunGptDossierInput = {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  pickId?: string | null;
  maxTokens?: number;
};

export type RunGptDossierResult = {
  text: string;
  tokensInput: number;
  tokensOutput: number;
  costUsd: number;
  latencyMs: number;
  model: string;
  error?: string;
};

export const runGptDossier = async (
  input: RunGptDossierInput
): Promise<RunGptDossierResult> => {
  const model = input.model ?? DEFAULT_MODEL;
  const startedAt = Date.now();

  try {
    const client = getClient();
    const completion = await client.chat.completions.create({
      model,
      max_completion_tokens: input.maxTokens ?? 4000,
      temperature: 0.5,
      messages: [
        { role: "system", content: input.systemPrompt },
        { role: "user", content: input.userPrompt },
      ],
    });

    const tokensInput = completion.usage?.prompt_tokens ?? 0;
    const tokensOutput = completion.usage?.completion_tokens ?? 0;
    const costUsd = computeCostUsd(model, tokensInput, tokensOutput);
    const text = completion.choices[0]?.message?.content ?? "";

    await trackApiCost({
      eventType: "analysis",
      provider: "openai",
      model,
      pickId: input.pickId ?? null,
      tokensInput,
      tokensOutput,
      tokensCached: 0,
      costUsd,
    });

    return {
      text,
      tokensInput,
      tokensOutput,
      costUsd,
      latencyMs: Date.now() - startedAt,
      model,
    };
  } catch (err) {
    return {
      text: "",
      tokensInput: 0,
      tokensOutput: 0,
      costUsd: 0,
      latencyMs: Date.now() - startedAt,
      model,
      error: err instanceof Error ? err.message : "Unknown OpenAI error",
    };
  }
};