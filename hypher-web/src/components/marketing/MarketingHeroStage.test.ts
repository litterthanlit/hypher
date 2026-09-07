import { describe, expect, it } from "vitest";
import {
  LANDING_CTA,
  LANDING_CURSOR,
  LANDING_FAQ,
  LANDING_HERO,
  LANDING_LOOP,
} from "./landingCopy";
import {
  compileDemoBrief,
  DEMO_BEATS,
  DEMO_CHIPS,
  DEMO_WRITEBACK,
  PUBLIC_CAPTURE_LABEL,
  PUBLIC_DROP_HINT,
} from "./marketingHeroDemo";

const publicBlob = JSON.stringify({
  LANDING_HERO,
  LANDING_LOOP,
  LANDING_CURSOR,
  LANDING_FAQ,
  LANDING_CTA,
  DEMO_BEATS,
  DEMO_CHIPS,
  DEMO_WRITEBACK,
  PUBLIC_CAPTURE_LABEL,
  PUBLIC_DROP_HINT,
});

describe("compileDemoBrief", () => {
  it("uses the first line as the do-not", () => {
    const brief = compileDemoBrief("Don't widen OAuth.\nEmpty state still broken.");
    expect(brief.doNot).toBe("Don't widen OAuth.");
    expect(brief.direction).toContain("Close the loop");
    expect(brief.next).toContain("session start");
  });

  it("falls back when the note is blank", () => {
    expect(compileDemoBrief("   ").doNot).toBe("Don't widen OAuth.");
  });
});

describe("public landing copy", () => {
  it("uses Capture as the public verb", () => {
    expect(PUBLIC_CAPTURE_LABEL).toBe("Capture");
    expect(PUBLIC_DROP_HINT).toBe("Drop it in");
    expect(publicBlob).not.toMatch(/Dump yours/i);
    expect(publicBlob).not.toMatch(/\bDump\b/);
  });

  it("keeps the card on the three-beat loop", () => {
    expect([...DEMO_BEATS]).toEqual(["Capture", "The note", "Writeback"]);
    expect(LANDING_LOOP.beats.map((beat) => beat.title)).toEqual([
      "Capture",
      "The note",
      "Writeback",
    ]);
  });

  it("does not sell leftover surfaces", () => {
    expect(publicBlob).not.toMatch(/generate memory/i);
    expect(publicBlob).not.toMatch(/inbox/i);
    expect(publicBlob).not.toMatch(/digest/i);
    expect(publicBlob).not.toMatch(/accepted memory/i);
    expect(publicBlob).not.toMatch(/suggested project/i);
    expect(publicBlob).not.toMatch(/os for agents/i);
    expect(publicBlob).not.toMatch(/\/api\/projects/i);
  });

  it("keeps Cursor and private beta on the page", () => {
    expect(LANDING_CURSOR.heading).toMatch(/Cursor/);
    expect(LANDING_HERO.primaryCta).toBe("Request beta");
    expect(LANDING_HERO.hint.toLowerCase()).toContain("private beta");
  });
});
