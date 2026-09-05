import type { Metadata } from "next";
import Link from "next/link";
import { MarketingCta, MarketingFooter, MarketingHeader } from "@/components/marketing/MarketingChrome";
import { PricingCards } from "@/components/marketing/PricingCards";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Hypher pricing — free trial, monthly Pro, and a lifetime license for the context layer under your agents.",
};

export default function PricingPage() {
  return (
    <div className="marketing-root">
      <div className="marketing-atmosphere" aria-hidden />
      <MarketingHeader active="pricing" />

      <main className="marketing-section marketing-pricing marketing-section--center">
        <div className="marketing-wrap">
          <p className="marketing-eyebrow">Pricing</p>
          <h1 className="marketing-page-title tw-text-balance">
            Fourteen days free. Then monthly, or once.
          </h1>
          <p className="marketing-section__lede tw-text-pretty">
            Pro raises brief and agent-context limits for Cursor, Codex, and MCP-connected tools.
            Hypher is invite-only while the loop gets quieter — pricing below is what you&apos;ll
            pay when it opens.
          </p>
          <div className="marketing-hero__actions marketing-hero__actions--center">
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
