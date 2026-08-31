import type { Metadata } from "next";
import Link from "next/link";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
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
      <MarketingHeader
        nav={
          <>
            <Link href="/" className={navBtnClass}>
              Home
            </Link>
            <Link href="/sign-in" className={navBtnClass}>
              Sign in
            </Link>
          </>
        }
        end={
          <Link href="/beta/request" className="marketing-cta">
            Request beta access
          </Link>
        }
      />

      <main className="tw-mx-auto tw-max-w-6xl tw-px-4 tw-pb-24 tw-pt-10 sm:tw-px-6 sm:tw-pt-12 lg:tw-px-8">
        <h1 className="tw-font-wordmark tw-text-3xl tw-font-normal tw-tracking-[0.04em] sm:tw-text-4xl">Pricing</h1>
        <p className="tw-mt-4 tw-max-w-2xl tw-text-pretty tw-text-lg tw-leading-relaxed tw-text-[var(--text-secondary)]">
          Fourteen days free, then monthly Pro or a one-time lifetime license. Pro raises your Builder Brief and
          agent-context limits for Cursor, Codex, OpenClaw, and MCP-connected tools.
        </p>

        <div className="marketing-surface-card tw-mt-6 tw-flex tw-max-w-2xl tw-flex-col tw-gap-3 tw-rounded-2xl tw-p-4 sm:tw-flex-row sm:tw-items-center sm:tw-justify-between">
          <p className="tw-text-sm tw-leading-relaxed tw-text-[var(--text-tertiary)]">
            Hypher is in invite-only private beta. Pricing below is what you&apos;ll pay once it opens — for now the beta is free.
          </p>
          <Link href="/beta/request" className="marketing-cta marketing-cta--ghost tw-shrink-0">
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
