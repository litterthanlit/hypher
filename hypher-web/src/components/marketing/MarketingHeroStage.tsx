"use client";

import { useState } from "react";

const ARTIFACTS = [
  {
    id: "dump",
    kind: "dump",
    title: "shipped the gate",
    body: "empty state still broken. don't widen oauth. cursor has the brief.",
    href: "/app",
  },
  {
    id: "note",
    kind: "the note",
    title: "don't widen oauth.",
    body: "one note. that's what they read.",
    href: "/app",
  },
  {
    id: "writeback",
    kind: "what they wrote back",
    title: "gate is in",
    body: "tokens hashed. events scoped.",
    href: "/app",
  },
] as const;

export function MarketingHeroStage() {
  const [activeId, setActiveId] = useState<(typeof ARTIFACTS)[number]["id"]>("note");
  const active = ARTIFACTS.find((item) => item.id === activeId) ?? ARTIFACTS[1];

  return (
    <div className="marketing-hero-stage" aria-label="dump at top. the note. what they wrote back.">
      <div className="marketing-hero-stage__grain" aria-hidden />

      <div className="marketing-hero-stage__stack">
        {ARTIFACTS.map((item) => {
          const selected = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              className={`marketing-artifact${selected ? " is-active" : ""}`}
              aria-pressed={selected}
              onClick={() => setActiveId(item.id)}
            >
              <span className="marketing-artifact__kind">{item.kind}</span>
              <span className="marketing-artifact__title">{item.title}</span>
              {selected ? <span className="marketing-artifact__body">{item.body}</span> : null}
            </button>
          );
        })}
      </div>

      <div className="marketing-hero-stage__dock">
        <a href={active.href} className="marketing-cta marketing-cta--on-dark">
          dump yours
        </a>
      </div>
    </div>
  );
}
