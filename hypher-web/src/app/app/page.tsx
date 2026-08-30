"use client";

import { useAuth } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { BetaInviteGate } from "@/components/BetaInviteGate";
import { getAppAccessState, getAppGateQueryArgs } from "@/lib/activation";
import type { BetaGateState } from "@/lib/beta";
import { HypherApp } from "./HypherApp";
import { SignInRequired } from "./SignInRequired";

export default function AppHome() {
  const { isLoaded: clerkLoaded, isSignedIn } = useAuth();
  const { isLoading: convexAuthLoading } = useConvexAuth();
  const signedIn = Boolean(isSignedIn);
  const gateState = useQuery(
    // typegen pending convex dev/codegen for this new module
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (api as any).beta.getGateState,
    getAppGateQueryArgs({ clerkLoaded, isSignedIn: signedIn, convexAuthLoading })
  ) as BetaGateState | undefined;
  const appAccessState = getAppAccessState({
    clerkLoaded,
    isSignedIn: signedIn,
    convexAuthLoading,
    gateState,
  });

  if (appAccessState === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-root)] text-[var(--text-secondary)]">
        <p className="text-sm tracking-wide">Loading workspace...</p>
      </div>
    );
  }

  if (appAccessState === "sign_in_required") {
    return <SignInRequired />;
  }

  if (appAccessState === "beta_gate") {
    return <BetaInviteGate />;
  }

  if (!gateState) return null;
  return <HypherApp gateState={gateState} />;
}
