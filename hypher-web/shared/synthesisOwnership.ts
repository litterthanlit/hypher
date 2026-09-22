/**
 * Who compiles project identity, and which hosted model may run.
 * Default owner is the active agent. A configured API key does not start hosted inference.
 * Heuristic writes omit the hosted model id so a fallback cannot look like that model understood the project.
 */

export const SYNTHESIS_PROMPT_VERSION = "project-memory-v1";
export const DEFAULT_HOSTED_SYNTHESIS_MODEL = "claude-sonnet-4-20250514";

export type SynthesisOwner = "agent" | "hosted";
export type SynthesisUnderstanding = "heuristic" | "hosted";
export type SynthesisReason = "dump" | "writeback" | "manual";

export interface SynthesisConfig {
  owner: SynthesisOwner;
  modelId: string;
  promptVersion: string;
  maxTokens: number;
  temperature: number;
}

export type HostedSynthesisPlan =
  | { call: true; config: SynthesisConfig }
  | { call: false; because: "owner-is-agent" | "missing-key" | "rate-limited" };

function clampInteger(value: string | undefined, min: number, max: number, fallback: number): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function clampUnit(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(1, Math.max(0, parsed));
}

function token(value: string, fallback: string, max = 80): string {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max);
  return cleaned || fallback;
}

export function synthesisReason(value: string): SynthesisReason {
  if (value === "dump" || value === "writeback" || value === "manual") return value;
  return "manual";
}

export function synthesisConfigFromEnv(env: Record<string, string | undefined>): SynthesisConfig {
  const ownerRaw = (env.HYPHER_SYNTHESIS_OWNER ?? "agent").trim().toLowerCase();
  const modelRaw = (env.HYPHER_SYNTHESIS_MODEL ?? DEFAULT_HOSTED_SYNTHESIS_MODEL).trim();
  const promptRaw = (env.HYPHER_SYNTHESIS_PROMPT_VERSION ?? SYNTHESIS_PROMPT_VERSION).trim();
  return {
    owner: ownerRaw === "hosted" ? "hosted" : "agent",
    modelId: modelRaw || DEFAULT_HOSTED_SYNTHESIS_MODEL,
    promptVersion: promptRaw || SYNTHESIS_PROMPT_VERSION,
    maxTokens: clampInteger(env.HYPHER_SYNTHESIS_MAX_TOKENS, 256, 2000, 900),
    temperature: clampUnit(env.HYPHER_SYNTHESIS_TEMPERATURE, 0.2),
  };
}

export function hasUsableAnthropicKey(apiKey: string | undefined): apiKey is string {
  return Boolean(apiKey?.startsWith("sk-ant-") && !apiKey.includes("..."));
}

export function planHostedSynthesis(input: {
  config: SynthesisConfig;
  apiKey: string | undefined;
  rateLimitAllowed: boolean;
}): HostedSynthesisPlan {
  if (input.config.owner !== "hosted") return { call: false, because: "owner-is-agent" };
  if (!hasUsableAnthropicKey(input.apiKey)) return { call: false, because: "missing-key" };
  if (!input.rateLimitAllowed) return { call: false, because: "rate-limited" };
  return { call: true, config: input.config };
}

/** Stored on heuristic writes. Never includes the hosted model id. */
export function heuristicMemoryModel(reason: string): string {
  return `heuristic:${synthesisReason(reason)}`;
}

export function hostedMemoryModel(config: SynthesisConfig, reason: string): string {
  return `hosted:${token(config.modelId, "configured-model")}:${token(config.promptVersion, SYNTHESIS_PROMPT_VERSION)}:${synthesisReason(reason)}`;
}

export function synthesisStoredModel(input: {
  understanding: SynthesisUnderstanding;
  config: SynthesisConfig;
  reason: string;
}): string {
  if (input.understanding === "hosted") return hostedMemoryModel(input.config, input.reason);
  return heuristicMemoryModel(input.reason);
}
