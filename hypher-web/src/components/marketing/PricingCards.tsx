"use client";

import { useState } from "react";
import Link from "next/link";
import { SignUpButton } from "@clerk/nextjs";
import { toast } from "sonner";

type Variant = "compact" | "expanded";

// Hypher is in invite-only private beta. While true, the pricing page is
// informational only: paid checkout is disabled so nobody can pay and then
// hit the invite gate at /app. Flip to false when self-serve billing opens.
const BETA_INVITE_ONLY = true;

export function PricingCards({ variant }: { variant: Variant }) {
  const [loading, setLoading] = useState<"pro" | "lifetime" | null>(null);

  const startCheckout = async (plan: "pro_monthly" | "lifetime") => {
    setLoading(plan === "pro_monthly" ? "pro" : "lifetime");
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error(data);
        const msg =
          typeof data?.error === "string"
            ? data.error
            : res.status === 401
              ? "Sign in to continue to checkout."
              : "Checkout could not start. Try again or check billing settings.";
        toast.error(msg);
        setLoading(null);
        return;
      }
      if (data.url) window.location.href = data.url;
    } catch {
      setLoading(null);
    }
  };

  const cardBase =
    "marketing-surface-card tw-flex tw-flex-col tw-rounded-2xl tw-p-8";
  const desc = variant === "expanded" ? "tw-mt-3 tw-text-[15px] tw-leading-relaxed tw-text-[var(--text-secondary)]" : "tw-mt-2 tw-text-sm tw-leading-relaxed tw-text-[var(--text-secondary)]";
  const listClass = `tw-mt-6 tw-space-y-2 tw-text-sm tw-text-[var(--text-secondary)] ${variant === "expanded" ? "tw-min-h-[120px]" : ""}`;
  const lockedBtn =
    "tw-w-full tw-rounded-full tw-border tw-border-[var(--border-default)] tw-bg-[var(--bg-root)] tw-px-5 tw-py-2.5 tw-text-sm tw-font-medium tw-text-[var(--text-tertiary)] tw-cursor-default";

  return (
    <div className="tw-grid tw-gap-6 md:tw-grid-cols-3">
      <div className={cardBase}>
        <p className="tw-font-mono tw-text-xs tw-uppercase tw-tracking-widest tw-text-electric">Trial</p>
        <h3 className="tw-mt-4 tw-font-sans tw-text-xl tw-font-medium tw-tracking-tight tw-text-[var(--text-primary)]">Free</h3>
        <p className="tw-mt-1 tw-text-sm tw-text-[var(--text-tertiary)]">14 days</p>
        {variant === "expanded" && (
          <p className={desc}>
            Full access while you trial Hypher: capture, project memory, and Builder Briefs for your agents. No card to start.
          </p>
        )}
        <ul className={listClass}>
          <li>• Capture &amp; project memory</li>
          <li>• Builder Briefs for agents</li>
          <li>• Agent writeback inbox</li>
        </ul>
        <div className="tw-mt-8">
          {BETA_INVITE_ONLY ? (
            <Link
              href="/beta/request"
              className="tw-block tw-w-full tw-rounded-full tw-bg-electric tw-px-5 tw-py-2.5 tw-text-center tw-text-sm tw-font-medium tw-text-[var(--text-on-accent)] tw-no-underline tw-shadow-sm tw-transition hover:tw-bg-electric-dim hover:tw-no-underline"
            >
              Request beta access
            </Link>
          ) : (
            <SignUpButton mode="modal">
              <button
                type="button"
                className="tw-w-full tw-rounded-full tw-border tw-border-black/[0.08] tw-bg-[var(--bg-root)] tw-px-5 tw-py-2.5 tw-text-sm tw-font-medium tw-text-[var(--text-primary)] tw-transition hover:tw-border-electric hover:tw-text-electric"
              >
                Start free
              </button>
            </SignUpButton>
          )}
        </div>
      </div>

      <div className={`${cardBase} tw-ring-1 tw-ring-electric/20`}>
        <p className="tw-font-mono tw-text-xs tw-uppercase tw-tracking-widest tw-text-electric">Pro</p>
        <h3 className="tw-mt-4 tw-font-sans tw-text-xl tw-font-medium tw-tracking-tight tw-text-[var(--text-primary)]">$10<span className="tw-text-base tw-font-normal tw-text-[var(--text-tertiary)]">/mo</span></h3>
        <p className="tw-mt-1 tw-text-sm tw-text-[var(--text-tertiary)]">Billed monthly</p>
        {variant === "expanded" && (
          <p className={desc}>
            For builders shipping every week: larger Builder Briefs, agent-context packets, and GitHub context in one calm surface.
          </p>
        )}
        <ul className={listClass}>
          <li>• Everything in Free</li>
          <li>• Larger Builder Briefs &amp; agent context</li>
          <li>• API capture, MCP &amp; GitHub context</li>
        </ul>
        <div className="tw-mt-8 tw-space-y-2">
          {BETA_INVITE_ONLY ? (
            <>
              <button type="button" disabled className={lockedBtn}>
                Opens after beta
              </button>
              <p className="tw-text-center tw-text-xs tw-text-[var(--text-tertiary)]">Free while in private beta</p>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={loading !== null}
                onClick={() => void startCheckout("pro_monthly")}
                className="tw-w-full tw-rounded-full tw-bg-electric tw-px-5 tw-py-2.5 tw-text-sm tw-font-medium tw-text-[var(--text-on-accent)] tw-shadow-sm tw-transition hover:tw-bg-electric-dim disabled:tw-opacity-60"
              >
                {loading === "pro" ? "Redirecting…" : "Subscribe"}
              </button>
              <p className="tw-text-center tw-text-xs tw-text-[var(--text-tertiary)]">Stripe Checkout</p>
            </>
          )}
        </div>
      </div>

      <div className={cardBase}>
        <p className="tw-font-mono tw-text-xs tw-uppercase tw-tracking-widest tw-text-electric">Lifetime</p>
        <h3 className="tw-mt-4 tw-font-sans tw-text-xl tw-font-medium tw-tracking-tight tw-text-[var(--text-primary)]">$150</h3>
        <p className="tw-mt-1 tw-text-sm tw-text-[var(--text-tertiary)]">Pay once</p>
        {variant === "expanded" && (
          <p className={desc}>
            Lock in Hypher as the context layer for your solo stack. One payment, every Pro capability, no recurring fees.
          </p>
        )}
        <ul className={listClass}>
          <li>• All Pro features</li>
          <li>• No recurring fees</li>
          <li>• Early supporter pricing</li>
        </ul>
        <div className="tw-mt-8 tw-space-y-2">
          {BETA_INVITE_ONLY ? (
            <>
              <button type="button" disabled className={lockedBtn}>
                Opens after beta
              </button>
              <p className="tw-text-center tw-text-xs tw-text-[var(--text-tertiary)]">Early supporter pricing at launch</p>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={loading !== null}
                onClick={() => void startCheckout("lifetime")}
                className="tw-w-full tw-rounded-full tw-border tw-border-electric tw-bg-white tw-px-5 tw-py-2.5 tw-text-sm tw-font-medium tw-text-electric tw-transition hover:tw-bg-electric/5 disabled:tw-opacity-60"
              >
                {loading === "lifetime" ? "Redirecting…" : "Buy lifetime"}
              </button>
              <p className="tw-text-center tw-text-xs tw-text-[var(--text-tertiary)]">Stripe Checkout</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
