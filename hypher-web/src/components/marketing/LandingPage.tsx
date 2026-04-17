"use client";

import Link from "next/link";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { PricingCards } from "./PricingCards";
import { MarketingCanvasPreview } from "./MarketingCanvasPreview";

type ProofDot = { x: number; y: number; s: number; c: string };
type ProofCard = { name: string; role: string; quote: string; dots: ProofDot[] };

const PROOF_CARDS: ProofCard[] = [
  {
    name: "Kasia M.",
    role: "indie dev · 4 projects",
    quote: "Finally stopped losing threads between my side quests.",
    dots: [
      { x: 20, y: 30, s: 12, c: "#3ecf8e" },
      { x: 38, y: 42, s: 8, c: "#3ecf8e" },
      { x: 28, y: 58, s: 10, c: "#3ecf8e" },
      { x: 68, y: 34, s: 9, c: "#60a5fa" },
      { x: 78, y: 52, s: 11, c: "#60a5fa" },
      { x: 55, y: 72, s: 7, c: "#fbbf24" },
    ],
  },
  {
    name: "Theo R.",
    role: "designer-engineer",
    quote: "The digest is the only standup I actually read.",
    dots: [
      { x: 25, y: 25, s: 10, c: "#a78bfa" },
      { x: 38, y: 48, s: 12, c: "#a78bfa" },
      { x: 62, y: 32, s: 8, c: "#f472b6" },
      { x: 72, y: 55, s: 9, c: "#f472b6" },
      { x: 50, y: 70, s: 7, c: "#34d399" },
    ],
  },
  {
    name: "Prakash S.",
    role: "shipping 3 betas",
    quote: "Capture → canvas → PR. The whole loop.",
    dots: [
      { x: 22, y: 35, s: 9, c: "#fbbf24" },
      { x: 35, y: 58, s: 11, c: "#fbbf24" },
      { x: 60, y: 28, s: 10, c: "#3ecf8e" },
      { x: 78, y: 42, s: 8, c: "#3ecf8e" },
      { x: 68, y: 68, s: 7, c: "#60a5fa" },
    ],
  },
  {
    name: "Mireille D.",
    role: "solo founder",
    quote: "Ambient Claude has replaced three of my open tabs.",
    dots: [
      { x: 30, y: 30, s: 11, c: "#f472b6" },
      { x: 50, y: 45, s: 9, c: "#f472b6" },
      { x: 70, y: 35, s: 10, c: "#60a5fa" },
      { x: 40, y: 65, s: 8, c: "#34d399" },
      { x: 62, y: 70, s: 7, c: "#34d399" },
    ],
  },
  {
    name: "Yusuf A.",
    role: "weekend hacker",
    quote: "It noticed I hadn't touched a project in 3 weeks. Brutal. Useful.",
    dots: [
      { x: 24, y: 28, s: 10, c: "#60a5fa" },
      { x: 40, y: 50, s: 12, c: "#60a5fa" },
      { x: 32, y: 72, s: 8, c: "#60a5fa" },
      { x: 66, y: 38, s: 9, c: "#fb923c" },
      { x: 76, y: 62, s: 11, c: "#fb923c" },
    ],
  },
];

export function LandingPage() {
  return (
    <div className="marketing-root tw-min-h-screen tw-text-[var(--text-primary)]">
      <header className="tw-mx-auto tw-flex tw-max-w-5xl tw-items-center tw-justify-between tw-px-6 tw-py-8 md:tw-px-10">
        <span className="logo">hypher</span>
        <nav className="tw-flex tw-items-center tw-gap-6">
          <Link
            href="/pricing"
            className="tw-text-sm tw-text-[var(--text-secondary)] tw-transition hover:tw-text-electric"
          >
            Pricing
          </Link>
          <SignInButton mode="modal">
            <button type="button" className="tw-border-0 tw-bg-transparent tw-px-3 tw-py-2 tw-text-sm tw-text-[var(--text-secondary)] tw-transition tw-cursor-pointer hover:tw-text-[var(--text-primary)]">
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
        <section className="marketing-hero tw-relative tw-pt-8 tw-pb-20 md:tw-pt-16 md:tw-pb-28">
          <MarketingCanvasPreview />
          <div className="tw-relative tw-z-10">
            <p className="tw-font-mono tw-text-xs tw-uppercase tw-tracking-[0.2em] tw-text-electric">Public beta</p>
            <h1 className="tw-mt-6 tw-max-w-2xl tw-font-sans tw-text-4xl tw-font-medium tw-leading-[1.1] tw-tracking-tight md:tw-text-5xl">
              Your projects, connected.
            </h1>
            <p className="tw-mt-6 tw-max-w-xl tw-text-lg tw-leading-relaxed tw-text-[var(--text-secondary)]">
              Capture anywhere. See how your work connects. Ship what matters.
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
          <p className="tw-font-mono tw-text-xs tw-uppercase tw-tracking-[0.2em] tw-text-[var(--text-tertiary)]">
            From the beta
          </p>
          <h2 className="tw-mt-4 tw-max-w-xl tw-font-sans tw-text-2xl tw-font-medium tw-tracking-tight md:tw-text-3xl">
            Canvases from solo builders using Hypher today.
          </h2>
          <div className="marketing-proof-row">
            {PROOF_CARDS.map((card, i) => (
              <article key={card.name} className={`proof-card proof-card-${i % 4}`}>
                <div className="proof-canvas" aria-hidden>
                  {card.dots.map((d, j) => (
                    <span
                      key={j}
                      className="proof-dot"
                      style={{
                        left: `${d.x}%`,
                        top: `${d.y}%`,
                        width: d.s,
                        height: d.s,
                        background: d.c,
                      }}
                    />
                  ))}
                </div>
                <blockquote className="proof-quote">"{card.quote}"</blockquote>
                <footer className="proof-meta">
                  <span className="proof-name">{card.name}</span>
                  <span className="proof-role">{card.role}</span>
                </footer>
              </article>
            ))}
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
