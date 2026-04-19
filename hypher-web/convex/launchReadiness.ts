import { query } from "./_generated/server";
import { requireUserId } from "./lib/auth";

type Status = "ready" | "warning" | "blocked";

type Item = {
  id: string;
  label: string;
  status: Status;
  required: boolean;
  missing?: string[];
  note?: string;
};

function hasEnv(name: string): boolean {
  const value = process.env[name];
  return typeof value === "string" && value.trim().length > 0;
}

function item(args: {
  id: string;
  label: string;
  vars: string[];
  required: boolean;
  note?: string;
}): Item {
  const missing = args.vars.filter((name) => !hasEnv(name));
  const status: Status =
    missing.length === 0 ? "ready" : args.required ? "blocked" : "warning";

  return {
    id: args.id,
    label: args.label,
    status,
    required: args.required,
    ...(missing.length ? { missing } : {}),
    ...(args.note ? { note: args.note } : {}),
  };
}

function worst(statuses: Status[]): Status {
  if (statuses.includes("blocked")) return "blocked";
  if (statuses.includes("warning")) return "warning";
  return "ready";
}

export const getStatus = query({
  handler: async (ctx) => {
    await requireUserId(ctx);

    const items = [
      item({
        id: "convex-clerk-auth",
        label: "Convex Clerk auth",
        vars: ["CLERK_JWT_ISSUER_DOMAIN"],
        required: true,
        note: "Convex auth config needs the Clerk JWT issuer domain.",
      }),
      item({
        id: "convex-clerk-email",
        label: "Clerk user lookup",
        vars: ["CLERK_SECRET_KEY"],
        required: false,
        note: "Digest email delivery uses Clerk to resolve recipient addresses.",
      }),
      item({
        id: "convex-anthropic",
        label: "Convex AI actions",
        vars: ["ANTHROPIC_API_KEY"],
        required: false,
        note: "Used by older Convex AI and GitHub summary actions.",
      }),
      item({
        id: "convex-upstash",
        label: "Convex API rate limiting",
        vars: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
        required: false,
        note: "When missing, Convex API key rate limiting is intentionally disabled.",
      }),
      item({
        id: "convex-resend",
        label: "Digest email sending",
        vars: ["RESEND_API_KEY", "RESEND_FROM_EMAIL"],
        required: false,
        note: "Needed for scheduled digest delivery.",
      }),
      item({
        id: "convex-resend-inbound",
        label: "Digest reply webhook",
        vars: ["RESEND_INBOUND_SECRET"],
        required: false,
        note: "Resend inbound signatures use Svix headers and RESEND_INBOUND_SECRET.",
      }),
      item({
        id: "convex-stripe-sync",
        label: "Stripe to Convex sync",
        vars: ["STRIPE_CONVEX_SHARED_SECRET"],
        required: false,
        note: "Must match the Next.js env value for subscription updates.",
      }),
      item({
        id: "convex-github-token-storage",
        label: "GitHub token encryption",
        vars: ["GITHUB_TOKEN_ENCRYPTION_KEY"],
        required: false,
        note: "Needed before users can save GitHub PATs.",
      }),
      item({
        id: "convex-github-global-token",
        label: "GitHub global token",
        vars: ["GITHUB_TOKEN"],
        required: false,
        note: "Optional fallback for server-side GitHub context reads.",
      }),
      item({
        id: "convex-seed-webhook",
        label: "Signup seed mutation shared secret",
        vars: ["SEED_WEBHOOK_SECRET"],
        required: false,
        note: "Must match the Next.js env value used by the Clerk webhook route.",
      }),
    ];

    const group = {
      id: "convex-runtime",
      label: "Convex runtime",
      status: worst(items.map((row) => row.status)),
      items,
    };

    return {
      checkedAt: Date.now(),
      groups: [group],
    };
  },
});
