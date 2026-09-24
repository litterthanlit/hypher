import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  LANDING_CTA,
  LANDING_DOORS,
  LANDING_FAQ,
  LANDING_FOOTER_NOTE,
  LANDING_HANDOFF,
  LANDING_HERO,
  LANDING_LOOP,
  LANDING_SUPPORT,
  LANDING_TRUST,
} from "./landingCopy";
import {
  AGENTS,
  compileDemoBrief,
  compileDemoNote,
  DEMO_BEATS,
  DEMO_CHIPS,
  DEMO_DIRECTIONS,
  DEMO_SOURCE_LOG,
  DEMO_WRITEBACK,
  PUBLIC_CAPTURE_LABEL,
  PUBLIC_DROP_HINT,
} from "./marketingHeroDemo";

const publicBlob = JSON.stringify({
  LANDING_HERO,
  LANDING_SUPPORT,
  LANDING_LOOP,
  LANDING_HANDOFF,
  LANDING_TRUST,
  LANDING_DOORS,
  LANDING_FAQ,
  LANDING_CTA,
  LANDING_FOOTER_NOTE,
  AGENTS,
  DEMO_BEATS,
  DEMO_CHIPS,
  DEMO_SOURCE_LOG,
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

describe("compileDemoNote", () => {
  it("puts the captured line first in the constraints", () => {
    const note = compileDemoNote("Pulse stays three panels.\nmore");
    expect(note.constraints[0]).toBe("Pulse stays three panels.");
    expect(note.decision.replaces).toBeTruthy();
    expect(note.unverified).toBeTruthy();
    expect(note.next).toBeTruthy();
  });

  it("switches both ways between Claude Code and Codex", () => {
    expect(DEMO_DIRECTIONS).toEqual([
      { from: "claude-code", to: "codex" },
      { from: "codex", to: "claude-code" },
    ]);
    expect(AGENTS["claude-code"].save).toBe("/hypher-save");
    expect(AGENTS.codex.resume).toBe("$hypher-resume");
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

  it("uses pilot messaging until the Baton proof is recorded", () => {
    expect(LANDING_HERO.headline).toBe("Stop re-explaining your project to every agent.");
    expect(LANDING_HERO.lede).toBe(
      "Hypher carries decisions and next steps between Claude Code and Codex. Join the pilot.",
    );
    expect(LANDING_HERO.primaryCta).toBe("Join the pilot");
    expect(LANDING_HERO.hint.toLowerCase()).toContain("not recorded");
    expect(LANDING_HERO.demoCaption.toLowerCase()).toContain("not a recording");
    expect(publicBlob).not.toMatch(/pull the plug/i);
  });

  it("never says what the recordings do not show", () => {
    expect(publicBlob).not.toMatch(/never forgets/i);
    expect(publicBlob).not.toMatch(/works everywhere/i);
    expect(publicBlob).not.toMatch(/\d+\s?% better/i);
    expect(publicBlob).not.toMatch(/AI memory for all your chats/i);
  });

  it("shows an automatic / manual table for every supported agent", () => {
    expect([...LANDING_SUPPORT.columns]).toEqual(["Cursor", "Claude Code", "Codex CLI"]);
    for (const row of LANDING_SUPPORT.rows) {
      expect(row.cells).toHaveLength(LANDING_SUPPORT.columns.length);
    }
    const approve = LANDING_SUPPORT.rows.find((row) => /approve/i.test(row.step));
    expect(approve?.cells.every((cell) => cell.mode === "human")).toBe(true);
  });

  it("says what leaves the machine and what never does", () => {
    const stays = LANDING_TRUST.stays.items.join(" ").toLowerCase();
    expect(stays).toContain("source code");
    expect(stays).toContain("diffs");
    expect(stays).toContain("transcripts");
  });

  it("does not mark Claude Code or Codex as supported yet", () => {
    const byName = Object.fromEntries(LANDING_DOORS.items.map((door) => [door.name, door]));
    expect(byName.Cursor.status).toBe("Supported");
    expect(byName["Claude Code"].status).toBe("Pilot");
    expect(byName["Codex CLI"].status).toBe("Pilot");
  });

  it("locks the capture verb and the three-beat loop", () => {
    expect(PUBLIC_CAPTURE_LABEL).toBe("Capture");
    expect([...DEMO_BEATS]).toEqual(["Capture", "The note", "Writeback"]);
  });

  it("keeps the room lock: Nick mark + word left, no Introducing chrome", () => {
    const header = readFileSync(
      path.resolve(__dirname, "./MarketingChrome.tsx"),
      "utf8",
    );
    const brand = readFileSync(
      path.resolve(__dirname, "./MarketingBrand.tsx"),
      "utf8",
    );
    const css = readFileSync(
      path.resolve(__dirname, "../../app/globals.css"),
      "utf8",
    );

    expect(header).toContain("<MarketingBrand />");
    expect(header).toContain("marketing-header__right");
    expect(brand).toContain("<HypherMark");
    expect(brand).toContain("hypher");
    expect(publicBlob).not.toMatch(/Introducing/i);
    expect(publicBlob).not.toMatch(/Speech Engine/i);
    expect(css).toContain("@keyframes hypher-mark-breathe");
    expect(css).toMatch(
      /\.marketing-header \.hypher-signal-mark--marketing \{\s*animation: hypher-mark-breathe/,
    );
  });
});
