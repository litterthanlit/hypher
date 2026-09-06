"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useAuth } from "@clerk/nextjs";
import { type ReactNode } from "react";

const PLACEHOLDER_CONVEX_URL = "https://build-placeholder.convex.cloud";

// Placeholder URL allows `next build` when env is unset (e.g. CI); real deployments must set NEXT_PUBLIC_CONVEX_URL.
const convex = new ConvexReactClient(
  process.env.NEXT_PUBLIC_CONVEX_URL ?? PLACEHOLDER_CONVEX_URL
);

export function ConvexProviderWrapper({ children }: { children: ReactNode }) {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim()) {
    return <ConvexProvider client={convex}>{children}</ConvexProvider>;
  }

  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}
