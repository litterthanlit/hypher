import { describe, expect, it } from "vitest";
import type { Handoff } from "@/types";
import {
  HANDOFF_RESULT_EMPTY_ERROR,
  buildHandoffResultUpdate,
  summarizeHandoffResult,
} from "./handoffResults";

const handoff: Handoff = {
  id: "handoff-1",
  userId: "user-1",
  projectId: "project-1",
  generatedAt: 100,
  targetTool: "Cursor",
  packetContent: "# Builder Brief: Hypher\n\nOriginal packet",
  sourceCaptures: ["capture-1"],
  requestedTask: "Implement Copy Builder Brief",
  status: "used",
};

describe("buildHandoffResultUpdate", () => {
  it("saves returned agent output and user notes separately without touching the original packet", () => {
    const result = buildHandoffResultUpdate(handoff, {
      returnedAgentOutput: "  Added tests and wired Project Pulse.  ",
      userNotes: "  Looks good.  ",
    });

    expect(result).toEqual({
      ok: true,
      args: {
        handoffId: "handoff-1",
        returnedAgentOutput: "Added tests and wired Project Pulse.",
        userNotes: "Looks good.",
      },
    });
    if (result.ok) {
      expect(result.args).not.toHaveProperty("packetContent");
      expect(handoff.packetContent).toContain("Original packet");
    }
  });

  it("rejects empty agent result updates", () => {
    expect(buildHandoffResultUpdate(handoff, {
      returnedAgentOutput: "  ",
      userNotes: "\n",
    })).toEqual({ ok: false, error: HANDOFF_RESULT_EMPTY_ERROR });
  });
});

describe("summarizeHandoffResult", () => {
  it("builds bounded Builder Brief handoff notes from returned output and user notes", () => {
    const longOutput = `Implemented the Project Pulse form. ${"Verified ".repeat(80)}`;
    const lines = summarizeHandoffResult({
      ...handoff,
      returnedAgentOutput: longOutput,
      userNotes: "User confirmed this should feed the next Builder Brief.",
    });

    expect(lines[0]).toContain("Agent result from previous Cursor brief");
    expect(lines[0]).toContain("Implemented the Project Pulse form.");
    expect(lines[0]!.length).toBeLessThanOrEqual(260);
    expect(lines[1]).toBe("User note on previous Cursor brief: User confirmed this should feed the next Builder Brief.");
  });

  it("returns no lines when no result or notes exist", () => {
    expect(summarizeHandoffResult(handoff)).toEqual([]);
  });
});
