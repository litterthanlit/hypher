import type { Metadata } from "next";
import Link from "next/link";
import { SignInButton } from "@clerk/nextjs";
import { MarketingBrand } from "@/components/marketing/MarketingBrand";
import { PricingCards } from "@/components/marketing/PricingCards";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Hypher pricing — free trial, monthly Pro, and a one-time lifetime license for the project context layer that briefs your agents.",
};

const navBtnClass =
  "tw-text-sm tw-text-[var(--text-secondary)] tw-transition hover:tw-text-[var(--text-primary)]";

export default function PricingPage() {
  return (
    <div className="marketing-root tw-min-h-screen tw-text-[var(--text-primary)]">
      <header className="tw-sticky tw-top-0 tw-z-50 tw-border-b tw-border-[var(--border-default)] tw-bg-[var(--bg-primary)]/90 tw-backdrop-blur-md">
        <div className="tw-mx-auto tw-flex tw-max-w-6xl tw-items-center tw-justify-between tw-gap-4 tw-px-4 tw-py-3 sm:tw-px-6 lg:tw-px-8">
          <MarketingBrand />
          <nav className="tw-flex tw-items-center tw-gap-5 sm:tw-gap-6">
            <Link href="/" className={navBtnClass}>
              Home
            </Link>
            <SignInButton mode="modal">
              <button type="button" className={navBtnClass}>
                Sign in
              </button>
            </SignInButton>
            <Link
              href="/beta/request"
              className="tw-rounded-[var(--radius-sm)] tw-bg-electric tw-px-4 tw-py-2 tw-text-sm tw-font-medium tw-text-[var(--text-on-accent)] tw-no-underline tw-shadow-sm tw-transition hover:tw-bg-electric-dim hover:tw-no-underline"
            >
              Request beta access
            </Link>
          </nav>
        </div>
      </header>

      <main className="tw-mx-auto tw-max-w-6xl tw-px-4 tw-pb-24 tw-pt-10 sm:tw-px-6 sm:tw-pt-12 lg:tw-px-8">
        <h1 className="tw-font-wordmark tw-text-3xl tw-font-normal tw-tracking-[0.04em] sm:tw-text-4xl">Pricing</h1>
        <p className="tw-mt-4 tw-max-w-2xl tw-text-pretty tw-text-lg tw-leading-relaxed tw-text-[var(--text-secondary)]">
          Fourteen days free, then monthly Pro or a one-time lifetime license. Pro raises your Builder Brief and
          agent-context limits for Cursor, Codex, OpenClaw, and MCP-connected tools.
        </p>

        <div className="tw-mt-6 tw-flex tw-max-w-2xl tw-flex-col tw-gap-3 tw-rounded-[var(--radius-md)] tw-border tw-border-[var(--border-default)] tw-bg-[var(--bg-secondary)] tw-p-4 sm:tw-flex-row sm:tw-items-center sm:tw-justify-between">
          <p className="tw-text-sm tw-leading-relaxed tw-text-[var(--text-tertiary)]">
            Hypher is in invite-only private beta. Pricing below is what you&apos;ll pay once it opens — for now the beta is free.
          </p>
          <Link
            href="/beta/request"
            className="tw-shrink-0 tw-rounded-[var(--radius-sm)] tw-border tw-border-[var(--border-default)] tw-bg-[var(--bg-primary)] tw-px-4 tw-py-2 tw-text-center tw-text-sm tw-font-medium tw-text-[var(--text-primary)] tw-no-underline tw-transition hover:tw-border-[var(--border-hover)] hover:tw-no-underline"
          >
            Request beta access
          </Link>
        </div>

        <div className="tw-mt-14">
          <PricingCards variant="expanded" />
        </div>
        <p className="tw-mt-12 tw-text-sm tw-text-[var(--text-tertiary)]">
          <Link href="/" className="tw-text-[var(--text-secondary)] tw-transition hover:tw-text-[var(--text-primary)]">
            ← Back to home
          </Link>
        </p>
      </main>
    </div>
  );
}
