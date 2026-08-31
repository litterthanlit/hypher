/**
 * Right-hand product card: dump at top, the note, what they wrote back.
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

export function MarketingProductVisual() {
  return (
    <div
      className="marketing-product-visual tw-relative tw-overflow-hidden tw-rounded-[var(--radius-md)] tw-border tw-bg-[var(--bg-primary)]"
      aria-label="dump at top. the note. what they wrote back."
    >
      <GridBackdrop />

      <div className="tw-relative tw-z-[1] tw-flex tw-flex-col tw-gap-3 tw-p-4 sm:tw-p-6">
        <div className="tw-rounded-[var(--radius-sm)] tw-border tw-border-[var(--capture-blue-border)] tw-bg-gradient-to-b tw-from-white tw-to-[var(--capture-blue-soft)] tw-px-3 tw-py-3 tw-shadow-[var(--shadow-marketing-inset)] sm:tw-px-4 sm:tw-py-4">
          <p className="tw-font-mono tw-text-[10px] tw-tracking-wider tw-text-[var(--text-tertiary)]">
            dump
          </p>
          <p className="tw-mt-2 tw-text-left tw-text-[13px] tw-leading-relaxed tw-text-[var(--text-primary)] sm:tw-text-sm">
            shipped the gate. empty state still broken. don&apos;t widen oauth. cursor has the brief.
          </p>
        </div>

        <div className="marketing-inset-panel marketing-inset-panel--sheet tw-rounded-[var(--radius-sm)] tw-px-3 tw-py-3 sm:tw-px-4 sm:tw-py-4">
          <p className="tw-font-mono tw-text-[10px] tw-tracking-wider tw-text-[var(--text-tertiary)]">
            the note
          </p>
          <p className="tw-mt-2 tw-text-left tw-text-[13px] tw-leading-relaxed tw-text-[var(--text-primary)] sm:tw-text-sm">
            don&apos;t widen oauth.
          </p>
        </div>

        <div className="marketing-inset-panel tw-rounded-[var(--radius-sm)] tw-px-3 tw-py-3 sm:tw-px-4 sm:tw-py-4">
          <p className="tw-font-mono tw-text-[10px] tw-tracking-wider tw-text-[var(--text-tertiary)]">
            what they wrote back
          </p>
          <p className="tw-mt-2 tw-text-left tw-text-[13px] tw-leading-relaxed tw-text-[var(--text-secondary)] sm:tw-text-sm">
            gate is in. tokens hashed. events scoped.
          </p>
        </div>
      </div>
    </div>
  );
}
