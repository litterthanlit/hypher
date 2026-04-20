"use client";

import { useMemo } from "react";
import { FloatingClusters } from "@/components/FloatingClusters";
import type { Project, Note, Artifact, AnyObject } from "@/types";

const MOCK_PROJECTS: Array<Pick<Project, "id" | "name" | "canvasColor">> = [
  { id: "p-ship", name: "Ship v1", canvasColor: "#88bba2" },
  { id: "p-write", name: "Essays", canvasColor: "#60a5fa" },
  { id: "p-indie", name: "indie-io", canvasColor: "#fbbf24" },
  { id: "p-think", name: "Second brain", canvasColor: "#a78bfa" },
  { id: "p-side", name: "Side quest", canvasColor: "#f472b6" },
  { id: "p-meta", name: "Hypher meta", canvasColor: "#34d399" },
];

const ITEMS_PER_PROJECT = [7, 5, 6, 4, 5, 6];

function buildSeedData(): { projects: Project[]; allObjects: AnyObject[] } {
  const now = Date.now();
  const projects: Project[] = MOCK_PROJECTS.map((p) => ({
    id: p.id,
    kind: "project",
    name: p.name,
    description: "",
    status: "active",
    canvasColor: p.canvasColor,
    createdAt: now,
    modifiedAt: now,
  }));

  const allObjects: AnyObject[] = [...projects];
  MOCK_PROJECTS.forEach((p, pi) => {
    const count = ITEMS_PER_PROJECT[pi] ?? 5;
    for (let i = 0; i < count; i++) {
      const isArtifact = i % 4 === 3;
      if (isArtifact) {
        const a: Artifact = {
          id: `${p.id}-a-${i}`,
          kind: "artifact",
          name: `file-${i}`,
          type: "document",
          projectId: p.id,
          createdAt: now,
          modifiedAt: now,
        };
        allObjects.push(a);
      } else {
        const n: Note = {
          id: `${p.id}-n-${i}`,
          kind: "note",
          content: `seed ${i}`,
          maturity: "fleeting",
          projectId: p.id,
          createdAt: now,
          modifiedAt: now,
        };
        allObjects.push(n);
      }
    }
  });

  return { projects, allObjects };
}

export function MarketingCanvasPreview() {
  const { projects, allObjects } = useMemo(buildSeedData, []);

  return (
    <div className="marketing-canvas-preview" aria-hidden>
      <FloatingClusters
        projects={projects}
        allObjects={allObjects}
        inputText=""
        onProjectClick={() => {}}
      />
    </div>
  );
}
