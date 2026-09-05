import { MarketingCta, MarketingFooter, MarketingHeader } from "./MarketingChrome";
import { MarketingHeroStage } from "./MarketingHeroStage";

const FAQS = [
  {
    q: "What is Hypher?",
    a: "Project memory under your agents. Cursor already has the code. Hypher holds the decisions that never made it in, so the next session starts warm.",
  },
  {
    q: "Do you ingest my repository?",
    a: "No. GitHub is a signal — CI, stale PRs, labeled blockers. The valuable context is exactly what is not in git.",
  },
  {
    q: "What do agents actually read?",
    a: "One Builder Brief. Direction, decisions, do-not-do, open questions, next move. Bounded. Not a wiki, not a chat log.",
  },
  {
    q: "Why not a README?",
    a: "READMEs do not catch “don’t widen OAuth” from a rant at 1am, or the handoff the last agent forgot to write. Hypher compiles that into the note they read once.",
  },
  {
    q: "Is this a notes app?",
    a: "No. Home is one field. Pulse is three things: latest context, the brief, what wrote back. Synthesis happens when you give it something — not behind a Generate button.",
  },
] as const;

export function LandingPage() {
  return (
    <div className="marketing-root">
      <div className="marketing-atmosphere" aria-hidden />
      <MarketingHeader />

      <main>
        <section className="marketing-hero">
          <div className="marketing-wrap marketing-hero__inner">
            <p className="marketing-eyebrow">Introducing Hypher</p>
            <h1 className="tw-text-balance">The context they never find in git.</h1>
            <p className="marketing-hero__lede tw-text-pretty">
              Cursor already has the code. Hypher keeps the decisions, the don&apos;ts, and the next
              move — so session two starts warm.
            </p>
            <div className="marketing-hero__actions marketing-hero__actions--center">
              <MarketingCta href="/app">Open Hypher</MarketingCta>
              <MarketingCta href="/beta/request" variant="ghost">
                Request beta
              </MarketingCta>
            </div>
            <p className="marketing-hero__hint">Private beta. Invite-gated while the loop gets quieter.</p>
            <MarketingHeroStage />
          </div>
        </section>

        <section id="the-loop" className="marketing-section marketing-section--center" aria-labelledby="loop-heading">
          <div className="marketing-wrap">
            <p className="marketing-eyebrow">How it works</p>
            <h2 id="loop-heading" className="tw-text-balance">
              Give them context. They read one note. They write back.
            </h2>
            <p className="marketing-section__lede tw-text-pretty">
              Stop re-explaining the project every session. Hypher is the packet underneath the
              agents — not another place to write code.
            </p>

            <div className="marketing-loop">
              <article className="marketing-loop-card">
                <p className="marketing-loop-card__step">01</p>
                <h3>Context in</h3>
                <p>
                  Paste the mess. Rants, screenshots, chat exports, “don&apos;t widen OAuth.” No
                  filing tax. Messy is the correct input.
                </p>
              </article>

              <article className="marketing-loop-card">
                <p className="marketing-loop-card__step">02</p>
                <h3>One brief</h3>
                <p>
                  Hypher compiles a bounded Builder Brief: direction, decisions, do-not-do, next
                  move. That is the note they read once at session start.
                </p>
              </article>

              <article className="marketing-loop-card">
                <p className="marketing-loop-card__step">03</p>
                <h3>Writeback</h3>
                <p>
                  When they stop, they post what changed. Receipts thicken memory. The next chat
                  already knows.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section id="stack" className="marketing-section marketing-section--center" aria-labelledby="stack-heading">
          <div className="marketing-wrap">
            <p className="marketing-eyebrow">On your stack</p>
            <h2 id="stack-heading" className="tw-text-balance">
              Sits on Cursor. The repo stays untouched.
            </h2>
            <p className="marketing-section__lede tw-text-pretty">
              Nothing is rearchitected. Your agents keep their tools. Hypher is the memory
              underneath — the context that never landed in the files.
            </p>
            <ul className="marketing-pills" aria-label="Works with">
              {["Cursor", "Codex", "Claude", "MCP", "Anything that can read a note"].map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>
            <div className="marketing-bento">
              <article className="marketing-tile">
                <h3>Any notes, coherent context</h3>
                <p>
                  One-liners, files, build logs, “don&apos;t rebuild the canvas.” Synthesis is
                  silent, after you give it something or an agent writes back.
                </p>
              </article>
              <article className="marketing-tile marketing-tile--featured">
                <h3>The brief they actually read</h3>
                <p>
                  Copy it, or fetch it. A bounded packet — not a firehose, not a Generate button.
                </p>
                <p className="marketing-tile__detail">GET /api/projects/{"{id}"}/agent-context</p>
              </article>
            </div>
          </div>
        </section>

        <section id="faq" className="marketing-section marketing-section--center" aria-labelledby="faq-heading">
          <div className="marketing-wrap">
            <p className="marketing-eyebrow">FAQ</p>
            <h2 id="faq-heading" className="tw-text-balance">
              The product is the loop.
            </h2>
            <div className="marketing-faq">
              {FAQS.map((item) => (
                <details key={item.q} className="marketing-faq__item">
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section id="beta" className="marketing-section marketing-section--cta marketing-section--center" aria-labelledby="final-cta-heading">
          <div className="marketing-wrap">
            <div className="marketing-cta-panel">
              <p className="marketing-eyebrow">Private beta</p>
              <h2 id="final-cta-heading" className="tw-text-balance">
                Stop re-explaining the project every session.
              </h2>
              <p className="marketing-section__lede tw-text-pretty">
                Built for people drowning in agent sessions. Invite-gated while the loop gets
                quieter.
              </p>
              <div className="marketing-hero__actions marketing-hero__actions--center">
                <MarketingCta href="/app">Open Hypher</MarketingCta>
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
