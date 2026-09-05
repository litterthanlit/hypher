import { describe, expect, it } from "vitest";
import {
  GITHUB_TOKEN_ENCRYPTION_UNCONFIGURED,
  githubTokenEncryptionKeyError,
} from "./githubPat";

describe("githubTokenEncryptionKeyError", () => {
  it("explains a missing encryption key without blocking repo bind", () => {
    expect(githubTokenEncryptionKeyError(undefined)).toBe(
      GITHUB_TOKEN_ENCRYPTION_UNCONFIGURED
    );
    expect(githubTokenEncryptionKeyError("short")).toBe(
      GITHUB_TOKEN_ENCRYPTION_UNCONFIGURED
    );
    expect(GITHUB_TOKEN_ENCRYPTION_UNCONFIGURED).toContain("Binding a repo does not need a token");
  });

  it("accepts a configured key", () => {
    expect(githubTokenEncryptionKeyError("long-enough-encryption-key")).toBeNull();
  });
});
