import { describe, expect, it, vi } from "vitest";
import type { AnyObject, Connection, Note, Project } from "../src/types";
import {
  buildCaptureMetadata,
  enrichCapture,
  inferCaptureTitle,
  normalizeCaptureInput,
  prepareCaptureObject,
  safeEnrichCapture,
  suggestProjectForCapture,
} from "./capture";

function project(id: string, embedding: number[] = [1, 0]): Project {
  return {
    id,
    kind: "project",
    name: id,
    description: "",
    status: "active",
    createdAt: 1,
    modifiedAt: 1,
    embedding,
  };
}

function note(id: string, content = `note ${id}`, embedding?: number[]): Note {
  return {
    id,
    kind: "note",
    content,
    maturity: "fleeting",
    createdAt: 1,
    modifiedAt: 1,
    ...(embedding ? { embedding } : {}),
  };
}

describe("normalizeCaptureInput", () => {
  it("normalizes basic text capture from content/text/q aliases", () => {
    expect(normalizeCaptureInput({ content: "  Ship it  " })).toEqual({
      ok: true,
      content: "Ship it",
      projectId: null,
      tags: undefined,
    });
    expect(normalizeCaptureInput({ text: "From text" })).toMatchObject({ ok: true, content: "From text" });
    expect(normalizeCaptureInput({ q: "From q" })).toMatchObject({ ok: true, content: "From q" });
  });

  it("rejects empty content and invalid route project ids", () => {
    expect(normalizeCaptureInput({ content: "   " })).toEqual({
      ok: false,
      error: "content_required",
    });
    expect(normalizeCaptureInput({ content: "x", projectId: "bad id" })).toEqual({
      ok: false,
      error: "invalid_project",
    });
  });

  it("normalizes route tags strictly and API tags permissively", () => {
    expect(normalizeCaptureInput({ content: "x", tags: " alpha, beta " })).toEqual({
      ok: true,
      content: "x",
      projectId: null,
      tags: ["alpha", "beta"],
    });
    expect(normalizeCaptureInput({
      content: "x",
      tags: Array.from({ length: 11 }, (_, index) => `tag-${index}`),
    })).toEqual({ ok: false, error: "too_many_tags" });
    expect(normalizeCaptureInput({
      content: "x",
      tags: ["keep", 1, "also-keep", "extra"],
      tagMode: "api",
      maxTags: 2,
      validateProjectId: false,
    })).toEqual({
      ok: true,
      content: "x",
      projectId: null,
      tags: ["keep", "also-keep"],
    });
  });
});

describe("capture metadata", () => {
  it("infers a compact title from the first content line", () => {
    expect(inferCaptureTitle("  First line is clear\nSecond line")).toBe("First line is clear");
    expect(inferCaptureTitle("abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJK")).toBe("abcdefghijklmnopqrstuvwxyz1234567890ABCD\u2026");
  });

  it("builds client capture metadata without changing legacy route defaults", () => {
    expect(buildCaptureMetadata({
      content: "Bug: the capture route fails",
      projectId: "project-1",
      now: 123,
      includeClientFields: true,
    })).toMatchObject({
      maturity: "fleeting",
      source: "manual",
      captureType: "bug",
      captureStatus: "sorted",
      confirmedProjectId: "project-1",
      reviewedAt: 123,
    });

    expect(buildCaptureMetadata({
      content: "Bug: the capture route fails",
      projectId: "project-1",
      now: 123,
      includeClientFields: false,
    })).toEqual({
      maturity: "fleeting",
      createdAt: 123,
      modifiedAt: 123,
      projectId: "project-1",
      reviewedAt: 123,
    });

    expect(buildCaptureMetadata({
      content: "Captured through API",
      projectId: "project-1",
      now: 123,
      includeClientFields: false,
      markReviewedOnProject: false,
    })).toEqual({
      maturity: "fleeting",
      createdAt: 123,
      modifiedAt: 123,
      projectId: "project-1",
    });
  });

  it("prepares note objects for client and route/store parity", () => {
    const client = prepareCaptureObject({
      id: "note-1",
      content: "Need to implement capture parity",
      projectId: null,
      now: 123,
      includeClientFields: true,
    });
    const route = prepareCaptureObject({
      id: "note-2",
      content: "Need to implement capture parity",
      projectId: null,
      now: 123,
      includeClientFields: false,
    });

    expect(client).toMatchObject({
      id: "note-1",
      kind: "note",
      content: "Need to implement capture parity",
      maturity: "fleeting",
      captureStatus: "unsorted",
      captureType: "task",
      source: "manual",
    });
    expect(route).toMatchObject({
      id: "note-2",
      kind: "note",
      content: "Need to implement capture parity",
      maturity: "fleeting",
    });
    expect(route).not.toHaveProperty("captureStatus");
  });
});

describe("capture enrichment", () => {
  it("suggests a project only for embedded unassigned captures", () => {
    const captured = note("captured", "Match launch", [1, 0]);
    const result = suggestProjectForCapture({
      capture: captured,
      allObjects: [captured, project("Launch", [1, 0])],
      projectId: null,
      suggestProjects: (capture, allObjects) => [{
        projectId: allObjects[1]!.id,
        projectName: "Launch",
        confidence: capture.embedding?.[0] ?? 0,
        reason: "Matches the project",
      }],
    });

    expect(result[0]).toMatchObject({ projectId: "Launch", confidence: 1 });
    expect(suggestProjectForCapture({
      capture: { ...captured, embedding: undefined },
      allObjects: [],
      projectId: null,
      suggestProjects: vi.fn(),
    })).toEqual([]);
    expect(suggestProjectForCapture({
      capture: captured,
      allObjects: [],
      projectId: "already-assigned",
      suggestProjects: vi.fn(),
    })).toEqual([]);
  });

  it("enriches capture with embedding, generated tags, suggestions, and connections", async () => {
    const created = note("created", "Need useful tags");
    const existing = note("existing", "Related note", [1, 0]);
    const existingConnections: Connection[] = [];

    const result = await enrichCapture({
      capture: created,
      allObjects: [existing],
      connections: existingConnections,
      embedCapture: async (capture) => ({ ...capture, embedding: [1, 0], embeddingText: capture.content, modifiedAt: 456 }),
      generateTags: async () => ["capture", "flow"],
      suggestProjects: () => [{ projectId: "project-1", projectName: "Project", confidence: 0.8, reason: "Matches" }],
      computeConnections: (allObjects: AnyObject[]) => [{
        sourceId: allObjects[0]!.id,
        targetId: allObjects[1]!.id,
        sourceKind: "note",
        targetKind: "note",
        type: "ai_suggested",
        confidence: 0.9,
        reason: "Related",
        createdAt: 456,
      }],
    });

    expect(result.enriched).toBe(true);
    expect(result.capture).toMatchObject({
      id: "created",
      embedding: [1, 0],
      embeddingText: "Need useful tags",
      tags: ["capture", "flow"],
    });
    expect(result.suggestions).toHaveLength(1);
    expect(result.connectionsToCreate).toHaveLength(1);
  });

  it("returns a non-enriched fallback when enrichment fails", async () => {
    const fallback = await safeEnrichCapture(() => {
      throw new Error("model unavailable");
    });

    expect(fallback).toEqual({ enriched: false, suggestions: [], connectionsToCreate: [] });
  });
});
