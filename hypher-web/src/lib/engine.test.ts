import { describe, it, expect, vi } from "vitest";

// Mock the embeddings module so @huggingface/transformers is never loaded in Node.
// Remaining tests only use cosineSimilarity from this module; the mock
// provides the real math implementation so tests remain meaningful.
vi.mock("./embeddings", () => ({
  embed: vi.fn().mockResolvedValue([]),
  isLoading: vi.fn().mockReturnValue(false),
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i]! * b[i]!;
      magA += a[i]! * a[i]!;
      magB += b[i]! * b[i]!;
    }
    const denom = Math.sqrt(magA) * Math.sqrt(magB);
    return denom === 0 ? 0 : dot / denom;
  },
}));

import {
  computeSuggestionsForObject,
  generateEmbedding,
  suggestProjectFromData,
} from "./engine";
import type { Note, Project } from "@/types";

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Unit vector of length `dim` pointing in the first dimension — cosine sim
 *  against another such vector is exactly 1.0 (identical direction). */
function unitVec(dim = 4): number[] {
  const v = new Array(dim).fill(0);
  v[0] = 1;
  return v;
}

/** Vector pointing in the second dimension — orthogonal to unitVec().
 *  cosine sim vs unitVec = 0.0. */
function orthogonalVec(dim = 4): number[] {
  const v = new Array(dim).fill(0);
  v[1] = 1;
  return v;
}

/** Vector at 45° between unitVec and orthogonalVec — cosine sim ≈ 0.707. */
function midVec(dim = 4): number[] {
  const v = new Array(dim).fill(0);
  v[0] = 1;
  v[1] = 1;
  return v; // cosineSimilarity normalises, so magnitude doesn't matter
}

function makeNote(
  id: string,
  x: number,
  y: number,
  embedding?: number[],
): Note {
  return {
    id,
    kind: "note",
    content: `content of ${id}`,
    maturity: "fleeting",
    createdAt: 0,
    modifiedAt: 0,
    canvasPosition: { x, y },
    ...(embedding ? { embedding } : {}),
  } as Note;
}

function makeProjectWithEmbedding(id: string, embedding: number[]): Project {
  return {
    id,
    kind: "project",
    name: id,
    description: "",
    status: "active",
    createdAt: 0,
    modifiedAt: 0,
    embedding,
  } as Project;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("suggestProjectFromData", () => {
  it("suggests a project when the captured note matches project metadata", () => {
    const captured = makeNote("captured", 0, 0, unitVec());
    const project = makeProjectWithEmbedding("Launch Site", unitVec());

    const result = suggestProjectFromData(captured, [captured, project]);

    expect(result[0]).toMatchObject({
      projectId: "Launch Site",
      projectName: "Launch Site",
      confidence: 1,
    });
    expect(result[0]?.reason).toMatch(/Matches the project/);
  });

  it("suggests a project when the captured note matches an existing child note", () => {
    const captured = makeNote("captured", 0, 0, unitVec());
    const project = makeProjectWithEmbedding("Onboarding", orthogonalVec());
    const child = {
      ...makeNote("Welcome flow", 0, 0, unitVec()),
      projectId: project.id,
    };

    const result = suggestProjectFromData(captured, [captured, project, child]);

    expect(result[0]?.projectId).toBe("Onboarding");
    expect(result[0]?.confidence).toBe(1);
    expect(result[0]?.reason).toMatch(/Related to/);
    expect(result[0]?.reason).toMatch(/Welcome flow/);
  });

  it("lets a strong child match outrank weak project metadata", () => {
    const captured = makeNote("captured", 0, 0, unitVec());
    const strongChildProject = makeProjectWithEmbedding("Weak metadata", midVec());
    const strongChild = {
      ...makeNote("Strong child", 0, 0, unitVec()),
      projectId: strongChildProject.id,
    };
    const metadataProject = makeProjectWithEmbedding("Metadata only", midVec());

    const result = suggestProjectFromData(captured, [
      captured,
      strongChildProject,
      strongChild,
      metadataProject,
    ]);

    expect(result[0]?.projectId).toBe("Weak metadata");
    expect(result[0]?.confidence).toBe(1);
    expect(result[1]?.projectId).toBe("Metadata only");
  });

  it("returns the top 3 project suggestions sorted by confidence", () => {
    const captured = makeNote("captured", 0, 0, unitVec());
    const first = makeProjectWithEmbedding("first", unitVec());
    const second = makeProjectWithEmbedding("second", midVec());
    const third = makeProjectWithEmbedding("third", [0.5, Math.sqrt(0.75), 0, 0]);
    const fourth = makeProjectWithEmbedding("fourth", [0.4, Math.sqrt(0.84), 0, 0]);

    const result = suggestProjectFromData(captured, [
      captured,
      fourth,
      third,
      first,
      second,
    ]);

    expect(result.map((r) => r.projectId)).toEqual(["first", "second", "third"]);
  });

  it("uses metadata and child reason text for the winning source", () => {
    const captured = makeNote("captured", 0, 0, unitVec());
    const metadataProject = makeProjectWithEmbedding("Metadata", unitVec());
    const childProject = makeProjectWithEmbedding("Child", orthogonalVec());
    const child = {
      ...makeNote("Specific child", 0, 0, unitVec()),
      projectId: childProject.id,
    };

    const result = suggestProjectFromData(captured, [
      captured,
      metadataProject,
      childProject,
      child,
    ]);

    const metadataSuggestion = result.find((r) => r.projectId === "Metadata");
    const childSuggestion = result.find((r) => r.projectId === "Child");

    expect(metadataSuggestion?.reason).toMatch(/Matches the project/);
    expect(childSuggestion?.reason).toMatch(/Related to/);
  });
});

describe("generateEmbedding", () => {
  it("uses the injected embedding provider boundary", async () => {
    const source = makeNote("note", 0, 0);
    const provider = {
      embed: vi.fn().mockResolvedValue([0.25, 0.75]),
    };

    const result = await generateEmbedding(source, provider);

    expect(provider.embed).toHaveBeenCalledWith("content of note");
    expect(result).toMatchObject({
      id: "note",
      embedding: [0.25, 0.75],
      embeddingText: "content of note",
    });
  });
});

describe("computeSuggestionsForObject", () => {
  it("compares one changed object against candidates without candidate-to-candidate suggestions", () => {
    const changed = makeNote("changed", 0, 0, orthogonalVec());
    const firstCandidate = makeNote("candidate-a", 0, 0, unitVec());
    const secondCandidate = makeNote("candidate-b", 0, 0, unitVec());

    const result = computeSuggestionsForObject(
      changed,
      [firstCandidate, secondCandidate],
      []
    );

    expect(result).toEqual([]);
  });
});
