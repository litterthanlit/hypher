"use client";

import { useState } from "react";

const PACKETS = [
  {
    id: "context",
    kind: "context in",
    title: "don't widen oauth.",
    body: "shipped the gate. empty state still broken. pulse stays three panels.",
  },
  {
    id: "brief",
    kind: "the note",
    title: "Builder Brief",
    body: "Direction: close the loop. Constraint: don't widen OAuth. Next: session hooks.",
  },
  {
    id: "writeback",
    kind: "writeback",
    title: "gate is in",
    body: "tokens hashed. events scoped. session 2 already knows.",
  },
] as const;

export function MarketingHeroStage() {
  const [activeId, setActiveId] = useState<(typeof PACKETS)[number]["id"]>("brief");
  const active = PACKETS.find((item) => item.id === activeId) ?? PACKETS[1];

  return (
    <figure className="marketing-hero-stage">
      <div className="marketing-hero-stage__glow" aria-hidden />
      <img
        className="marketing-hero-stage__field"
        src="/brand/hypher-field.jpg"
        alt=""
        width={1024}
        height={560}
      />
      <figcaption className="sr-only">
        Hypher lockup in a field of blue light: context in, one note, writeback.
      </figcaption>

      <div className="marketing-hero-stage__packet" aria-label="The loop as one note">
        <p className="marketing-hero-stage__kicker">{active.kind}</p>
        <p className="marketing-hero-stage__title">{active.title}</p>
        <p className="marketing-hero-stage__body">{active.body}</p>
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
      </div>
    </figure>
  );
}
