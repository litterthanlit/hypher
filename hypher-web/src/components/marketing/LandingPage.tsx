import { MarketingCta, MarketingFooter, MarketingHeader } from "./MarketingChrome";
import { MarketingHeroStage } from "./MarketingHeroStage";
import {
  LANDING_CTA,
  LANDING_DOORS,
  LANDING_FAQ,
  LANDING_HANDOFF,
  LANDING_HERO,
  LANDING_LOOP,
  LANDING_SUPPORT,
  LANDING_TRUST,
  type SupportCell,
} from "./landingCopy";

const MODE_LABEL: Record<SupportCell["mode"], string> = {
  auto: "Automatic",
  manual: "You run it",
  human: "Human only",
  none: "Nothing to do",
  gap: "Not available yet",
};

function SupportMark({ cell }: { cell: SupportCell }) {
  return (
    <span className={`marketing-support__cell marketing-support__cell--${cell.mode}`}>
      <span className="marketing-support__glyph" aria-hidden />
      <span className="marketing-support__label">{cell.label}</span>
      <span className="sr-only"> — {MODE_LABEL[cell.mode]}</span>
    </span>
  );
}

function SectionIntro({
  id,
  eyebrow,
  heading,
  lede,
  centered = false,
}: {
  id: string;
  eyebrow: string;
  heading: string;
  lede?: string;
  centered?: boolean;
}) {
  return (
    <div className={`marketing-section__intro${centered ? " marketing-section__intro--center" : ""}`}>
      <p className="marketing-eyebrow">{eyebrow}</p>
      <h2 id={id} className="tw-text-balance">
        {heading}
      </h2>
      {lede ? <p className="marketing-section__lede tw-text-pretty">{lede}</p> : null}
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="marketing-root">
      <div className="marketing-atmosphere" aria-hidden />
      <MarketingHeader />

      <main>
        <section className="marketing-hero" aria-labelledby="hero-heading">
          <div className="marketing-wrap marketing-hero__copy">
            <p className="marketing-pill">
              <span className="marketing-pill__dot" aria-hidden />
              {LANDING_HERO.eyebrow}
            </p>
            <h1 id="hero-heading" className="tw-text-balance">
              {LANDING_HERO.headline}
            </h1>
            <p className="marketing-hero__lede tw-text-pretty">{LANDING_HERO.lede}</p>
            <div className="marketing-hero__actions">
              <MarketingCta href="/beta/request">{LANDING_HERO.primaryCta}</MarketingCta>
              <MarketingCta href="/app" variant="ghost">
                {LANDING_HERO.secondaryCta}
              </MarketingCta>
            </div>
            <p className="marketing-hero__hint tw-text-pretty">{LANDING_HERO.hint}</p>
          </div>
          <div className="marketing-wrap">
            <MarketingHeroStage />
            <p className="marketing-hero__caption">{LANDING_HERO.demoCaption}</p>
          </div>
        </section>

        <section id="support" className="marketing-section" aria-labelledby="support-heading">
          <div className="marketing-wrap">
            <SectionIntro
              id="support-heading"
              eyebrow={LANDING_SUPPORT.eyebrow}
              heading={LANDING_SUPPORT.heading}
              lede={LANDING_SUPPORT.lede}
            />
            <div className="marketing-support" role="region" aria-label="Support table" tabIndex={0}>
              <table>
                <caption className="sr-only">
                  Which handoff steps are automatic, manual, or human-only in each agent
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Step</th>
                    {LANDING_SUPPORT.columns.map((column) => (
                      <th key={column} scope="col">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {LANDING_SUPPORT.rows.map((row) => (
                    <tr key={row.step}>
                      <th scope="row">{row.step}</th>
                      {row.cells.map((cell, index) => (
                        <td key={LANDING_SUPPORT.columns[index]}>
                          <SupportMark cell={cell} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="marketing-footnote">{LANDING_SUPPORT.footnote}</p>
          </div>
        </section>

        <section id="the-loop" className="marketing-section" aria-labelledby="loop-heading">
          <div className="marketing-wrap">
            <SectionIntro
              id="loop-heading"
              eyebrow={LANDING_LOOP.eyebrow}
              heading={LANDING_LOOP.heading}
              lede={LANDING_LOOP.lede}
            />
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

        <section id="handoff" className="marketing-section" aria-labelledby="handoff-heading">
          <div className="marketing-wrap marketing-handoff">
            <SectionIntro
              id="handoff-heading"
              eyebrow={LANDING_HANDOFF.eyebrow}
              heading={LANDING_HANDOFF.heading}
              lede={LANDING_HANDOFF.lede}
            />
            <ol className="marketing-spec">
              {LANDING_HANDOFF.items.map((item, index) => (
                <li key={item.title} className="marketing-spec__item">
                  <span className="marketing-spec__index" aria-hidden>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="trust" className="marketing-section" aria-labelledby="trust-heading">
          <div className="marketing-wrap">
            <div className="marketing-trust">
              <SectionIntro
                id="trust-heading"
                eyebrow={LANDING_TRUST.eyebrow}
                heading={LANDING_TRUST.heading}
                lede={LANDING_TRUST.lede}
              />
              <div className="marketing-trust__cols">
                {[LANDING_TRUST.leaves, LANDING_TRUST.stays].map((column, index) => (
                  <div
                    key={column.title}
                    className={`marketing-trust__col${index === 1 ? " marketing-trust__col--stays" : ""}`}
                  >
                    <h3>{column.title}</h3>
                    <ul>
                      {column.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="doors" className="marketing-section" aria-labelledby="doors-heading">
          <div className="marketing-wrap">
            <SectionIntro
              id="doors-heading"
              eyebrow={LANDING_DOORS.eyebrow}
              heading={LANDING_DOORS.heading}
              lede={LANDING_DOORS.lede}
            />
            <div className="marketing-doors">
              {LANDING_DOORS.items.map((door) => (
                <article key={door.name} className="marketing-door">
                  <div className="marketing-door__head">
                    <h3>{door.name}</h3>
                    <span className={`marketing-status marketing-status--${door.tone}`}>{door.status}</span>
                  </div>
                  <p>{door.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="marketing-section" aria-labelledby="faq-heading">
          <div className="marketing-wrap marketing-faq-layout">
            <SectionIntro id="faq-heading" eyebrow={LANDING_FAQ.eyebrow} heading={LANDING_FAQ.heading} />
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

        <section id="pilot" className="marketing-section marketing-section--cta" aria-labelledby="final-cta-heading">
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
