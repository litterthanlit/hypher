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
        className
          ? `${className} tw-text-white tw-no-underline hover:tw-text-white hover:tw-no-underline`
          : "tw-inline-flex tw-items-center tw-justify-center tw-rounded-[var(--radius-sm)] tw-bg-electric tw-px-5 tw-py-2.5 tw-text-sm tw-font-medium tw-text-white tw-no-underline tw-shadow-sm tw-transition tw-duration-150 hover:tw-bg-electric-dim hover:tw-text-white hover:tw-no-underline active:tw-scale-[0.99]"
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
        className
          ? `${className} tw-no-underline hover:tw-no-underline`
          : "tw-inline-flex tw-items-center tw-justify-center tw-rounded-[var(--radius-sm)] tw-border tw-border-[var(--border-default)] tw-bg-[var(--bg-primary)] tw-px-5 tw-py-2.5 tw-text-sm tw-font-medium tw-text-[var(--text-primary)] tw-no-underline tw-transition tw-duration-150 hover:tw-border-[var(--border-hover)] hover:tw-bg-[var(--bg-secondary)] hover:tw-no-underline"
      }
    >
      I have an invite
    </Link>
  );
}

const navLinkClass =
  "tw-text-sm tw-text-[var(--text-secondary)] tw-no-underline tw-transition tw-duration-150 hover:tw-text-[var(--text-primary)] hover:tw-no-underline tw-shrink-0";

function PrimaryNavLinks() {
  return (
    <>
      <a href="#the-loop" className={navLinkClass}>
        How it works
      </a>
      <a href="#agents" className={navLinkClass}>
        For agents
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
              <h1 className="tw-mt-0 tw-max-w-xl tw-text-balance tw-font-wordmark tw-text-[2rem] tw-font-medium tw-leading-[1.1] tw-tracking-[0.04em] sm:tw-text-[2.35rem] lg:tw-text-[2.65rem] lg:tw-leading-[1.08]">
                <span className="tw-block tw-text-[var(--text-primary)]">The project context layer</span>
                <span className="tw-mt-2 tw-block tw-font-sans tw-text-[0.58em] tw-font-normal tw-leading-snug tw-tracking-normal tw-text-[var(--text-secondary)] sm:tw-mt-2.5">
                  for AI builders and agents.
                </span>
              </h1>
              <p className="tw-mt-6 tw-max-w-lg tw-text-pretty tw-text-base tw-font-normal tw-leading-relaxed tw-text-[var(--text-secondary)] sm:tw-mt-7 sm:tw-text-[17px]">
                Capture the messy work. Keep the project memory. Hand your agents the context.
              </p>
              <p className="tw-mt-3 tw-max-w-lg tw-text-pretty tw-text-sm tw-leading-relaxed tw-text-[var(--text-tertiary)] sm:tw-text-[15px]">
                Hypher turns messy notes, handoffs, and ship logs into durable project memory — then
                compiles what your agents need to read and records what they did while building.
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
              The loop builders and agents share.
            </h2>
            <p className="tw-mt-4 tw-max-w-2xl tw-text-pretty tw-text-sm tw-leading-relaxed tw-text-[var(--text-secondary)] sm:tw-text-base">
              Capture is the front door. Project memory and Builder Briefs are the system of record. Agent
              writeback keeps that record honest as you ship.
            </p>
            <div className="tw-mt-12 tw-grid tw-gap-8 sm:tw-grid-cols-2 lg:tw-grid-cols-4 lg:tw-gap-6">
              <LoopStep
                step="01"
                title="Capture anything"
                body="Notes, screenshots, links, and agent output — one inbox, no filing tax before you think."
                visual={<LoopVisualCapture />}
              />
              <LoopStep
                step="02"
                title="Context feed builds"
                body="Captures, handoffs, and agent output stream into Project Pulse — your project's living memory. You accept what becomes durable."
                visual={<LoopVisualMemory />}
              />
              <LoopStep
                step="03"
                title="Brief your agents"
                body="Copy a Builder Brief or fetch agent context for Cursor, Codex, OpenClaw, and MCP tools."
                visual={<LoopVisualBrief />}
              />
              <LoopStep
                step="04"
                title="Agents write back"
                body="Handoffs and build logs land in your inbox, update memory, and feed the next brief."
                visual={<LoopVisualWriteback />}
              />
            </div>
          </div>
        </section>

        <section
          id="agents"
          className="tw-scroll-mt-24 tw-border-b tw-border-[var(--border-default)] tw-bg-[var(--bg-secondary)]"
          aria-labelledby="agents-heading"
        >
          <div className="tw-mx-auto tw-max-w-6xl tw-px-4 tw-py-14 sm:tw-px-6 sm:tw-py-20 lg:tw-px-8">
            <h2
              id="agents-heading"
              className="tw-text-balance tw-font-wordmark tw-text-2xl tw-font-normal tw-tracking-[0.04em] sm:tw-text-3xl"
            >
              Read and write project context, not just store notes.
            </h2>
            <p className="tw-mt-4 tw-max-w-2xl tw-text-pretty tw-text-sm tw-leading-relaxed tw-text-[var(--text-secondary)] sm:tw-text-base">
              Hypher is the project memory layer your agents can read and update. Scoped API keys, capture
              tokens, handoff skills, and a read-only MCP surface — hardened for beta, designed to stay
              bounded.
            </p>
            <ul className="tw-mt-8 tw-flex tw-flex-wrap tw-gap-2" aria-label="Integrations">
              {["Cursor", "Codex", "OpenClaw", "ChatGPT", "MCP", "REST capture"].map(
                (label) => (
                  <li
                    key={label}
                    className="tw-rounded-full tw-border tw-border-[var(--border-default)] tw-bg-[var(--bg-primary)] tw-px-3 tw-py-1 tw-font-mono tw-text-[11px] tw-text-[var(--text-secondary)]"
                  >
                    {label}
                  </li>
                )
              )}
            </ul>
            <div className="tw-mt-10 tw-grid tw-gap-6 lg:tw-grid-cols-2">
              <AgentFlowCard
                title="Context feed (in)"
                body="Captures, agent handoffs, build logs, returned agent output, and email replies flow into one project timeline. You review what becomes durable memory."
                code="capture · agent/events · handoff results"
              />
              <AgentFlowCard
                title="Builder Brief (out)"
                body="Hypher compiles the feed into a bounded packet — direction, constraints, open questions, and what changed since the last session."
                code="GET /api/projects/{id}/agent-context"
              />
            </div>
            <p className="tw-mt-6 tw-max-w-3xl tw-text-sm tw-leading-relaxed tw-text-[var(--text-tertiary)]">
              Agents write back with{" "}
              <span className="tw-font-mono tw-text-[11px] tw-text-[var(--text-secondary)]">POST /api/agent/events</span>
              . Project Pulse crystallizes the feed into decisions and constraints so stale context does not leak into the next brief.
            </p>
          </div>
        </section>

        <section id="product" className="tw-scroll-mt-24" aria-labelledby="product-heading">
          <div className="tw-mx-auto tw-max-w-6xl tw-px-4 tw-py-14 sm:tw-px-6 sm:tw-py-20 lg:tw-px-8">
            <h2
              id="product-heading"
              className="tw-text-balance tw-font-wordmark tw-text-2xl tw-font-normal tw-tracking-[0.04em] sm:tw-text-3xl"
            >
              Everything around the loop.
            </h2>
            <div className="tw-mt-10 tw-grid tw-gap-10 lg:tw-grid-cols-2 lg:tw-gap-8">
              <FeatureBlock
                title="Self-sorting capture"
                body="Hypher suggests the right project, explains why, and lets you decide."
                detail="Web inbox, /capture URLs, and scoped capture tokens for scripts and agents."
              />
              <FeatureBlock
                title="Crystallized memory"
                body="Accept or dismiss suggested decisions, constraints, and warnings so stale context does not poison the next brief."
                detail="Returned agent output can flow back into Project Pulse — you stay in control of what becomes durable."
              />
              <FeatureBlock
                title="Spatial canvas"
                body="See how notes cluster per project when you want spatial sense-making, not just lists."
                detail="Connections, undo/redo, and canvas ask — the thinking layer when a brief is not enough."
              />
              <FeatureBlock
                title="Daily digest"
                body="A resurfacing loop for neglected projects — human-readable, separate from the agent packet."
                detail="Optional email mirror for builders who want a morning scan without opening the app."
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
              I&apos;m approving a small group of builders manually so I can watch the full loop — capture,
              Builder Briefs, agent writeback, and crystallized memory — with real shipping sessions.
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
            Project context layer for AI builders and agents.
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
      <div className="marketing-inset-panel tw-mb-5 tw-min-h-[112px] tw-p-3">{visual}</div>
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

function AgentFlowCard({ title, body, code }: { title: string; body: string; code: string }) {
  return (
    <article className="marketing-surface-card tw-rounded-[var(--radius-md)] tw-p-6">
      <h3 className="tw-text-base tw-font-medium tw-tracking-tight tw-text-[var(--text-primary)]">{title}</h3>
      <p className="tw-mt-2 tw-text-sm tw-leading-relaxed tw-text-[var(--text-secondary)]">{body}</p>
      <p className="tw-mt-4 tw-overflow-x-auto tw-rounded-[var(--radius-sm)] tw-border tw-border-[var(--border-default)] tw-bg-[var(--bg-root)] tw-px-3 tw-py-2 tw-font-mono tw-text-[11px] tw-text-[var(--text-tertiary)]">
        {code}
      </p>
    </article>
  );
}

function LoopVisualCapture() {
  return (
    <div className="tw-flex tw-h-full tw-min-h-[104px] tw-flex-col tw-gap-2.5">
      <div className="tw-flex tw-items-center tw-justify-between tw-gap-2">
        <span className="tw-font-mono tw-text-[9px] tw-uppercase tw-tracking-wider tw-text-[var(--text-tertiary)]">
          Inbox
        </span>
        <span className="tw-rounded tw-bg-[var(--bg-tertiary)] tw-px-1.5 tw-py-0.5 tw-font-mono tw-text-[9px] tw-tabular-nums tw-text-[var(--text-tertiary)]">
          3 new
        </span>
      </div>
      <div className="tw-rounded tw-border tw-border-[var(--border-default)] tw-bg-[var(--bg-primary)] tw-p-2.5 tw-shadow-[0_1px_0_rgba(255,255,255,0.06)_inset]">
        <div className="tw-flex tw-items-start tw-gap-2">
          <span
            className="tw-mt-1 tw-h-1.5 tw-w-1.5 tw-shrink-0 tw-rounded-full tw-bg-[var(--accent)]"
            aria-hidden
          />
          <div className="tw-min-w-0 tw-flex-1">
            <p className="tw-text-[10px] tw-leading-snug tw-text-[var(--text-secondary)]">
              <span className="tw-font-mono tw-text-[var(--text-quaternary)]">2m · </span>
              RFC digest tone — ship empty state before widening beta…
            </p>
          </div>
        </div>
        <div className="tw-mt-2.5 tw-flex tw-items-center tw-gap-2 tw-border-t tw-border-dashed tw-border-[var(--border-default)] tw-pt-2">
          <div
            className="tw-relative tw-h-8 tw-w-8 tw-shrink-0 tw-overflow-hidden tw-rounded tw-bg-gradient-to-br tw-from-[var(--capture-blue-soft)] tw-to-[var(--bg-tertiary)] tw-ring-1 tw-ring-[var(--capture-blue-border)]"
            aria-hidden
          >
            <span className="tw-absolute tw-inset-0 tw-flex tw-items-center tw-justify-center tw-font-mono tw-text-[8px] tw-text-[var(--capture-blue)]">
              img
            </span>
          </div>
          <div className="tw-flex tw-min-w-0 tw-flex-1 tw-flex-col tw-gap-1">
            <div className="tw-h-[3px] tw-w-full tw-max-w-[132px] tw-rounded-full tw-bg-[var(--text-quaternary)]/28" />
            <div className="tw-h-[3px] tw-w-[78%] tw-max-w-[104px] tw-rounded-full tw-bg-[var(--text-quaternary)]/18" />
            <div className="tw-h-[3px] tw-w-[52%] tw-max-w-[72px] tw-rounded-full tw-bg-[var(--text-quaternary)]/12" />
          </div>
        </div>
      </div>
    </div>
  );
}

function LoopVisualSort() {
  return (
    <div className="tw-flex tw-h-full tw-min-h-[104px] tw-flex-col tw-gap-2 tw-text-[10px]">
      <span className="tw-font-mono tw-text-[9px] tw-uppercase tw-tracking-wider tw-text-[var(--text-tertiary)]">
        Suggested project
      </span>
      <div className="tw-flex tw-items-stretch tw-gap-2">
        <div className="tw-flex tw-min-w-0 tw-flex-1 tw-flex-col tw-rounded tw-border tw-border-[var(--accent)] tw-bg-[var(--accent-subtle)] tw-p-2">
          <div className="tw-flex tw-items-center tw-justify-between tw-gap-1">
            <span className="tw-truncate tw-font-medium tw-text-[var(--accent)]">Essays</span>
            <span className="tw-shrink-0 tw-font-mono tw-text-[var(--text-tertiary)]">82%</span>
          </div>
          <div className="tw-mt-2 tw-h-1 tw-w-full tw-overflow-hidden tw-rounded-full tw-bg-[var(--bg-primary)]">
            <div className="tw-h-full tw-w-[82%] tw-rounded-full tw-bg-[var(--accent)]/50" />
          </div>
        </div>
        <div className="tw-flex tw-min-w-0 tw-flex-1 tw-flex-col tw-rounded tw-border tw-border-[var(--border-default)] tw-bg-[var(--bg-primary)] tw-p-2 tw-opacity-[0.92]">
          <div className="tw-flex tw-items-center tw-justify-between tw-gap-1">
            <span className="tw-truncate tw-font-medium tw-text-[var(--text-secondary)]">Ship v1</span>
            <span className="tw-shrink-0 tw-font-mono tw-text-[var(--text-tertiary)]">14%</span>
          </div>
          <div className="tw-mt-2 tw-h-1 tw-w-full tw-overflow-hidden tw-rounded-full tw-bg-[var(--bg-tertiary)]">
            <div className="tw-h-full tw-w-[14%] tw-rounded-full tw-bg-[var(--text-quaternary)]/40" />
          </div>
        </div>
      </div>
      <p className="tw-line-clamp-2 tw-leading-snug tw-text-[var(--text-quaternary)]">
        Matched &quot;digest&quot;, &quot;export&quot;, and your last three captures.
      </p>
    </div>
  );
}

function LoopVisualMemory() {
  return (
    <div className="tw-flex tw-h-full tw-min-h-[104px] tw-flex-col tw-justify-between tw-gap-2 tw-text-[10px]">
      <div className="tw-rounded tw-border tw-border-[var(--border-default)] tw-bg-[var(--bg-primary)] tw-p-2.5">
        <p className="tw-font-mono tw-text-[9px] tw-uppercase tw-tracking-wider tw-text-[var(--text-tertiary)]">
          Crystallized
        </p>
        <p className="tw-mt-1.5 tw-font-medium tw-text-[var(--text-primary)]">Do not widen OAuth yet</p>
        <p className="tw-mt-1 tw-leading-snug tw-text-[var(--text-tertiary)]">Stabilize Builder Brief loop first</p>
      </div>
      <div className="tw-rounded tw-border tw-border-[var(--accent-muted)] tw-bg-[var(--accent-subtle)] tw-px-2 tw-py-1.5">
        <p className="tw-font-mono tw-text-[9px] tw-uppercase tw-tracking-wide tw-text-[var(--text-tertiary)]">Open</p>
        <p className="tw-mt-0.5 tw-font-medium tw-leading-tight tw-text-[var(--text-primary)]">Digest empty state</p>
      </div>
    </div>
  );
}

function LoopVisualBrief() {
  return (
    <div className="tw-flex tw-h-full tw-min-h-[104px] tw-flex-col tw-gap-2 tw-text-[10px]">
      <span className="tw-font-mono tw-text-[9px] tw-uppercase tw-tracking-wider tw-text-[var(--text-tertiary)]">
        Builder Brief
      </span>
      <div className="tw-flex-1 tw-rounded tw-border tw-border-[var(--border-default)] tw-bg-[var(--bg-primary)] tw-p-2.5 tw-font-mono tw-leading-snug tw-text-[var(--text-quaternary)]">
        <p className="tw-text-[var(--text-secondary)]"># Ship v1</p>
        <p className="tw-mt-1">Direction · invite gate + agent loop</p>
        <p className="tw-mt-1">Do not · OAuth until brief is stable</p>
      </div>
      <p className="tw-text-[var(--accent)]">Copied to Cursor</p>
    </div>
  );
}

function LoopVisualWriteback() {
  return (
    <div className="tw-flex tw-h-full tw-min-h-[104px] tw-flex-col tw-gap-2 tw-text-[10px]">
      <div className="tw-flex tw-items-center tw-justify-between tw-gap-2">
        <span className="tw-font-mono tw-text-[9px] tw-uppercase tw-tracking-wider tw-text-[var(--text-tertiary)]">
          Agent inbox
        </span>
        <span className="tw-rounded tw-bg-[var(--bg-tertiary)] tw-px-1.5 tw-py-0.5 tw-font-mono tw-text-[9px] tw-text-[var(--text-tertiary)]">
          cursor
        </span>
      </div>
      <div className="tw-rounded tw-border tw-border-[var(--border-default)] tw-bg-[var(--bg-primary)] tw-p-2.5">
        <p className="tw-font-medium tw-text-[var(--text-primary)]">Security audit shipped</p>
        <p className="tw-mt-1 tw-line-clamp-2 tw-leading-snug tw-text-[var(--text-tertiary)]">
          Capture tokens hashed · agent events scoped · ready for next brief
        </p>
      </div>
    </div>
  );
}
