import Link from "next/link";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { MarketingBrand } from "@/components/marketing/MarketingBrand";
import { PricingCards } from "@/components/marketing/PricingCards";

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
            <SignUpButton mode="modal">
              <button
                type="button"
                className="tw-rounded-[var(--radius-sm)] tw-bg-electric tw-px-4 tw-py-2 tw-text-sm tw-font-medium tw-text-[var(--text-on-accent)] tw-shadow-sm tw-transition hover:tw-bg-electric-dim"
              >
                Sign up
              </button>
            </SignUpButton>
          </nav>
        </div>
      </header>

      <main className="tw-mx-auto tw-max-w-6xl tw-px-4 tw-pb-24 tw-pt-10 sm:tw-px-6 sm:tw-pt-12 lg:tw-px-8">
        <h1 className="tw-font-wordmark tw-text-3xl tw-font-normal tw-tracking-[0.04em] sm:tw-text-4xl">Pricing</h1>
        <p className="tw-mt-4 tw-max-w-2xl tw-text-pretty tw-text-lg tw-leading-relaxed tw-text-[var(--text-secondary)]">
          Fourteen days on the house, then choose monthly Pro or a one-time lifetime license. Pro unlocks larger
          Builder Briefs and agent-context packets for Cursor, Codex, OpenClaw, and MCP-connected tools.
        </p>
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
