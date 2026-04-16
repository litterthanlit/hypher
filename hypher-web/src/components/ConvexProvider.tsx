"use client";

import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useAuth } from "@clerk/nextjs";
import { type ReactNode } from "react";

// Placeholder URL allows `next build` when env is unset (e.g. CI); real deployments must set NEXT_PUBLIC_CONVEX_URL.
const convex = new ConvexReactClient(
  process.env.NEXT_PUBLIC_CONVEX_URL ?? "https://build-placeholder.convex.cloud"
);

export function ConvexProviderWrapper({ children }: { children: ReactNode }) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}
