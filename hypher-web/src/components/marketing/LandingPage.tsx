import { MarketingCta, MarketingFooter, MarketingHeader } from "./MarketingChrome";
import { MarketingHeroStage } from "./MarketingHeroStage";
import {
  LANDING_CTA,
  LANDING_CURSOR,
  LANDING_FAQ,
  LANDING_HERO,
  LANDING_LOOP,
} from "./landingCopy";

export function LandingPage() {
  return (
    <div className="marketing-root">
      <div className="marketing-atmosphere" aria-hidden />
      <MarketingHeader />

      <main>
        <section className="marketing-hero">
          <div className="marketing-wrap marketing-hero__copy">
            <h1 className="tw-text-balance">{LANDING_HERO.headline}</h1>
            <p className="marketing-hero__lede tw-text-pretty">{LANDING_HERO.lede}</p>
            <div className="marketing-hero__actions">
              <MarketingCta href="/beta/request">{LANDING_HERO.primaryCta}</MarketingCta>
              <MarketingCta href="/app" variant="ghost">
                {LANDING_HERO.secondaryCta}
              </MarketingCta>
            </div>
            <p className="marketing-hero__hint">{LANDING_HERO.hint}</p>
          </div>
          <div className="marketing-wrap">
            <MarketingHeroStage />
            <p className="marketing-hero__caption">{LANDING_HERO.demoCaption}</p>
          </div>
        </section>

        <section id="the-loop" className="marketing-section" aria-labelledby="loop-heading">
          <div className="marketing-wrap">
            <div className="marketing-section__intro">
              <p className="marketing-eyebrow">{LANDING_LOOP.eyebrow}</p>
              <h2 id="loop-heading" className="tw-text-balance">
                {LANDING_LOOP.heading}
              </h2>
              <p className="marketing-section__lede tw-text-pretty">{LANDING_LOOP.lede}</p>
            </div>

            <div className="marketing-loop">
              {LANDING_LOOP.beats.map((beat) => (
                <article key={beat.step} className="marketing-loop-card">
                  <p className="marketing-loop-card__step">{beat.step}</p>
                  <h3>{beat.title}</h3>
                  <p>{beat.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="cursor" className="marketing-section" aria-labelledby="cursor-heading">
          <div className="marketing-wrap marketing-cursor">
            <p className="marketing-eyebrow">{LANDING_CURSOR.eyebrow}</p>
            <h2 id="cursor-heading" className="tw-text-balance">
              {LANDING_CURSOR.heading}
            </h2>
            <p className="marketing-section__lede tw-text-pretty">{LANDING_CURSOR.lede}</p>
          </div>
        </section>

        <section id="faq" className="marketing-section" aria-labelledby="faq-heading">
          <div className="marketing-wrap marketing-faq-layout">
            <div className="marketing-section__intro">
              <p className="marketing-eyebrow">{LANDING_FAQ.eyebrow}</p>
              <h2 id="faq-heading" className="tw-text-balance">
                {LANDING_FAQ.heading}
              </h2>
            </div>
            <div className="marketing-faq">
              {LANDING_FAQ.items.map((item) => (
                <details key={item.q} className="marketing-faq__item">
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section id="beta" className="marketing-section marketing-section--cta" aria-labelledby="final-cta-heading">
          <div className="marketing-wrap">
            <div className="marketing-cta-panel">
              <p className="marketing-eyebrow">{LANDING_CTA.eyebrow}</p>
              <h2 id="final-cta-heading" className="tw-text-balance">
                {LANDING_CTA.heading}
              </h2>
              <p className="marketing-section__lede tw-text-pretty">{LANDING_CTA.lede}</p>
              <div className="marketing-hero__actions">
                <MarketingCta href="/beta/request">{LANDING_HERO.primaryCta}</MarketingCta>
                <MarketingCta href="/app" variant="ghost">
                  {LANDING_HERO.secondaryCta}
                </MarketingCta>
              </div>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
