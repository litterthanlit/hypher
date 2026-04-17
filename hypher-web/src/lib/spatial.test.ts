import { describe, it, expect } from "vitest";
import { computeNearby } from "./spatial";
import type { AnyObject } from "@/types";

// Helper: make a minimal Note at (x, y)
function note(id: string, x: number, y: number): AnyObject {
  return {
    id,
    kind: "note",
    content: `content of ${id}`,
    maturity: "fleeting",
    createdAt: 0,
    modifiedAt: 0,
    canvasPosition: { x, y },
  } as AnyObject;
}

function project(id: string, x: number, y: number): AnyObject {
  return {
    id,
    kind: "project",
    name: id,
    description: "",
    status: "active",
    createdAt: 0,
    modifiedAt: 0,
    canvasPosition: { x, y },
  } as AnyObject;
}

describe("computeNearby", () => {
  it("returns closest notes sorted by distance (happy path)", () => {
    const items: AnyObject[] = [
      note("far", 2000, 0),
      note("mid", 500, 0),
      note("near", 100, 0),
    ];
    const result = computeNearby(items, 0, 0);
    expect(result.map((o) => o.id)).toEqual(["near", "mid"]);
    // "far" (2000px) is outside default 1500px radius
  });

  it("returns empty array when no items are within maxRadius", () => {
    const items: AnyObject[] = [
      note("a", 2000, 0),
      note("b", 0, 2000),
    ];
    const result = computeNearby(items, 0, 0);
    expect(result).toHaveLength(0);
  });

  it("excludes projects from results", () => {
    const items: AnyObject[] = [
      project("p1", 10, 10),
      note("n1", 20, 20),
    ];
    const result = computeNearby(items, 0, 0);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("n1");
  });

  it("returns at most k items (top-k ordering)", () => {
    const items: AnyObject[] = Array.from({ length: 10 }, (_, i) =>
      note(`n${i}`, i * 10, 0)
    );
    const result = computeNearby(items, 0, 0, 3);
    // k=3: closest are n0(0), n1(10), n2(20)
    expect(result).toHaveLength(3);
    expect(result[0].id).toBe("n0");
    expect(result[1].id).toBe("n1");
    expect(result[2].id).toBe("n2");
  });

  it("respects distance cutoff (items exactly at radius boundary)", () => {
    // maxRadius=100: item at exactly 100px should be included (d2 <= r2)
    // item at 101px should be excluded
    const items: AnyObject[] = [
      note("exactly", 100, 0),   // d2 = 10000, r2 = 10000 -> included
      note("outside", 101, 0),   // d2 = 10201, r2 = 10000 -> excluded
    ];
    const result = computeNearby(items, 0, 0, 5, 100);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("exactly");
  });

  it("returns empty array for empty items list", () => {
    expect(computeNearby([], 0, 0)).toHaveLength(0);
  });
});
