"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { MarketingBrand } from "./MarketingBrand";
import { MarketingProductVisual } from "./MarketingProductVisual";

function BetaCta({ className }: { className?: string }) {
  return (
    <Link
      href="/beta/request"
      className={
        className ??
        "tw-inline-flex tw-items-center tw-justify-center tw-rounded-[var(--radius-sm)] tw-bg-electric tw-px-5 tw-py-2.5 tw-text-sm tw-font-medium tw-text-[var(--text-on-accent)] tw-shadow-sm tw-transition tw-duration-150 hover:tw-bg-electric-dim active:tw-scale-[0.99]"
      }
    >
      Request beta access
    </Link>
  );
}

function InviteCta({ className }: { className?: string }) {
  return (
    <Link
      href="/app"
      className={
        className ??
        "tw-inline-flex tw-items-center tw-justify-center tw-rounded-[var(--radius-sm)] tw-border tw-border-[var(--border-default)] tw-bg-[var(--bg-primary)] tw-px-5 tw-py-2.5 tw-text-sm tw-font-medium tw-text-[var(--text-primary)] tw-transition tw-duration-150 hover:tw-border-[var(--border-hover)] hover:tw-bg-[var(--bg-secondary)]"
      }
    >
      I have an invite
    </Link>
  );
}

const navLinkClass =
  "tw-text-sm tw-text-[var(--text-secondary)] tw-transition tw-duration-150 hover:tw-text-[var(--text-primary)] tw-shrink-0";

function PrimaryNavLinks() {
  return (
    <>
      <a href="#the-loop" className={navLinkClass}>
        How it works
      </a>
      <a href="#product" className={navLinkClass}>
        Product
      </a>
      <a href="#beta" className={navLinkClass}>
        Beta
      </a>
      <Link href="/pricing" className={navLinkClass}>
        Pricing
      </Link>
      <Link href="/sign-in" className={navLinkClass}>
        Sign in
      </Link>
    </>
  );
}

export function LandingPage() {
  return (
    <div className="marketing-root tw-min-h-screen tw-text-[var(--text-primary)]">
      <header className="tw-sticky tw-top-0 tw-z-50 tw-border-b tw-border-[var(--border-default)] tw-bg-[var(--bg-primary)]/90 tw-backdrop-blur-md">
        <div className="tw-mx-auto tw-max-w-6xl tw-px-4 tw-py-3 sm:tw-px-6 lg:tw-px-8">
          <div className="tw-flex tw-flex-wrap tw-items-center tw-justify-between tw-gap-x-4 tw-gap-y-3">
            <MarketingBrand className="tw-shrink-0" />
            <BetaCta className="tw-inline-flex md:tw-hidden tw-items-center tw-justify-center tw-rounded-[var(--radius-sm)] tw-bg-electric tw-px-3 tw-py-2 tw-text-xs tw-font-medium tw-text-[var(--text-on-accent)] tw-shadow-sm tw-transition tw-duration-150 hover:tw-bg-electric-dim" />
            <div className="tw-hidden tw-items-center tw-gap-8 md:tw-flex">
              <nav className="tw-flex tw-items-center tw-gap-6" aria-label="Primary">
                <PrimaryNavLinks />
              </nav>
              <BetaCta className="tw-inline-flex tw-items-center tw-justify-center tw-rounded-[var(--radius-sm)] tw-bg-electric tw-px-4 tw-py-2 tw-text-sm tw-font-medium tw-text-[var(--text-on-accent)] tw-shadow-sm tw-transition tw-duration-150 hover:tw-bg-electric-dim" />
            </div>
          </div>
          <nav
            className="tw-flex tw-w-full tw-min-w-0 tw-overflow-x-auto tw-pt-3 md:tw-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:tw-hidden"
            aria-label="Primary mobile"
          >
            <div className="tw-flex tw-min-w-0 tw-flex-1 tw-items-center tw-gap-5">
              <PrimaryNavLinks />
            </div>
          </nav>
        </div>
      </header>

      <main>
        <section className="marketing-hero tw-border-b tw-border-[var(--border-default)]">
          <div className="tw-mx-auto tw-grid tw-max-w-6xl tw-gap-10 tw-px-4 tw-py-12 sm:tw-px-6 sm:tw-py-16 lg:tw-grid-cols-[minmax(0,1.02fr)_minmax(0,1fr)] lg:tw-items-center lg:tw-gap-14 lg:tw-px-8 lg:tw-py-20">
            <div className="tw-min-w-0">
              <h1 className="tw-mt-0 tw-max-w-[22ch] tw-text-balance tw-font-wordmark tw-text-[2rem] tw-font-normal tw-leading-[1.12] tw-tracking-[0.04em] sm:tw-max-w-none sm:tw-text-4xl lg:tw-text-[2.85rem] lg:tw-leading-[1.08]">
                Capture first. Hypher sorts the rest.
              </h1>
              <p className="tw-mt-5 tw-max-w-xl tw-text-pretty tw-text-base tw-leading-relaxed tw-text-[var(--text-secondary)] sm:tw-text-[17px]">
                Drop ideas, notes, files, and half-formed plans into one calm workspace. Hypher suggests
                where they belong, remembers project context, and helps you decide what to do next.
              </p>
              <div className="tw-mt-8 tw-flex tw-flex-col tw-gap-3 sm:tw-flex-row sm:tw-flex-wrap sm:tw-items-center">
                <BetaCta />
                <InviteCta />
              </div>
            </div>
            <div className="tw-min-w-0 tw-w-full">
              <MarketingProductVisual />
            </div>
          </div>
        </section>

        <section
          id="the-loop"
          className="tw-scroll-mt-24 tw-border-b tw-border-[var(--border-default)] tw-bg-[var(--bg-primary)]"
          aria-labelledby="loop-heading"
        >
          <div className="tw-mx-auto tw-max-w-6xl tw-px-4 tw-py-14 sm:tw-px-6 sm:tw-py-20 lg:tw-px-8">
            <h2
              id="loop-heading"
              className="tw-text-balance tw-font-wordmark tw-text-2xl tw-font-normal tw-tracking-[0.04em] sm:tw-text-3xl"
            >
              The loop that keeps projects alive.
            </h2>
            <div className="tw-mt-12 tw-grid tw-gap-8 md:tw-grid-cols-3 md:tw-gap-6 lg:tw-gap-10">
              <LoopStep
                step="01"
                title="Capture anything"
                body="Voice memos, screenshots, paragraphs, links — one inbox, no filing tax before you think."
                visual={<LoopVisualCapture />}
              />
              <LoopStep
                step="02"
                title="Sort with suggestions"
                body="Hypher proposes a project, shows its reasoning, and you stay in control of every move."
                visual={<LoopVisualSort />}
              />
              <LoopStep
                step="03"
                title="Return with memory and next actions"
                body="Each visit surfaces direction, open questions, and one concrete next step — not a blank canvas."
                visual={<LoopVisualReturn />}
              />
            </div>
          </div>
        </section>

        <section id="product" className="tw-scroll-mt-24" aria-labelledby="product-heading">
          <div className="tw-mx-auto tw-max-w-6xl tw-px-4 tw-py-14 sm:tw-px-6 sm:tw-py-20 lg:tw-px-8">
            <h2 id="product-heading" className="tw-sr-only">
              Product
            </h2>
            <div className="tw-grid tw-gap-10 lg:tw-grid-cols-3 lg:tw-gap-8">
              <FeatureBlock
                title="Self-sorting capture"
                body="Hypher suggests the right project, explains why, and lets you decide."
                detail="Suggestions stay visible with confidence you can override — control without busywork."
              />
              <FeatureBlock
                title="Project memory"
                body="Each project gets a living snapshot: direction, open questions, recent changes, and suggested next actions."
                detail="Assembled from captures and edits you already made — not another doc to curate."
              />
              <FeatureBlock
                title="Daily digest"
                body="A daily resurfacing loop keeps neglected work from disappearing."
                detail="Short enough to scan between meetings; concrete enough to pick one next move."
              />
            </div>
          </div>
        </section>

        <section
          id="beta"
          className="tw-scroll-mt-24 tw-border-y tw-border-[var(--border-default)] tw-bg-[var(--bg-secondary)]"
          aria-labelledby="beta-heading"
        >
          <div className="tw-mx-auto tw-max-w-6xl tw-px-4 tw-py-14 sm:tw-px-6 sm:tw-py-20 lg:tw-px-8">
            <h2
              id="beta-heading"
              className="tw-text-balance tw-font-wordmark tw-text-2xl tw-font-normal tw-tracking-[0.04em] sm:tw-text-3xl"
            >
              Built for people carrying too many threads.
            </h2>
            <p className="tw-mt-5 tw-max-w-2xl tw-text-pretty tw-text-base tw-leading-relaxed tw-text-[var(--text-secondary)] sm:tw-text-[17px]">
              For solo builders, indie hackers, researchers, designers, and engineers juggling projects that
              do not fit neatly inside a task manager.
            </p>
            <p className="tw-mt-6 tw-max-w-2xl tw-border-l-2 tw-border-[var(--accent)] tw-pl-4 tw-text-sm tw-leading-relaxed tw-text-[var(--text-tertiary)]">
              Hypher is invite-gated while the core workflow is shaped with early users. Expect rough edges,
              fast iteration, and a product that gets calmer as it learns your patterns.
            </p>
          </div>
        </section>

        <section className="tw-border-b tw-border-[var(--border-default)]" aria-labelledby="beta-cadence-heading">
          <div className="tw-mx-auto tw-max-w-6xl tw-px-4 tw-py-14 sm:tw-px-6 sm:tw-py-20 lg:tw-px-8">
            <p className="tw-font-mono tw-text-[11px] tw-uppercase tw-tracking-[0.18em] tw-text-[var(--text-tertiary)]">
              Opening carefully.
            </p>
            <h2
              id="beta-cadence-heading"
              className="tw-mt-3 tw-font-wordmark tw-text-xl tw-font-normal tw-tracking-[0.04em] sm:tw-text-2xl"
            >
              The first beta is about the core loop.
            </h2>
            <p className="tw-mt-4 tw-max-w-2xl tw-text-pretty tw-text-sm tw-leading-relaxed tw-text-[var(--text-secondary)] sm:tw-text-base">
              I&apos;m approving a small group of builders manually so I can watch where capture, sorting,
              project memory, and next actions help real work move forward.
            </p>
          </div>
        </section>

        <section className="tw-pb-20 tw-pt-16 sm:tw-pb-28 sm:tw-pt-20" aria-labelledby="final-cta-heading">
          <div className="tw-mx-auto tw-max-w-6xl tw-px-4 sm:tw-px-6 lg:tw-px-8">
            <div className="marketing-surface-card tw-rounded-[var(--radius-md)] tw-px-6 tw-py-10 sm:tw-px-10 sm:tw-py-12">
              <h2
                id="final-cta-heading"
                className="tw-text-balance tw-text-center tw-font-wordmark tw-text-2xl tw-font-normal tw-tracking-[0.04em] sm:tw-text-3xl"
              >
                Bring your messiest project brain.
              </h2>
              <div className="tw-mt-8 tw-flex tw-flex-col tw-items-stretch tw-justify-center tw-gap-3 sm:tw-flex-row sm:tw-items-center sm:tw-justify-center">
                <BetaCta className="tw-inline-flex tw-items-center tw-justify-center tw-rounded-[var(--radius-sm)] tw-bg-electric tw-px-6 tw-py-3 tw-text-sm tw-font-medium tw-text-[var(--text-on-accent)] tw-shadow-sm tw-transition tw-duration-150 hover:tw-bg-electric-dim" />
                <InviteCta className="tw-inline-flex tw-items-center tw-justify-center tw-rounded-[var(--radius-sm)] tw-border tw-border-[var(--border-default)] tw-bg-[var(--bg-root)] tw-px-6 tw-py-3 tw-text-sm tw-font-medium tw-text-[var(--text-primary)] tw-transition tw-duration-150 hover:tw-border-[var(--border-hover)]" />
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="tw-border-t tw-border-[var(--border-default)] tw-py-10">
        <div className="tw-mx-auto tw-flex tw-max-w-6xl tw-flex-col tw-items-center tw-gap-6 tw-px-4 sm:tw-flex-row sm:tw-items-center sm:tw-justify-between sm:tw-px-6 lg:tw-px-8">
          <MarketingBrand size="sm" showTagline />
          <p className="tw-max-w-md tw-text-center tw-text-xs tw-leading-relaxed tw-text-[var(--text-tertiary)] sm:tw-text-right sm:tw-text-sm">
            Capture-first workspace for solo builders.
          </p>
        </div>
      </footer>
    </div>
  );
}

function LoopStep({
  step,
  title,
  body,
  visual,
}: {
  step: string;
  title: string;
  body: string;
  visual: ReactNode;
}) {
  return (
    <article className="marketing-surface-card tw-group tw-flex tw-flex-col tw-rounded-[var(--radius-md)] tw-p-5">
      <div className="marketing-inset-panel tw-mb-5 tw-min-h-[100px] tw-p-3">{visual}</div>
      <p className="tw-font-mono tw-text-[10px] tw-uppercase tw-tracking-wider tw-text-[var(--text-quaternary)]">
        {step}
      </p>
      <h3 className="tw-mt-2 tw-text-base tw-font-medium tw-tracking-tight tw-text-[var(--text-primary)]">
        {title}
      </h3>
      <p className="tw-mt-2 tw-text-sm tw-leading-relaxed tw-text-[var(--text-secondary)]">{body}</p>
    </article>
  );
}

function FeatureBlock({ title, body, detail }: { title: string; body: string; detail: string }) {
  return (
    <article className="marketing-surface-card tw-flex tw-flex-col tw-rounded-[var(--radius-md)] tw-p-6">
      <h3 className="tw-text-lg tw-font-medium tw-tracking-tight tw-text-[var(--text-primary)]">{title}</h3>
      <p className="tw-mt-3 tw-flex-1 tw-text-sm tw-leading-relaxed tw-text-[var(--text-secondary)]">{body}</p>
      <p className="tw-mt-5 tw-border-t tw-border-[var(--border-default)] tw-pt-4 tw-text-xs tw-leading-relaxed tw-text-[var(--text-tertiary)]">
        {detail}
      </p>
    </article>
  );
}

function LoopVisualCapture() {
  return (
    <div className="tw-flex tw-h-full tw-flex-col tw-justify-center tw-gap-2">
      <div className="tw-h-2 tw-w-12 tw-rounded tw-bg-[var(--text-quaternary)]/40" />
      <div className="tw-h-2 tw-w-full tw-max-w-[180px] tw-rounded tw-bg-[var(--text-tertiary)]/35" />
      <div className="tw-h-2 tw-w-[72%] tw-max-w-[140px] tw-rounded tw-bg-[var(--text-tertiary)]/25" />
      <div className="tw-mt-1 tw-flex tw-gap-1.5">
        <span className="tw-h-6 tw-w-6 tw-rounded-[4px] tw-bg-[var(--capture-blue-soft)] tw-ring-1 tw-ring-[var(--capture-blue-border)]" />
        <span className="tw-h-6 tw-w-14 tw-rounded-[4px] tw-bg-[var(--bg-tertiary)]" />
      </div>
    </div>
  );
}

function LoopVisualSort() {
  return (
    <div className="tw-flex tw-h-full tw-flex-col tw-justify-center tw-gap-2.5 tw-text-[10px]">
      <div className="tw-flex tw-items-center tw-gap-2">
        <span className="tw-rounded-[4px] tw-bg-[var(--accent-subtle)] tw-px-2 tw-py-1 tw-font-medium tw-text-[var(--accent)]">
          Essays
        </span>
        <span className="tw-text-[var(--text-quaternary)]">82%</span>
      </div>
      <div className="tw-flex tw-items-center tw-gap-2 tw-text-[var(--text-tertiary)]">
        <span className="tw-rounded-[4px] tw-bg-[var(--bg-tertiary)] tw-px-2 tw-py-1 tw-text-[var(--text-secondary)]">
          Ship v1
        </span>
        <span>14%</span>
      </div>
      <p className="tw-leading-snug tw-text-[var(--text-quaternary)]">Why: shared keywords + last 3 captures.</p>
    </div>
  );
}

function LoopVisualReturn() {
  return (
    <div className="tw-flex tw-h-full tw-flex-col tw-justify-center tw-gap-2 tw-text-[10px]">
      <div className="tw-rounded-[4px] tw-border tw-border-[var(--border-default)] tw-bg-[var(--bg-primary)] tw-p-2">
        <p className="tw-font-medium tw-text-[var(--text-primary)]">Direction</p>
        <p className="tw-mt-1 tw-leading-snug tw-text-[var(--text-tertiary)]">Close export thread this week.</p>
      </div>
      <div className="tw-rounded-[4px] tw-border tw-border-[var(--accent-muted)] tw-bg-[var(--accent-subtle)] tw-px-2 tw-py-1.5 tw-font-medium tw-text-[var(--text-primary)]">
        Next · Ship digest empty state
      </div>
    </div>
  );
}
