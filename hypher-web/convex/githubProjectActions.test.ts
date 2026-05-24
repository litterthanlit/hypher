import { describe, expect, it } from "vitest";
import { cleanGithubRepoInput, cleanGithubTokenInput } from "./githubProjectActions";

describe("HYP-SEC-001 GitHub action input caps", () => {
  it("rejects oversized repo and token inputs before remote calls", () => {
    expect(cleanGithubRepoInput("owner/repo")).toBe("owner/repo");
    expect(cleanGithubRepoInput("x".repeat(201))).toBeNull();
    expect(cleanGithubTokenInput(" ghp_token ")).toBe("ghp_token");
    expect(cleanGithubTokenInput("x".repeat(2049))).toBeNull();
  });
});
