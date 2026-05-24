export type LaunchReadinessStatus = "ready" | "warning" | "blocked";

export interface LaunchReadinessItem {
  id: string;
  label: string;
  status: LaunchReadinessStatus;
  required: boolean;
  missing?: string[];
  note?: string;
}

export interface LaunchReadinessGroup {
  id: string;
  label: string;
  status: LaunchReadinessStatus;
  items: LaunchReadinessItem[];
}

export interface LaunchReadinessResponse {
  ok: boolean;
  checkedAt: number;
  groups: LaunchReadinessGroup[];
}

type EnvMap = Record<string, string | undefined>;

type Requirement = {
  id: string;
  label: string;
  vars: string[];
  required: boolean | ((env: EnvMap) => boolean);
  note?: string | ((env: EnvMap, missing: string[]) => string | undefined);
  invalid?: (name: string, value: string | undefined, env: EnvMap) => boolean;
};

type GroupSpec = {
  id: string;
  label: string;
  items: Requirement[];
};

const PLACEHOLDER_CONVEX_URL = "https://build-placeholder.convex.cloud";

export const STRIPE_WEBHOOK_PATH = "/api/stripe/webhook";
export const RESEND_INBOUND_SECRET_ENV = "RESEND_INBOUND_SECRET";

const nextGroupSpecs: GroupSpec[] = [
  {
    id: "auth-data",
    label: "Auth and data",
    items: [
      {
        id: "clerk-browser-server",
        label: "Clerk browser and server keys",
        vars: [
          "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
          "CLERK_SECRET_KEY",
          "CLERK_WEBHOOK_SIGNING_SECRET",
        ],
        required: true,
        note: "Sign-in, protected routes, and Clerk webhooks depend on these.",
      },
      {
        id: "convex-client-url",
        label: "Convex client URL",
        vars: ["NEXT_PUBLIC_CONVEX_URL"],
        required: true,
        invalid: (_name, value) => value === PLACEHOLDER_CONVEX_URL,
        note: "Production must point at a real Convex deployment, not the build placeholder.",
      },
      {
        id: "app-url",
        label: "Public app URL",
        vars: ["NEXT_PUBLIC_APP_URL"],
        required: false,
        note: "Used for checkout redirects, unsubscribe links, and digest links.",
      },
      {
        id: "convex-deploy-key",
        label: "Convex deploy key",
        vars: ["CONVEX_DEPLOY_KEY"],
        required: false,
        note: "Needed for production deploy automation, not local development.",
      },
      {
        id: "seed-webhook-next",
        label: "Signup seed webhook shared secret",
        vars: ["SEED_WEBHOOK_SECRET"],
        required: false,
        note: "Needed by the Clerk webhook route to seed demo data for new users.",
      },
    ],
  },
  {
    id: "beta-gate",
    label: "Beta gate",
    items: [
      {
        id: "beta-admins-next",
        label: "Beta admin user IDs",
        vars: ["BETA_ADMIN_USER_IDS"],
        required: false,
        note: "Convex also needs this env var; admins bypass the invite gate and manage beta invites.",
      },
      {
        id: "beta-gate-enabled",
        label: "Invite gate enabled",
        vars: ["BETA_INVITE_GATE_ENABLED"],
        required: (env) => env.NODE_ENV === "production",
        invalid: (_name, value, env) => env.NODE_ENV === "production" && value !== "true",
        note: (env) =>
          env.NODE_ENV === "production"
            ? "Set BETA_INVITE_GATE_ENABLED=true before a controlled beta launch."
            : "Local development stays open unless this is explicitly set to true.",
      },
    ],
  },
  {
    id: "ai",
    label: "AI",
    items: [
      {
        id: "anthropic-next",
        label: "Anthropic API key",
        vars: ["ANTHROPIC_API_KEY"],
        required: true,
        note: "Powers project memory, ambient ask, and digest generation in Next.js routes.",
      },
    ],
  },
  {
    id: "rate-limiting",
    label: "Rate limiting",
    items: [
      {
        id: "upstash-next",
        label: "Upstash Redis",
        vars: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
        required: (env) => env.NODE_ENV === "production",
        note: (env) =>
          env.NODE_ENV === "production"
            ? "Upstash rate limiting is required in production."
            : "When missing, rate limiting is disabled outside production.",
      },
    ],
  },
  {
    id: "billing",
    label: "Billing",
    items: [
      {
        id: "stripe-checkout",
        label: "Stripe checkout",
        vars: ["STRIPE_SECRET_KEY", "STRIPE_PRICE_PRO_MONTHLY", "STRIPE_PRICE_LIFETIME"],
        required: false,
        note: "Free beta can run without checkout; paid plans need these before launch.",
      },
      {
        id: "stripe-webhook",
        label: "Stripe webhook sync",
        vars: ["STRIPE_WEBHOOK_SECRET", "STRIPE_CONVEX_SHARED_SECRET"],
        required: false,
        note: `Stripe webhook endpoint: ${STRIPE_WEBHOOK_PATH}.`,
      },
    ],
  },
  {
    id: "extension-capture",
    label: "Extension and public capture",
    items: [
      {
        id: "extension-origin",
        label: "Chrome extension origin lock",
        vars: ["EXTENSION_ID"],
        required: (env) => env.NODE_ENV === "production",
        note: (env) =>
          env.NODE_ENV === "production"
            ? "Production CORS only echoes the configured Chrome extension ID."
            : "Development accepts chrome-extension origins broadly; production requires EXTENSION_ID.",
      },
    ],
  },
  {
    id: "observability",
    label: "Observability",
    items: [
      {
        id: "sentry-dsn",
        label: "Sentry runtime reporting",
        vars: ["NEXT_PUBLIC_SENTRY_DSN"],
        required: false,
        note: "Launch-week visibility depends on runtime error reporting.",
      },
      {
        id: "sentry-source-maps",
        label: "Sentry source maps",
        vars: ["SENTRY_AUTH_TOKEN"],
        required: false,
        note: "Needed during builds to upload readable stack traces.",
      },
    ],
  },
];

function hasEnvValue(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function getMissingVars(requirement: Requirement, env: EnvMap): string[] {
  return requirement.vars.filter((name) => {
    const value = env[name];
    if (!hasEnvValue(value)) return true;
    return requirement.invalid?.(name, value, env) ?? false;
  });
}

function requiredFor(requirement: Requirement, env: EnvMap): boolean {
  return typeof requirement.required === "function"
    ? requirement.required(env)
    : requirement.required;
}

export function worstLaunchStatus(statuses: LaunchReadinessStatus[]): LaunchReadinessStatus {
  if (statuses.includes("blocked")) return "blocked";
  if (statuses.includes("warning")) return "warning";
  return "ready";
}

export function buildLaunchReadiness(
  env: EnvMap,
  checkedAt = Date.now()
): LaunchReadinessResponse {
  const groups = nextGroupSpecs.map((group) => {
    const items = group.items.map((requirement): LaunchReadinessItem => {
      const missing = getMissingVars(requirement, env);
      const required = requiredFor(requirement, env);
      const status: LaunchReadinessStatus =
        missing.length === 0 ? "ready" : required ? "blocked" : "warning";
      const note =
        typeof requirement.note === "function"
          ? requirement.note(env, missing)
          : requirement.note;

      return {
        id: requirement.id,
        label: requirement.label,
        status,
        required,
        ...(missing.length ? { missing } : {}),
        ...(note ? { note } : {}),
      };
    });

    return {
      id: group.id,
      label: group.label,
      status: worstLaunchStatus(items.map((item) => item.status)),
      items,
    };
  });

  return {
    ok: !groups.some((group) => group.status === "blocked"),
    checkedAt,
    groups,
  };
}

export function combineLaunchReadinessGroups(
  groups: LaunchReadinessGroup[],
  checkedAt = Date.now()
): LaunchReadinessResponse {
  return {
    ok: !groups.some((group) => group.status === "blocked"),
    checkedAt,
    groups,
  };
}

export function getLaunchStatusLabel(status: LaunchReadinessStatus): string {
  switch (status) {
    case "ready":
      return "Ready";
    case "warning":
      return "Warning";
    case "blocked":
      return "Blocked";
  }
}
