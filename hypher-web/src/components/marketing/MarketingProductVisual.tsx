"use client";

/**
 * Static, interface-forward hero visual — reads like the product, not decoration.
 */

function GridBackdrop() {
  return (
    <div
      className="tw-pointer-events-none tw-absolute tw-inset-0 tw-opacity-[0.45] dark:tw-opacity-[0.35]"
      aria-hidden
    >
      <div
        className="tw-absolute tw-inset-0"
        style={{
          backgroundImage: `
            linear-gradient(to right, var(--border-default) 1px, transparent 1px),
            linear-gradient(to bottom, var(--border-default) 1px, transparent 1px)
          `,
          backgroundSize: "24px 24px",
          maskImage: "linear-gradient(to bottom, black 0%, black 55%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 55%, transparent 100%)",
        }}
      />
    </div>
  );
}

function FlowConnector() {
  return (
    <div className="tw-flex tw-justify-center tw-py-1" aria-hidden>
      <svg width="2" height="28" className="tw-text-[var(--border-hover)]" viewBox="0 0 2 28">
        <path d="M1 0 V28" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

export function MarketingProductVisual() {
  return (
    <div
      className="marketing-product-visual tw-relative tw-overflow-hidden tw-rounded-[var(--radius-md)] tw-border tw-bg-[var(--bg-primary)]"
      aria-label="Product preview: capture flows into project memory, Builder Briefs, and agent writeback"
    >
      <GridBackdrop />

      <div className="tw-relative tw-z-[1] tw-p-4 sm:tw-p-6">
        {/* Capture */}
        <div className="tw-rounded-[var(--radius-sm)] tw-border tw-border-[var(--capture-blue-border)] tw-bg-gradient-to-b tw-from-white tw-to-[var(--capture-blue-soft)] tw-px-3 tw-py-2.5 tw-shadow-[var(--shadow-marketing-inset)] sm:tw-px-4">
          <div className="tw-flex tw-items-center tw-gap-2 tw-font-mono tw-text-[10px] tw-uppercase tw-tracking-wider tw-text-[var(--text-tertiary)]">
            <span
              className="tw-h-1.5 tw-w-1.5 tw-shrink-0 tw-rounded-full tw-bg-[var(--capture-blue)]"
              aria-hidden
            />
            Capture
          </div>
          <p className="tw-mt-2 tw-text-left tw-text-[13px] tw-leading-snug tw-text-[var(--text-primary)] sm:tw-text-sm">
            <span className="tw-text-[var(--text-secondary)]">Today · </span>
            RFC for brief tone + export edge case for long notes…
          </p>
        </div>

        <FlowConnector />

        {/* Suggestions */}
        <div>
          <p className="tw-mb-2 tw-font-mono tw-text-[10px] tw-uppercase tw-tracking-wider tw-text-[var(--text-tertiary)]">
            Suggested projects
          </p>
          <div className="tw-flex tw-flex-wrap tw-gap-2">
            <div className="tw-rounded-[var(--radius-sm)] tw-border tw-border-[var(--accent)] tw-bg-[var(--accent-subtle)] tw-px-3 tw-py-1.5 tw-text-left tw-text-xs tw-font-medium tw-text-[var(--text-primary)] tw-shadow-[var(--shadow-marketing-inset)]">
              <span className="tw-text-[var(--accent)]">Essays</span>
              <span className="tw-ml-2 tw-font-normal tw-text-[var(--text-tertiary)]">82%</span>
            </div>
            <div className="marketing-inset-panel tw-rounded-[var(--radius-sm)] tw-px-3 tw-py-1.5 tw-text-left tw-text-xs tw-font-medium tw-text-[var(--text-secondary)] tw-transition hover:tw-brightness-[1.015]">
              Ship v1
              <span className="tw-ml-2 tw-font-normal tw-text-[var(--text-tertiary)]">14%</span>
            </div>
          </div>
          <p className="tw-mt-2 tw-text-[11px] tw-leading-relaxed tw-text-[var(--text-tertiary)]">
            Matched recent notes + open questions in Essays.
          </p>
        </div>

        <div className="tw-my-5 tw-h-px tw-w-full tw-bg-[var(--border-default)]" aria-hidden />

        <div className="tw-grid tw-gap-4 lg:tw-grid-cols-[1fr_1.05fr]">
          {/* Project cards */}
          <div className="tw-space-y-2.5">
            <p className="tw-font-mono tw-text-[10px] tw-uppercase tw-tracking-wider tw-text-[var(--text-tertiary)]">
              Projects
            </p>
            <article className="marketing-inset-panel tw-rounded-[var(--radius-sm)] tw-p-3 tw-transition hover:tw-brightness-[1.02]">
              <div className="tw-flex tw-items-center tw-justify-between tw-gap-2">
                <h3 className="tw-text-sm tw-font-medium tw-tracking-tight tw-text-[var(--text-primary)]">
                  Essays
                </h3>
                <span className="tw-shrink-0 tw-rounded tw-bg-[var(--bg-tertiary)] tw-px-1.5 tw-py-0.5 tw-font-mono tw-text-[10px] tw-text-[var(--text-tertiary)]">
                  6 notes
                </span>
              </div>
              <p className="tw-mt-2 tw-line-clamp-2 tw-text-[11px] tw-leading-relaxed tw-text-[var(--text-secondary)]">
                Brief tone, export limits, reader trust.
              </p>
            </article>
            <article className="marketing-inset-panel tw-rounded-[var(--radius-sm)] tw-p-3 tw-opacity-95 tw-transition hover:tw-brightness-[1.02]">
              <div className="tw-flex tw-items-center tw-justify-between tw-gap-2">
                <h3 className="tw-text-sm tw-font-medium tw-tracking-tight tw-text-[var(--text-primary)]">
                  Ship v1
                </h3>
                <span className="tw-shrink-0 tw-rounded tw-bg-[var(--bg-tertiary)] tw-px-1.5 tw-py-0.5 tw-font-mono tw-text-[10px] tw-text-[var(--text-tertiary)]">
                  12 notes
                </span>
              </div>
              <p className="tw-mt-2 tw-line-clamp-2 tw-text-[11px] tw-leading-relaxed tw-text-[var(--text-secondary)]">
                Invite gate, launch checklist, pricing copy.
              </p>
            </article>
          </div>

          {/* Memory + brief + writeback */}
          <div className="tw-flex tw-flex-col tw-gap-2.5">
            <p className="tw-font-mono tw-text-[10px] tw-uppercase tw-tracking-wider tw-text-[var(--text-tertiary)]">
              Project memory
            </p>
            <div className="marketing-inset-panel marketing-inset-panel--sheet tw-flex tw-flex-1 tw-flex-col tw-rounded-[var(--radius-sm)] tw-p-3">
              <div className="tw-flex tw-items-center tw-justify-between tw-gap-2">
                <span className="tw-font-mono tw-text-[10px] tw-uppercase tw-tracking-wider tw-text-[var(--text-tertiary)]">
                  Builder Brief
                </span>
                <span className="tw-font-mono tw-text-[10px] tw-text-[var(--accent)]">ready</span>
              </div>
              <div className="tw-mt-2 tw-text-[11px] tw-leading-relaxed tw-text-[var(--text-secondary)]">
                <p>
                  <span className="tw-font-medium tw-text-[var(--text-primary)]">Direction · </span>
                  Agent loop on the landing page; dogfood handoffs every ship session.
                </p>
                <p className="tw-mt-2">
                  <span className="tw-font-medium tw-text-[var(--text-primary)]">Do not · </span>
                  Ship OAuth breadth before the brief contract is stable.
                </p>
              </div>
              <div className="tw-mt-3 tw-border-t tw-border-dashed tw-border-[var(--border-default)] tw-pt-3">
                <span className="tw-font-mono tw-text-[10px] tw-uppercase tw-tracking-wider tw-text-[var(--text-tertiary)]">
                  Agent inbox
                </span>
                <p className="tw-mt-2 tw-text-[11px] tw-leading-relaxed tw-text-[var(--text-secondary)]">
                  <span className="tw-font-medium tw-text-[var(--text-primary)]">cursor · </span>
                  Security audit shipped — capture tokens + scoped agent events.
                </p>
              </div>
            </div>

            <div className="marketing-inset-panel tw-rounded-[var(--radius-sm)] tw-p-3">
              <div className="tw-flex tw-items-center tw-justify-between tw-gap-2">
                <span className="tw-font-mono tw-text-[10px] tw-uppercase tw-tracking-wider tw-text-[var(--text-tertiary)]">
                  Memory
                </span>
                <span className="tw-font-mono tw-text-[10px] tw-text-[var(--text-quaternary)]">accepted</span>
              </div>
              <p className="tw-mt-2 tw-text-[11px] tw-leading-relaxed tw-text-[var(--text-secondary)]">
                Stale memory must not appear in the next Builder Brief — you accept what becomes durable.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
