"use client";

type MarketingSiteProps = {
  onGetStarted: () => void;
  onOpenWorkspace: () => void;
};

const featureCards = [
  {
    title: "Unified command center",
    body: "Capture ideas, artifacts, and decisions in one timeline so context is never scattered.",
    tag: "Focus",
  },
  {
    title: "Visual project memory",
    body: "Move from canvas to list instantly while relationships between notes stay visible.",
    tag: "Map",
  },
  {
    title: "Daily clarity loop",
    body: "Digest highlights surface what matters today and what deserves follow-up next.",
    tag: "Rhythm",
  },
];

const workflow = [
  "Capture a thought in seconds",
  "Auto-group into active projects",
  "Review with search and daily digest",
];

export function MarketingSite({ onGetStarted, onOpenWorkspace }: MarketingSiteProps) {
  return (
    <main className="marketing-root">
      <div className="marketing-grid" />
      <header className="marketing-nav">
        <div className="marketing-brand">
          <span className="marketing-brand-dot" />
          Hypher
        </div>
        <div className="marketing-nav-actions">
          <button className="marketing-link" onClick={onOpenWorkspace}>
            Open app
          </button>
          <button className="marketing-cta" onClick={onGetStarted}>
            Start capturing
          </button>
        </div>
      </header>

      <section className="marketing-hero">
        <p className="marketing-pill">Built for high-context teams</p>
        <h1 className="marketing-title">The project workspace that thinks in context.</h1>
        <p className="marketing-subtitle">
          A Linear-inspired interface for turning raw notes into connected, actionable work across your
          projects.
        </p>
        <div className="marketing-hero-actions">
          <button className="marketing-cta" onClick={onGetStarted}>
            Start capturing
          </button>
          <button className="marketing-link marketing-link-hero" onClick={onOpenWorkspace}>
            Jump to workspace
          </button>
        </div>
      </section>

      <section className="marketing-preview">
        <div className="marketing-preview-top">
          <span>Overview</span>
          <span>Today</span>
        </div>
        <div className="marketing-preview-body">
          <aside className="marketing-preview-sidebar">
            <div className="marketing-preview-item active">Inbox</div>
            <div className="marketing-preview-item">Projects</div>
            <div className="marketing-preview-item">Digest</div>
          </aside>
          <div className="marketing-preview-content">
            <div className="marketing-preview-card">
              <p className="marketing-preview-label">Priority</p>
              <p className="marketing-preview-text">Ship onboarding polish for project dashboard</p>
            </div>
            <div className="marketing-preview-card muted">
              <p className="marketing-preview-label">New capture</p>
              <p className="marketing-preview-text">"Link support thread insights to current roadmap doc"</p>
            </div>
          </div>
        </div>
      </section>

      <section className="marketing-features">
        {featureCards.map((feature) => (
          <article key={feature.title} className="marketing-feature-card">
            <span className="marketing-feature-tag">{feature.tag}</span>
            <h3>{feature.title}</h3>
            <p>{feature.body}</p>
          </article>
        ))}
      </section>

      <section className="marketing-workflow">
        <p className="marketing-workflow-title">How teams use Hypher</p>
        <ol>
          {workflow.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
    </main>
  );
}
