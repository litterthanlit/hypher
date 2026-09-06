import { describe, expect, it } from "vitest";
import { compileDemoBrief } from "./marketingHeroDemo";

describe("compileDemoBrief", () => {
  it("uses the first line as the do-not", () => {
    const brief = compileDemoBrief("Don't widen OAuth.\nEmpty state still broken.");
    expect(brief.doNot).toBe("Don't widen OAuth.");
    expect(brief.direction).toContain("Close the loop");
    expect(brief.next).toContain("session start");
  });

  it("falls back when the dump is blank", () => {
    expect(compileDemoBrief("   ").doNot).toBe("Don't widen OAuth.");
  });
});
