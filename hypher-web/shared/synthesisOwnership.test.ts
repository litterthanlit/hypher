import { describe, expect, it } from "vitest";
import { projectMemoryIdentityKind } from "./projectMemoryGenerate";
import {
  DEFAULT_HOSTED_SYNTHESIS_MODEL,
  SYNTHESIS_PROMPT_VERSION,
  heuristicMemoryModel,
  hostedMemoryModel,
  planHostedSynthesis,
  synthesisConfigFromEnv,
  synthesisStoredModel,
} from "./synthesisOwnership";

const hostedModel = "claude-sonnet-4-20250514";

describe("synthesis ownership", () => {
  it("defaults to the active agent and does not call a hosted model just because a key exists", () => {
    const config = synthesisConfigFromEnv({});
    expect(config.owner).toBe("agent");
    expect(config.modelId).toBe(DEFAULT_HOSTED_SYNTHESIS_MODEL);
    expect(config.promptVersion).toBe(SYNTHESIS_PROMPT_VERSION);
    expect(config.maxTokens).toBe(900);
    expect(config.temperature).toBe(0.2);

    const plan = planHostedSynthesis({
      config,
      apiKey: "sk-ant-real-key",
      rateLimitAllowed: true,
    });
    expect(plan).toEqual({ call: false, because: "owner-is-agent" });
  });

  it("treats unknown owner values as agent so hosted inference stays opt-in", () => {
    const config = synthesisConfigFromEnv({ HYPHER_SYNTHESIS_OWNER: "claude" });
    expect(config.owner).toBe("agent");
    expect(planHostedSynthesis({
      config,
      apiKey: "sk-ant-real-key",
      rateLimitAllowed: true,
    }).call).toBe(false);
  });

  it("uses configured model, prompt version, and effort only when owner is hosted", () => {
    const config = synthesisConfigFromEnv({
      HYPHER_SYNTHESIS_OWNER: "hosted",
      HYPHER_SYNTHESIS_MODEL: "claude-haiku-4-5",
      HYPHER_SYNTHESIS_PROMPT_VERSION: "project-memory-v2",
      HYPHER_SYNTHESIS_MAX_TOKENS: "5000",
      HYPHER_SYNTHESIS_TEMPERATURE: "2",
    });
    expect(config).toMatchObject({
      owner: "hosted",
      modelId: "claude-haiku-4-5",
      promptVersion: "project-memory-v2",
      maxTokens: 2000,
      temperature: 1,
    });
    expect(planHostedSynthesis({
      config,
      apiKey: "sk-ant-real-key",
      rateLimitAllowed: true,
    })).toEqual({ call: true, config });
    expect(planHostedSynthesis({
      config,
      apiKey: "sk-ant-...",
      rateLimitAllowed: true,
    })).toEqual({ call: false, because: "missing-key" });
    expect(planHostedSynthesis({
      config,
      apiKey: "sk-ant-real-key",
      rateLimitAllowed: false,
    })).toEqual({ call: false, because: "rate-limited" });
  });

  it("stores heuristic fallback without the hosted model id", () => {
    const config = synthesisConfigFromEnv({
      HYPHER_SYNTHESIS_OWNER: "hosted",
      HYPHER_SYNTHESIS_MODEL: hostedModel,
    });
    const stored = synthesisStoredModel({ understanding: "heuristic", config, reason: "dump" });
    expect(stored).toBe("heuristic:dump");
    expect(stored).not.toContain("sonnet");
    expect(stored).not.toContain("claude");
    expect(stored).not.toContain(hostedModel);
    expect(projectMemoryIdentityKind({ summary: "Shipped the gate.", model: stored })).toBe("heuristic");
    expect(heuristicMemoryModel("nope")).toBe("heuristic:manual");
  });

  it("stores a successful hosted compile with model and prompt version", () => {
    const config = synthesisConfigFromEnv({
      HYPHER_SYNTHESIS_OWNER: "hosted",
      HYPHER_SYNTHESIS_MODEL: hostedModel,
      HYPHER_SYNTHESIS_PROMPT_VERSION: "project-memory-v1",
    });
    const stored = hostedMemoryModel(config, "writeback");
    expect(stored).toBe(`hosted:${hostedModel}:project-memory-v1:writeback`);
    expect(projectMemoryIdentityKind({ summary: "Shipped the gate.", model: stored })).toBe("compiled");
  });
});
