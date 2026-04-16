import type { AuthConfig } from "convex/server";

const domain = process.env.CLERK_JWT_ISSUER_DOMAIN;

if (!domain) {
  throw new Error(
    "Missing CLERK_JWT_ISSUER_DOMAIN — set it in Convex env to your Clerk Frontend API URL (e.g. https://YOUR-INSTANCE.clerk.accounts.dev)"
  );
}

export default {
  providers: [
    {
      domain,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
