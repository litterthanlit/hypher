import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { HYPHER_MARK_PATH, HYPHER_MARK_VIEWBOX } from "./hypherMarkPath";

describe("canonical Hypher mark", () => {
  it("keeps public SVGs on the same path and native aspect as HypherMark", () => {
    const files = [
      path.resolve(__dirname, "../../public/hypher-logo.svg"),
      path.resolve(__dirname, "../../public/brand/hypher-mark.svg"),
    ];
    for (const file of files) {
      const svg = readFileSync(file, "utf8");
      expect(svg, file).toContain(`viewBox="${HYPHER_MARK_VIEWBOX}"`);
      expect(svg, file).toContain(HYPHER_MARK_PATH);
    }
  });

  it("uses the lockup native aspect instead of the stretched cousin", () => {
    const [minX, minY, width, height] = HYPHER_MARK_VIEWBOX.split(" ").map(Number);
    expect(minX).toBe(0);
    expect(minY).toBe(0);
    expect(width / height).toBeCloseTo(397 / 84, 5);
  });
});
