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

        <section id="the-loop" className="marketing-section" aria-labelledby="loop-heading">
          <div className="marketing-wrap">
            <p className="marketing-eyebrow">How it works</p>
            <h2 id="loop-heading" className="tw-text-balance">
              Dump. One note. Writeback.
            </h2>
            <p className="marketing-section__lede tw-text-pretty">
              You dump the project as it actually is. Hypher compiles one Builder Brief. Agents
              read that note, then write back what they did.
            </p>

            <div className="marketing-loop">
              <article className="marketing-loop-card">
                <div className="marketing-loop-card__visual" aria-hidden>
                  <div className="loop-visual">
                    <div className="loop-visual__row">
                      <span>dump</span>
                      <span className="loop-visual__meta">just now</span>
                    </div>
                    <div className="loop-visual__card">
                      <p className="loop-visual__strong">shipped the gate</p>
                      <p>empty state still broken. don&apos;t widen oauth.</p>
                    </div>
                  </div>
                </div>
                <p className="marketing-loop-card__step">01</p>
                <h3>Dump</h3>
                <p>
                  Paste the mess. Notes, a file, the half-finished thread. No filing tax before
                  you think.
                </p>
              </article>

              <article className="marketing-loop-card">
                <div className="marketing-loop-card__visual" aria-hidden>
                  <div className="loop-visual">
                    <div className="loop-visual__row">
                      <span>Builder Brief</span>
                      <span className="loop-visual__meta">the note</span>
                    </div>
                    <div className="loop-visual__card loop-visual__card--mono">
                      <p className="loop-visual__strong">don&apos;t widen oauth.</p>
                      <p>one note. that&apos;s what they read.</p>
                    </div>
                  </div>
                </div>
                <p className="marketing-loop-card__step">02</p>
                <h3>The note</h3>
                <p>
                  One Builder Brief: direction, constraints, open questions. That&apos;s the packet
                  agents actually read.
                </p>
              </article>

              <article className="marketing-loop-card">
                <div className="marketing-loop-card__visual" aria-hidden>
                  <div className="loop-visual">
                    <div className="loop-visual__row">
                      <span>writeback</span>
                      <span className="loop-visual__meta">cursor</span>
                    </div>
                    <div className="loop-visual__card">
                      <p className="loop-visual__strong">gate is in</p>
                      <p>tokens hashed. events scoped.</p>
                    </div>
                  </div>
                </div>
                <p className="marketing-loop-card__step">03</p>
                <h3>Writeback</h3>
                <p>
                  They ship, then they write back. The next brief already knows what changed.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section
          id="agents"
          className="marketing-section marketing-section--alt"
          aria-labelledby="agents-heading"
        >
          <div className="marketing-wrap">
            <p className="marketing-eyebrow">For agents</p>
            <h2 id="agents-heading" className="tw-text-balance">
              Read and write project context.
            </h2>
            <p className="marketing-section__lede tw-text-pretty">
              Agents don&apos;t need the whole dump. They need one bounded note — then they report
              back.
            </p>
            <ul className="marketing-pills" aria-label="Works with">
              {["Cursor", "Codex", "OpenClaw", "ChatGPT", "MCP"].map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>
            <div className="marketing-bento">
              <article className="marketing-tile">
                <h3>Dump in</h3>
                <p>
                  Captures and agent events land in the project. You keep the source of truth.
                </p>
                <p className="marketing-tile__detail">capture · agent events · writeback</p>
              </article>
              <article className="marketing-tile marketing-tile--featured">
                <h3>Builder Brief out</h3>
                <p>
                  Copy the note, or fetch it. A bounded packet: direction, constraints, what
                  changed.
                </p>
                <p className="marketing-tile__detail">GET /api/projects/{"{id}"}/agent-context</p>
              </article>
            </div>
          </div>
        </section>

        <section id="beta" className="marketing-section" aria-labelledby="beta-heading">
          <div className="marketing-wrap">
            <p className="marketing-eyebrow">Beta</p>
            <h2 id="beta-heading" className="tw-text-balance">
              Built for people carrying too many threads.
            </h2>
            <p className="marketing-section__lede tw-text-pretty">
              Solo builders, indie hackers, and engineers juggling projects that don&apos;t fit
              in a task manager.
            </p>
            <p className="marketing-footnote">
              Hypher is invite-gated while we shape dump, the Builder Brief, and writeback with a
              small group. Expect rough edges and a product that gets calmer as it learns your
              patterns.
            </p>
          </div>
        </section>

        <section className="marketing-section marketing-section--cta" aria-labelledby="final-cta-heading">
          <div className="marketing-wrap">
            <div className="marketing-cta-panel">
              <h2 id="final-cta-heading" className="tw-text-balance">
                Dump yours.
              </h2>
              <div className="marketing-hero__actions marketing-hero__actions--center">
                <MarketingCta href="/app">dump yours</MarketingCta>
                <MarketingCta href="/beta/request" variant="ghost">
                  Request beta
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
