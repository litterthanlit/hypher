import { MarketingCta, MarketingFooter, MarketingHeader } from "./MarketingChrome";
import { MarketingHeroStage } from "./MarketingHeroStage";

export function LandingPage() {
  return (
    <div className="marketing-root">
      <MarketingHeader />

      <main>
        <section className="marketing-hero">
          <div className="marketing-wrap">
            <p className="marketing-eyebrow">hypher</p>
            <div className="marketing-hero__grid">
              <div className="marketing-hero__copy">
                <h1 className="tw-text-balance">
                  dump your project. they read one note. they write back.
                </h1>
                <div className="marketing-hero__actions">
                  <MarketingCta href="/app">dump yours</MarketingCta>
                  <MarketingCta href="/beta/request" variant="ghost">
                    Request beta
                  </MarketingCta>
                </div>
              </div>
              <p className="marketing-hero__lede tw-text-pretty">that&apos;s the product.</p>
            </div>
            <MarketingHeroStage />
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
