import { describe, expect, it } from "vitest";
import {
  RESEND_INBOUND_SECRET_ENV,
  STRIPE_WEBHOOK_PATH,
  buildLaunchReadiness,
  worstLaunchStatus,
} from "./launchReadiness";

const fullEnv = {
  NODE_ENV: "production",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_secret-value",
  CLERK_SECRET_KEY: "sk_live_secret-value",
  CLERK_WEBHOOK_SIGNING_SECRET: "whsec_secret-value",
  NEXT_PUBLIC_CONVEX_URL: "https://real.convex.cloud",
  NEXT_PUBLIC_APP_URL: "https://hypher.app",
  CONVEX_DEPLOY_KEY: "prod:secret-value",
  ANTHROPIC_API_KEY: "sk-ant-secret-value",
  OPENAI_API_KEY: "sk-openai-secret-value",
  UPSTASH_REDIS_REST_URL: "https://upstash.example",
  UPSTASH_REDIS_REST_TOKEN: "upstash-secret-value",
  STRIPE_SECRET_KEY: "sk_live_stripe-secret-value",
  STRIPE_PRICE_PRO_MONTHLY: "price_monthly",
  STRIPE_PRICE_LIFETIME: "price_lifetime",
  STRIPE_WEBHOOK_SECRET: "stripe-webhook-secret-value",
  STRIPE_CONVEX_SHARED_SECRET: "stripe-convex-secret-value",
  EXTENSION_ID: "abcdefghijklmnopabcdefghijklmnop",
  NEXT_PUBLIC_SENTRY_DSN: "https://sentry-secret-value@sentry.io/1",
  SENTRY_AUTH_TOKEN: "sentry-secret-value",
  BETA_INVITE_GATE_ENABLED: "true",
  BETA_ADMIN_USER_IDS: "user_admin",
};

function findItem(response: ReturnType<typeof buildLaunchReadiness>, id: string) {
  const item = response.groups.flatMap((group) => group.items).find((row) => row.id === id);
  if (!item) throw new Error(`Missing item ${id}`);
  return item;
}

describe("launch readiness classification", () => {
  it("returns ready when all tracked env vars are present", () => {
    const readiness = buildLaunchReadiness(fullEnv, 123);
    expect(readiness.ok).toBe(true);
    expect(readiness.groups.every((group) => group.status === "ready")).toBe(true);
  });

  it("returns blocked when a required env var is missing", () => {
    const readiness = buildLaunchReadiness({ ...fullEnv, ANTHROPIC_API_KEY: undefined }, 123);
    expect(readiness.ok).toBe(false);
    expect(findItem(readiness, "anthropic-next")).toMatchObject({
      status: "blocked",
      missing: ["ANTHROPIC_API_KEY"],
    });
  });

  it("blocks when voice transcription env is missing", () => {
    const readiness = buildLaunchReadiness({ ...fullEnv, OPENAI_API_KEY: undefined }, 123);
    expect(readiness.ok).toBe(false);
    expect(findItem(readiness, "openai-voice-next")).toMatchObject({
      status: "blocked",
      missing: ["OPENAI_API_KEY"],
    });
  });

  it("returns warning when an optional env var is missing", () => {
    const readiness = buildLaunchReadiness({ ...fullEnv, SENTRY_AUTH_TOKEN: undefined }, 123);
    expect(readiness.ok).toBe(true);
    expect(findItem(readiness, "sentry-source-maps")).toMatchObject({
      status: "warning",
      missing: ["SENTRY_AUTH_TOKEN"],
    });
  });

  it("uses the worst child status for a group", () => {
    expect(worstLaunchStatus(["ready", "warning", "blocked"])).toBe("blocked");
    expect(worstLaunchStatus(["ready", "warning"])).toBe("warning");
    expect(worstLaunchStatus(["ready"])).toBe("ready");
  });

  it("never returns secret values", () => {
    const payload = JSON.stringify(buildLaunchReadiness(fullEnv, 123));
    expect(payload).not.toContain("secret-value");
    expect(payload).not.toContain("sk_live_stripe");
    expect(payload).not.toContain("sk-ant");
  });
});

describe("launch readiness env and route mapping", () => {
  it("uses the code-truth Resend inbound secret name", () => {
    expect(RESEND_INBOUND_SECRET_ENV).toBe("RESEND_INBOUND_SECRET");
  });

  it("documents the current Stripe webhook route", () => {
    const readiness = buildLaunchReadiness({
      ...fullEnv,
      STRIPE_WEBHOOK_SECRET: undefined,
    }, 123);
    expect(STRIPE_WEBHOOK_PATH).toBe("/api/stripe/webhook");
    expect(findItem(readiness, "stripe-webhook").note).toContain("/api/stripe/webhook");
  });

  it("requires EXTENSION_ID in production", () => {
    const readiness = buildLaunchReadiness({
      ...fullEnv,
      EXTENSION_ID: undefined,
      NODE_ENV: "production",
    }, 123);
    expect(findItem(readiness, "extension-origin")).toMatchObject({
      required: true,
      status: "blocked",
      missing: ["EXTENSION_ID"],
    });
  });

  it("HYP-REL-009 blocks production readiness when Upstash envs are absent", () => {
    const readiness = buildLaunchReadiness({
      ...fullEnv,
      UPSTASH_REDIS_REST_URL: undefined,
      UPSTASH_REDIS_REST_TOKEN: undefined,
    }, 123);
    expect(findItem(readiness, "upstash-next")).toMatchObject({
      status: "blocked",
      missing: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
    });
    expect(findItem(readiness, "upstash-next").note).toContain("required in production");
  });

  it("blocks production readiness when the beta gate is disabled", () => {
    const readiness = buildLaunchReadiness({
      ...fullEnv,
      BETA_INVITE_GATE_ENABLED: "false",
      NODE_ENV: "production",
    }, 123);
    expect(findItem(readiness, "beta-gate-enabled")).toMatchObject({
      status: "blocked",
      missing: ["BETA_INVITE_GATE_ENABLED"],
    });
  });
});
