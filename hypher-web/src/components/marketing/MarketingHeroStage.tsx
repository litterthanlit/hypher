"use client";

import { useState } from "react";

const PACKETS = [
  {
    id: "context",
    kind: "Context in",
    title: "Don't widen OAuth.",
    body: "Shipped the gate. Empty state still broken. Pulse stays three panels.",
  },
  {
    id: "brief",
    kind: "The note",
    title: "Builder Brief",
    body: "Direction: close the loop. Constraint: don't widen OAuth. Next: session hooks.",
  },
  {
    id: "writeback",
    kind: "Writeback",
    title: "Gate is in.",
    body: "Tokens hashed. Events scoped. Session two already knows.",
  },
] as const;

export function MarketingHeroStage() {
  const [activeId, setActiveId] = useState<(typeof PACKETS)[number]["id"]>("brief");
  const active = PACKETS.find((item) => item.id === activeId) ?? PACKETS[1];

  return (
    <div className="marketing-hero-stage">
      <figure className="marketing-hero-stage__well">
        <img
          className="marketing-hero-stage__field"
          src="/brand/hypher-field.jpg"
          alt="hypher lockup in a field of blue light"
          width={1024}
          height={560}
          fetchPriority="high"
        />
      </figure>

      <div className="marketing-hero-stage__packet" aria-label="The loop as one note">
        <div className="marketing-hero-stage__tabs" role="tablist" aria-label="The loop">
          {PACKETS.map((item) => {
            const selected = item.id === activeId;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                className={`marketing-hero-tab${selected ? " is-active" : ""}`}
                onClick={() => setActiveId(item.id)}
              >
                {item.kind}
              </button>
            );
          })}
        </div>
        <p className="marketing-hero-stage__kicker">{active.kind}</p>
        <p className="marketing-hero-stage__title">{active.title}</p>
        <p className="marketing-hero-stage__body">{active.body}</p>
      </div>
    </div>
  );
}
