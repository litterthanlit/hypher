"use client";

import { useCallback, useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { UserButton } from "@clerk/nextjs";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import { MarketingBrand } from "@/components/marketing/MarketingBrand";
import { normalizeInviteCode } from "@/lib/beta";

export function BetaInviteGate() {
  const redeemInvite = useMutation((api as any).beta.redeemInviteCode);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invite = params.get("invite");
    if (invite) setCode(normalizeInviteCode(invite));
  }, []);

  const handleRedeem = useCallback(async () => {
    const normalized = normalizeInviteCode(code);
    if (!normalized) {
      toast.error("Paste your invite code first.");
      return;
    }
    setBusy(true);
    try {
      const result = await redeemInvite({ code: normalized });
      if (result.ok) {
        toast.success(result.alreadyHadAccess ? "You already have beta access." : "Welcome to the beta.");
        const params = new URLSearchParams(window.location.search);
        params.delete("invite");
        window.history.replaceState({}, "", params.toString() ? `/app?${params}` : "/app");
      } else {
        const message =
          result.error === "expired"
            ? "That invite has expired."
            : result.error === "revoked"
              ? "That invite was revoked."
              : result.error === "exhausted"
                ? "That invite has already been used."
                : "That invite code does not look right.";
        toast.error(message);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not redeem invite.");
    } finally {
      setBusy(false);
    }
  }, [code, redeemInvite]);

  return (
    <div className="marketing-root beta-gate-root">
      <div className="marketing-atmosphere" aria-hidden />
      <div className="beta-gate-card">
        <div className="beta-gate-top">
          <MarketingBrand />
          <UserButton />
        </div>
        <p className="launch-eyebrow">Private beta</p>
        <h1>Your workspace is waiting.</h1>
        <p>
          Hypher is opening carefully while the loop gets quieter. Enter your invite code to continue.
        </p>
        <div className="beta-gate-form">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleRedeem();
            }}
            placeholder="HYP-XXXX-XXXX-XXXX-XXXX"
            autoCapitalize="characters"
            autoComplete="off"
            className="settings-github-input"
          />
          <button
            type="button"
            className="settings-github-connect"
            onClick={() => void handleRedeem()}
            disabled={busy}
          >
            {busy ? "Checking..." : "Enter beta"}
          </button>
        </div>
        <p className="beta-gate-note">
          No code yet? Ask Nick for access. We are keeping the room small on purpose.
        </p>
      </div>
    </div>
  );
}
