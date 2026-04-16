"use client";

import Link from "next/link";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { PricingCards } from "./PricingCards";

export function LandingPage() {
  return (
    <div className="tw-min-h-screen tw-bg-[var(--bg-root)] tw-text-[var(--text-primary)]">
      <header className="tw-mx-auto tw-flex tw-max-w-5xl tw-items-center tw-justify-between tw-px-6 tw-py-8 md:tw-px-10">
        <span className="tw-font-mono tw-text-sm tw-tracking-tight">Hypher</span>
        <nav className="tw-flex tw-items-center tw-gap-6">
          <Link
            href="/pricing"
            className="tw-text-sm tw-text-[var(--text-secondary)] tw-transition hover:tw-text-electric"
          >
            Pricing
          </Link>
          <SignInButton mode="modal">
            <button type="button" className="tw-text-sm tw-text-[var(--text-secondary)] tw-transition hover:tw-text-[var(--text-primary)]">
              Sign in
            </button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button
              type="button"
              className="tw-rounded-full tw-bg-electric tw-px-4 tw-py-2 tw-text-sm tw-font-medium tw-text-white tw-shadow-sm tw-transition hover:tw-bg-electric-dim"
            >
              Sign up
            </button>
          </SignUpButton>
        </nav>
      </header>

      <main className="tw-mx-auto tw-max-w-5xl tw-px-6 tw-pb-24 md:tw-px-10">
        <section className="tw-pt-8 tw-pb-20 md:tw-pt-16 md:tw-pb-28">
          <p className="tw-font-mono tw-text-xs tw-uppercase tw-tracking-[0.2em] tw-text-electric">Public beta</p>
          <h1 className="tw-mt-6 tw-max-w-2xl tw-font-sans tw-text-4xl tw-font-medium tw-leading-[1.1] tw-tracking-tight md:tw-text-5xl">
            Your projects, connected.
          </h1>
          <p className="tw-mt-6 tw-max-w-xl tw-text-lg tw-leading-relaxed tw-text-[var(--text-secondary)]">
            A calm workspace for capture, context, and shipping — notes, canvas, and GitHub signals in one graph.
          </p>
          <div className="tw-mt-10 tw-flex tw-flex-wrap tw-items-center tw-gap-4">
            <SignUpButton mode="modal">
              <button
                type="button"
                className="tw-rounded-full tw-bg-electric tw-px-6 tw-py-3 tw-text-sm tw-font-medium tw-text-white tw-shadow-md tw-transition hover:tw-bg-electric-dim"
              >
                Sign up free
              </button>
            </SignUpButton>
            <Link
              href="/pricing"
              className="tw-text-sm tw-font-medium tw-text-[var(--text-secondary)] tw-underline tw-underline-offset-4 tw-transition hover:tw-text-electric"
            >
              View pricing
            </Link>
          </div>
        </section>

        <section className="tw-grid tw-gap-10 tw-border-t tw-border-black/[0.06] tw-pt-16 md:tw-grid-cols-3 md:tw-gap-12 md:tw-pt-20">
          <div>
            <h2 className="tw-font-mono tw-text-sm tw-font-medium tw-tracking-wide tw-text-electric">Capture</h2>
            <p className="tw-mt-4 tw-leading-relaxed tw-text-[var(--text-secondary)]">
              Drop thoughts, files, and clips into an inbox that stays out of the way until you are ready to organize.
            </p>
          </div>
          <div>
            <h2 className="tw-font-mono tw-text-sm tw-font-medium tw-tracking-wide tw-text-electric">Connect</h2>
            <p className="tw-mt-4 tw-leading-relaxed tw-text-[var(--text-secondary)]">
              See notes and artifacts on a canvas with suggestions that link ideas across projects without losing the thread.
            </p>
          </div>
          <div>
            <h2 className="tw-font-mono tw-text-sm tw-font-medium tw-tracking-wide tw-text-electric">Ship</h2>
            <p className="tw-mt-4 tw-leading-relaxed tw-text-[var(--text-secondary)]">
              Ground decisions in what is actually moving: digest, activity, and repo context when you wire GitHub in.
            </p>
          </div>
        </section>

        <section className="tw-mt-24 tw-border-t tw-border-black/[0.06] tw-pt-20">
          <h2 className="tw-font-sans tw-text-2xl tw-font-medium tw-tracking-tight">Pricing</h2>
          <p className="tw-mt-2 tw-max-w-xl tw-text-[var(--text-secondary)]">
            Start free, upgrade when Hypher is part of your daily loop.
          </p>
          <div className="tw-mt-12">
            <PricingCards variant="compact" />
          </div>
        </section>
      </main>

      <footer className="tw-border-t tw-border-black/[0.06] tw-py-10 tw-text-center tw-text-sm tw-text-[var(--text-tertiary)]">
        Hypher — the workspace that knows what you are working on.
      </footer>
    </div>
  );
}
