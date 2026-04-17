import { describe, it, expect } from "vitest";
import { stripQuotedReply } from "./quotedReply";

describe("stripQuotedReply", () => {
  it("passthrough: no delimiter — returns input unchanged", () => {
    const input = "Hey, just wanted to say hi!\n\nHope you are well.";
    expect(stripQuotedReply(input)).toBe(input);
  });

  it("strips standard > quoted lines", () => {
    const input = "Great idea!\n\n> On Mon, Apr 17, 2026, Alice wrote:\n> Let's do this.";
    expect(stripQuotedReply(input)).toBe("Great idea!");
  });

  it('strips "On <date>, <name> wrote:" attribution line', () => {
    const input =
      "I agree with the plan.\n\nOn 2026-04-17, Alice <alice@example.com> wrote:\n> Some quoted content here";
    expect(stripQuotedReply(input)).toBe("I agree with the plan.");
  });

  it('strips "--- Original Message ---" Outlook-style divider', () => {
    const input =
      "Sounds good to me.\n\n--- Original Message ---\nFrom: Bob\nSubject: Re: stuff";
    expect(stripQuotedReply(input)).toBe("Sounds good to me.");
  });

  it("handles multi-paragraph new content before a quote chain", () => {
    const input =
      "First paragraph of my reply.\n\nSecond paragraph here.\n\n> Quoted line one\n> Quoted line two";
    expect(stripQuotedReply(input)).toBe(
      "First paragraph of my reply.\n\nSecond paragraph here."
    );
  });

  it("returns empty string if input is empty", () => {
    expect(stripQuotedReply("")).toBe("");
  });

  it("trims trailing whitespace after stripping", () => {
    const input = "My reply\n   \n\n> quoted stuff";
    expect(stripQuotedReply(input)).toBe("My reply");
  });

  it("is conservative: does not strip when > appears mid-word in content", () => {
    // "> " at start of a line — should strip; but a line with no leading > should pass through
    const input = "See https://example.com?a=1&b=2>3 for details.";
    expect(stripQuotedReply(input)).toBe(input);
  });

  it("handles a 50-line quoted chain and returns only the user content", () => {
    const userContent = "This is my actual reply.";
    const quotedLines = Array.from({ length: 50 }, (_, i) => `> line ${i + 1}`);
    const input = [userContent, "", ...quotedLines].join("\n");
    expect(stripQuotedReply(input)).toBe(userContent);
  });
});
