import type { Metadata } from "next";
import Link from "next/link";
import { MarketingCta, MarketingFooter, MarketingHeader } from "@/components/marketing/MarketingChrome";
import { PricingCards } from "@/components/marketing/PricingCards";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Hypher pricing — free trial, monthly Pro, and a one-time lifetime license for the project context layer that briefs your agents.",
};

export default function PricingPage() {
  return (
    <div className="marketing-root">
      <MarketingHeader active="pricing" />

      <main className="marketing-section marketing-pricing">
        <div className="marketing-wrap">
          <p className="marketing-eyebrow">Pricing</p>
          <h1 className="marketing-page-title tw-text-balance">
            Fourteen days free, then stay monthly or buy once.
          </h1>
          <p className="marketing-section__lede tw-text-pretty">
            Pro raises your Builder Brief and agent-context limits for Cursor, Codex, OpenClaw, and
            MCP-connected tools. Hypher is in invite-only private beta — pricing below is what
            you&apos;ll pay once it opens.
          </p>
          <div className="marketing-hero__actions">
            <MarketingCta href="/beta/request">Request beta access</MarketingCta>
          </div>

          <div className="tw-mt-14">
            <PricingCards variant="expanded" />
          </div>
          <p className="marketing-footnote">
            <Link href="/" className="marketing-nav-link">
              ← Back to home
            </Link>
          </p>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
