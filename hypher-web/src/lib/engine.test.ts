import { describe, it, expect, vi } from "vitest";

// Mock the embeddings module so @huggingface/transformers is never loaded in Node.
// suggestRelatedOnDrop only uses cosineSimilarity from this module; the mock
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

import { suggestRelatedOnDrop } from "./engine";
import type { AnyObject, Note, Project } from "@/types";

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

function makeProject(id: string, x: number, y: number): Project {
  return {
    id,
    kind: "project",
    name: id,
    description: "",
    status: "active",
    createdAt: 0,
    modifiedAt: 0,
    canvasPosition: { x, y },
    embedding: unitVec(), // has embedding — but kind===project so must be skipped
  } as Project;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("suggestRelatedOnDrop", () => {
  // (a) returns candidates within radius AND above threshold
  it("returns candidate ids within 600px radius and similarity ≥ 0.7", () => {
    const dropped = makeNote("dropped", 0, 0, unitVec());
    const near = makeNote("near", 100, 0, unitVec()); // sim = 1.0, d ≈ 100px
    const result = suggestRelatedOnDrop(dropped, [dropped, near]);
    expect(result.candidateIds).toContain("near");
    expect(result.candidateIds).not.toContain("dropped");
  });

  // (b) filters out distance > 600px
  it("excludes notes further than 600px even if similarity is high", () => {
    const dropped = makeNote("dropped", 0, 0, unitVec());
    const far = makeNote("far", 700, 0, unitVec()); // d = 700px > 600px
    const result = suggestRelatedOnDrop(dropped, [dropped, far]);
    expect(result.candidateIds).toHaveLength(0);
  });

  // (c) filters out similarity < 0.7
  it("excludes notes with cosine similarity below 0.7", () => {
    const dropped = makeNote("dropped", 0, 0, unitVec());
    // orthogonal vector: cosine sim = 0.0 < 0.7
    const lowSim = makeNote("low", 50, 0, orthogonalVec());
    const result = suggestRelatedOnDrop(dropped, [dropped, lowSim]);
    expect(result.candidateIds).toHaveLength(0);
  });

  // (c) boundary: similarity exactly at threshold (≥ 0.7 should be included)
  it("includes a note whose cosine similarity is exactly 0.707 (≥ 0.7)", () => {
    const dropped = makeNote("dropped", 0, 0, unitVec());
    // midVec has sim ≈ 0.707 with unitVec
    const boundary = makeNote("boundary", 50, 0, midVec());
    const result = suggestRelatedOnDrop(dropped, [dropped, boundary]);
    expect(result.candidateIds).toContain("boundary");
  });

  // (d) filters out self
  it("excludes the dropped note itself", () => {
    const dropped = makeNote("dropped", 0, 0, unitVec());
    const result = suggestRelatedOnDrop(dropped, [dropped]);
    expect(result.candidateIds).not.toContain("dropped");
  });

  // (e) filters out projects
  it("excludes project objects even when within radius and similar", () => {
    const dropped = makeNote("dropped", 0, 0, unitVec());
    const proj = makeProject("proj", 50, 0); // kind === "project"
    const result = suggestRelatedOnDrop(dropped, [dropped, proj]);
    expect(result.candidateIds).toHaveLength(0);
  });

  // (f) filters out items without embedding
  it("excludes notes missing an embedding", () => {
    const dropped = makeNote("dropped", 0, 0, unitVec());
    const noEmbed = makeNote("noEmbed", 50, 0 /* no embedding arg */);
    const result = suggestRelatedOnDrop(dropped, [dropped, noEmbed]);
    expect(result.candidateIds).toHaveLength(0);
  });

  // Additional: dropped note without embedding → empty result
  it("returns empty when the dropped note has no embedding", () => {
    const dropped = makeNote("dropped", 0, 0 /* no embedding */);
    const near = makeNote("near", 50, 0, unitVec());
    const result = suggestRelatedOnDrop(dropped, [dropped, near]);
    expect(result.candidateIds).toHaveLength(0);
  });

  // Additional: dropped note with wrong kind → empty result
  it("returns empty when the dropped object is not a note", () => {
    const dropped = makeProject("proj", 0, 0) as AnyObject;
    const near = makeNote("near", 50, 0, unitVec());
    const result = suggestRelatedOnDrop(dropped, [dropped as AnyObject, near]);
    expect(result.candidateIds).toHaveLength(0);
  });

  // Additional: results sorted by similarity descending
  it("returns candidateIds sorted by similarity descending", () => {
    const dropped = makeNote("dropped", 0, 0, unitVec());
    // mid: sim ≈ 0.707, also within radius
    const mid = makeNote("mid", 50, 0, midVec());
    // high: sim = 1.0, within radius
    const high = makeNote("high", 80, 0, unitVec());
    const result = suggestRelatedOnDrop(dropped, [dropped, mid, high]);
    expect(result.candidateIds[0]).toBe("high");
    expect(result.candidateIds[1]).toBe("mid");
  });

  // Additional: topReason reflects closest match
  it("populates topReason with the name and similarity of the best match", () => {
    const dropped = makeNote("dropped", 0, 0, unitVec());
    const best = makeNote("Best note content here", 50, 0, unitVec());
    const result = suggestRelatedOnDrop(dropped, [dropped, best]);
    expect(result.topReason).toMatch(/100%/);
  });
});
