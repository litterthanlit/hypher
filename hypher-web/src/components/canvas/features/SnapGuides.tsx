"use client";

import type { SnapGuide } from "./useSnapGuides";

interface Props {
  guides: SnapGuide[];
}

export function SnapGuides({ guides }: Props) {
  if (guides.length === 0) return null;
  return (
    <>
      {guides.map((guide, i) => (
        guide.axis === "x" ? (
          <line
            key={`guide-${i}`}
            className="snap-guide visible"
            x1={guide.position}
            y1={-10000}
            x2={guide.position}
            y2={10000}
          />
        ) : (
          <line
            key={`guide-${i}`}
            className="snap-guide visible"
            x1={-10000}
            y1={guide.position}
            x2={10000}
            y2={guide.position}
          />
        )
      ))}
    </>
  );
}
