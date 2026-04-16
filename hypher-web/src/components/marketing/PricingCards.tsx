"use client";

import { useState } from "react";
import { SignUpButton } from "@clerk/nextjs";

type Variant = "compact" | "expanded";

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
        setLoading(null);
        return;
      }
      if (data.url) window.location.href = data.url;
    } catch {
      setLoading(null);
    }
  };

  const cardBase =
    "tw-flex tw-flex-col tw-rounded-2xl tw-border tw-border-black/[0.06] tw-bg-white tw-p-8 tw-shadow-[var(--shadow-card)]";
  const desc = variant === "expanded" ? "tw-mt-3 tw-text-[15px] tw-leading-relaxed tw-text-[var(--text-secondary)]" : "tw-mt-2 tw-text-sm tw-leading-relaxed tw-text-[var(--text-secondary)]";

  return (
    <div className="tw-grid tw-gap-6 md:tw-grid-cols-3">
      <div className={cardBase}>
        <p className="tw-font-mono tw-text-xs tw-uppercase tw-tracking-widest tw-text-electric">Trial</p>
        <h3 className="tw-mt-4 tw-font-sans tw-text-xl tw-font-medium tw-tracking-tight tw-text-[var(--text-primary)]">Free</h3>
        <p className="tw-mt-1 tw-text-sm tw-text-[var(--text-tertiary)]">14 days</p>
        {variant === "expanded" && (
          <p className={desc}>
            Full workspace access to try capture, canvas, and search. No card required to start exploring Hypher.
          </p>
        )}
        <ul className={`tw-mt-6 tw-space-y-2 tw-text-sm tw-text-[var(--text-secondary)] ${variant === "expanded" ? "tw-min-h-[120px]" : ""}`}>
          <li>• Capture &amp; canvas</li>
          <li>• Project graph</li>
          <li>• Daily digest</li>
        </ul>
        <div className="tw-mt-8">
          <SignUpButton mode="modal">
            <button
              type="button"
              className="tw-w-full tw-rounded-full tw-border tw-border-black/[0.08] tw-bg-[var(--bg-root)] tw-px-5 tw-py-2.5 tw-text-sm tw-font-medium tw-text-[var(--text-primary)] tw-transition hover:tw-border-electric hover:tw-text-electric"
            >
              Start free
            </button>
          </SignUpButton>
        </div>
      </div>

      <div className={`${cardBase} tw-ring-1 tw-ring-electric/20`}>
        <p className="tw-font-mono tw-text-xs tw-uppercase tw-tracking-widest tw-text-electric">Pro</p>
        <h3 className="tw-mt-4 tw-font-sans tw-text-xl tw-font-medium tw-tracking-tight tw-text-[var(--text-primary)]">$10<span className="tw-text-base tw-font-normal tw-text-[var(--text-tertiary)]">/mo</span></h3>
        <p className="tw-mt-1 tw-text-sm tw-text-[var(--text-tertiary)]">Billed monthly</p>
        {variant === "expanded" && (
          <p className={desc}>
            For builders shipping every week: keep GitHub context, API capture, and AI digest in one calm surface.
          </p>
        )}
        <ul className={`tw-mt-6 tw-space-y-2 tw-text-sm tw-text-[var(--text-secondary)] ${variant === "expanded" ? "tw-min-h-[120px]" : ""}`}>
          <li>• Everything in Free</li>
          <li>• API capture &amp; integrations</li>
          <li>• Priority roadmap input</li>
        </ul>
        <div className="tw-mt-8 tw-space-y-2">
          <button
            type="button"
            disabled={loading !== null}
            onClick={() => void startCheckout("pro_monthly")}
            className="tw-w-full tw-rounded-full tw-bg-electric tw-px-5 tw-py-2.5 tw-text-sm tw-font-medium tw-text-white tw-shadow-sm tw-transition hover:tw-bg-electric-dim disabled:tw-opacity-60"
          >
            {loading === "pro" ? "Redirecting…" : "Subscribe"}
          </button>
          <p className="tw-text-center tw-text-xs tw-text-[var(--text-tertiary)]">Stripe Checkout</p>
        </div>
      </div>

      <div className={cardBase}>
        <p className="tw-font-mono tw-text-xs tw-uppercase tw-tracking-widest tw-text-electric">Lifetime</p>
        <h3 className="tw-mt-4 tw-font-sans tw-text-xl tw-font-medium tw-tracking-tight tw-text-[var(--text-primary)]">$150</h3>
        <p className="tw-mt-1 tw-text-sm tw-text-[var(--text-tertiary)]">Pay once</p>
        {variant === "expanded" && (
          <p className={desc}>
            Lock in Hypher for your solo stack. Best if you already know this is your home base for ideas and shipping.
          </p>
        )}
        <ul className={`tw-mt-6 tw-space-y-2 tw-text-sm tw-text-[var(--text-secondary)] ${variant === "expanded" ? "tw-min-h-[120px]" : ""}`}>
          <li>• All Pro features</li>
          <li>• No recurring fees</li>
          <li>• Early supporter pricing</li>
        </ul>
        <div className="tw-mt-8 tw-space-y-2">
          <button
            type="button"
            disabled={loading !== null}
            onClick={() => void startCheckout("lifetime")}
            className="tw-w-full tw-rounded-full tw-border tw-border-electric tw-bg-white tw-px-5 tw-py-2.5 tw-text-sm tw-font-medium tw-text-electric tw-transition hover:tw-bg-electric/5 disabled:tw-opacity-60"
          >
            {loading === "lifetime" ? "Redirecting…" : "Buy lifetime"}
          </button>
          <p className="tw-text-center tw-text-xs tw-text-[var(--text-tertiary)]">Stripe Checkout</p>
        </div>
      </div>
    </div>
  );
}
