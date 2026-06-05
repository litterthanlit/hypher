import { describe, expect, it } from "vitest";
import { builderBriefDriftFixture } from "./builderBriefDriftFixture";

describe("builderBriefDriftFixture", () => {
  it("compares a vague task prompt with a Builder Brief prompt", () => {
    expect(builderBriefDriftFixture.productClaim).toBe(
      "Hypher reduces agent drift by giving the builder agent the right context at the right time."
    );
    expect(builderBriefDriftFixture.withoutHypher.prompt).not.toContain("### What not to do");
    expect(builderBriefDriftFixture.withHypher.prompt).toContain("# Builder Brief: Hypher");
    expect(builderBriefDriftFixture.withHypher.prompt).toContain("### What not to do");
    expect(builderBriefDriftFixture.withHypher.prompt).toContain("Do not build OAuth yet.");
    expect(builderBriefDriftFixture.withHypher.prompt).toContain("### Acceptance criteria");
  });

  it("tracks the manual evaluation dimensions for agent drift", () => {
    expect(builderBriefDriftFixture.dimensions.map((dimension) => dimension.key)).toEqual([
      "planAdherence",
      "driftCount",
      "humanCorrectionsNeeded",
      "unrelatedChanges",
      "missedConstraints",
      "testCoverage",
      "completionQuality",
      "handoffQuality",
    ]);
  });
});
