"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { MarketingBrand } from "./MarketingBrand";

type PreviewArtifactId =
  | "capture"
  | "hypher-beta"
  | "onboarding-spec"
  | "pr-25"
  | "builder-brief"
  | "writeback"
  | "marque"
  | "studio";

type PreviewCta = {
  label: "Request beta" | "See the loop";
  href: "/beta/request" | "#the-loop";
};

type PreviewArtifact = {
  id: PreviewArtifactId;
  title: string;
  kind: string;
  lines: [string, string] | [string, string, string] | [string, string, string, string];
  cta: PreviewCta;
};

const ARTIFACTS: Record<PreviewArtifactId, PreviewArtifact> = {
  capture: {
    id: "capture",
    title: "Capture",
    kind: "capture",
    lines: [
      "Dump a thought, bug, decision, or agent output.",
      "Hypher files it into project memory so the next Builder Brief is hotter than the last.",
    ],
    cta: { label: "Request beta", href: "/beta/request" },
  },
  "hypher-beta": {
    id: "hypher-beta",
    title: "hypher beta launch",
    kind: "project memory",
    lines: [
      "Env-var punch list in progress. Onboarding spec queued.",
      "Voice-capture decision pending. Stay single-threaded through invite review.",
    ],
    cta: { label: "See the loop", href: "#the-loop" },
  },
  "onboarding-spec": {
    id: "onboarding-spec",
    title: "05-onboarding-flow-spec.md",
    kind: "document",
    lines: [
      "Welcome overlay plus tour steps. Skip path for returning users.",
      "First pulse should land before anyone hunts for a canvas.",
    ],
    cta: { label: "Request beta", href: "/beta/request" },
  },
  "pr-25": {
    id: "pr-25",
    title: "PR #25 — Ambient Ask (merged)",
    kind: "code",
    lines: [
      "Ambient Ask uses canvas-center context and ships with follow-up chips.",
      "Merged. Writeback accepted into project memory.",
    ],
    cta: { label: "See the loop", href: "#the-loop" },
  },
  "builder-brief": {
    id: "builder-brief",
    title: "Builder Brief — hypher beta launch",
    kind: "builder brief",
    lines: [
      "Current goal: ship invite review without splitting threads.",
      "Copy this packet into Cursor. Do not invent a new surface — use Capture Home.",
    ],
    cta: { label: "See the loop", href: "#the-loop" },
  },
  writeback: {
    id: "writeback",
    title: "Agent writeback — Ambient Ask",
    kind: "writeback",
    lines: [
      "Cursor returned: dock plus context chips shipped.",
      "Accepted into memory. The next brief will cite this as recent progress.",
    ],
    cta: { label: "See the loop", href: "#the-loop" },
  },
  marque: {
    id: "marque",
    title: "marque — brand system",
    kind: "project",
    lines: [
      "Tokens, spacing, and component states for the beta shell.",
      "Wordmark XOR signal mark. Never both in one lockup.",
    ],
    cta: { label: "Request beta", href: "/beta/request" },
  },
  studio: {
    id: "studio",
    title: "studio site v3",
    kind: "project",
    lines: [
      "Nine items. Last session left a Builder Brief for the homepage rewrite.",
      "Agent writeback still pending review.",
    ],
    cta: { label: "See the loop", href: "#the-loop" },
  },
};

function classNames(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function MarketingProductVisual() {
  const [selectedId, setSelectedId] = useState<PreviewArtifactId | null>(null);
  const inspectorRef = useRef<HTMLDivElement>(null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);

  const selected = selectedId ? ARTIFACTS[selectedId] : null;

  const closeInspector = useCallback(() => {
    setSelectedId(null);
    lastTriggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      wasOpenRef.current = false;
      return;
    }

    if (!wasOpenRef.current) {
      inspectorRef.current?.focus();
    }
    wasOpenRef.current = true;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeInspector();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedId, closeInspector]);

  function selectArtifact(id: PreviewArtifactId, trigger: HTMLElement) {
    lastTriggerRef.current = trigger;
    setSelectedId(id);
  }

  return (
    <div
      className="marketing-product-visual"
      role="region"
      aria-label="Product preview: capture home with project memory"
    >
      <div className="marketing-app-preview">
        <div className="marketing-app-preview__chrome">
          <MarketingBrand variant="lockup" size="sm" className="marketing-app-preview__brand" />
          <span className="marketing-app-preview__dots" aria-hidden>
            <span className="marketing-app-preview__icon">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <circle cx="7" cy="7" r="5" />
                <line x1="11" y1="11" x2="14" y2="14" />
              </svg>
            </span>
            <span className="marketing-app-preview__icon">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3.5 6a4.5 4.5 0 0 1 9 0v3l1.5 2.5H2L3.5 9V6z" />
                <path d="M6 12.5a2 2 0 0 0 4 0" />
              </svg>
            </span>
            <span className="marketing-app-preview__avatar">NK</span>
          </span>
        </div>

        <div className="marketing-app-preview__hero">
          <p className="marketing-app-preview__greeting">Friday afternoon, Nick</p>
          <h2 className="marketing-app-preview__title">Stay single-threaded.</h2>
          <div className="marketing-app-preview__input">
            <button
              type="button"
              className={classNames(
                "marketing-app-preview__field",
                selectedId === "capture" && "is-selected"
              )}
              aria-expanded={selectedId === "capture"}
              aria-controls={selected ? "marketing-preview-inspector" : undefined}
              onClick={(event) => selectArtifact("capture", event.currentTarget)}
            >
              dump a thought, bug, decision, or agent output...
              <span className="marketing-app-preview__plus" aria-hidden>
                +
              </span>
            </button>
          </div>
          <p className="marketing-app-preview__quick">
            <button
              type="button"
              className="marketing-app-preview__quick-btn"
              onClick={(event) => selectArtifact("capture", event.currentTarget)}
            >
              paste from clipboard
            </button>
            <button
              type="button"
              className="marketing-app-preview__quick-btn"
              onClick={(event) => selectArtifact("onboarding-spec", event.currentTarget)}
            >
              upload file
            </button>
            <button
              type="button"
              className="marketing-app-preview__quick-btn"
              onClick={(event) => selectArtifact("builder-brief", event.currentTarget)}
            >
              import from notion
            </button>
          </p>
        </div>

        {selected ? (
          <div
            ref={inspectorRef}
            id="marketing-preview-inspector"
            className="marketing-app-preview__inspector"
            role="dialog"
            aria-modal="false"
            aria-labelledby="marketing-preview-inspector-title"
            aria-describedby="marketing-preview-inspector-body"
            tabIndex={-1}
          >
            <div className="marketing-app-preview__inspector-bar">
              <p className="marketing-app-preview__inspector-kind">{selected.kind}</p>
              <button
                type="button"
                className="marketing-app-preview__inspector-close"
                aria-label="Close artifact"
                onClick={closeInspector}
              >
                <span aria-hidden>×</span>
              </button>
            </div>
            <h3 id="marketing-preview-inspector-title" className="marketing-app-preview__inspector-title">
              {selected.title}
            </h3>
            <div id="marketing-preview-inspector-body" className="marketing-app-preview__inspector-body">
              {selected.lines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
            <Link href={selected.cta.href} className="marketing-app-preview__inspector-cta">
              {selected.cta.label}
            </Link>
          </div>
        ) : null}

        <div className="marketing-app-preview__projects">
          <article
            className={classNames(
              "marketing-app-preview__card",
              "marketing-app-preview__card--primary",
              selectedId === "hypher-beta" && "is-selected"
            )}
          >
            <button
              type="button"
              className="marketing-app-preview__hit"
              aria-pressed={selectedId === "hypher-beta"}
              aria-controls={selected ? "marketing-preview-inspector" : undefined}
              onClick={(event) => selectArtifact("hypher-beta", event.currentTarget)}
            >
              <span className="marketing-app-preview__card-name">hypher beta launch</span>
              <span className="marketing-app-preview__card-body">
                Env-var punch list in progress. Onboarding spec queued. Voice-capture decision pending.
              </span>
            </button>
            <ul className="marketing-app-preview__items">
              <li>
                <button
                  type="button"
                  className={classNames(
                    "marketing-app-preview__item",
                    selectedId === "onboarding-spec" && "is-selected"
                  )}
                  aria-pressed={selectedId === "onboarding-spec"}
                  onClick={(event) => selectArtifact("onboarding-spec", event.currentTarget)}
                >
                  05-onboarding-flow-spec.md
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={classNames(
                    "marketing-app-preview__item",
                    selectedId === "pr-25" && "is-selected"
                  )}
                  aria-pressed={selectedId === "pr-25"}
                  onClick={(event) => selectArtifact("pr-25", event.currentTarget)}
                >
                  PR #25 — Ambient Ask (merged)
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={classNames(
                    "marketing-app-preview__item",
                    selectedId === "builder-brief" && "is-selected"
                  )}
                  aria-pressed={selectedId === "builder-brief"}
                  onClick={(event) => selectArtifact("builder-brief", event.currentTarget)}
                >
                  Builder Brief — Cursor packet
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={classNames(
                    "marketing-app-preview__item",
                    selectedId === "writeback" && "is-selected"
                  )}
                  aria-pressed={selectedId === "writeback"}
                  onClick={(event) => selectArtifact("writeback", event.currentTarget)}
                >
                  Writeback — Ambient Ask accepted
                </button>
              </li>
            </ul>
            <p className="marketing-app-preview__card-meta">14 items · edited 12m ago</p>
          </article>

          <button
            type="button"
            className={classNames(
              "marketing-app-preview__card",
              selectedId === "marque" && "is-selected"
            )}
            aria-pressed={selectedId === "marque"}
            onClick={(event) => selectArtifact("marque", event.currentTarget)}
          >
            <span className="marketing-app-preview__card-name">marque — brand system</span>
            <span className="marketing-app-preview__card-meta">28 items · 2d ago</span>
          </button>

          <button
            type="button"
            className={classNames(
              "marketing-app-preview__card",
              selectedId === "studio" && "is-selected"
            )}
            aria-pressed={selectedId === "studio"}
            onClick={(event) => selectArtifact("studio", event.currentTarget)}
          >
            <span className="marketing-app-preview__card-name">studio site v3</span>
            <span className="marketing-app-preview__card-meta">9 items · yesterday</span>
          </button>
        </div>
      </div>
    </div>
  );
}
