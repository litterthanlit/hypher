import { describe, expect, it } from "vitest";
import {
  INVALID_GITHUB_REPO_INPUT,
  parseGithubRepoBindInput,
  planGithubRepoBind,
} from "./githubBind";

describe("parseGithubRepoBindInput", () => {
  it("accepts owner/name and GitHub URLs", () => {
    expect(parseGithubRepoBindInput("litterthanlit/hypher")).toBe("litterthanlit/hypher");
    expect(parseGithubRepoBindInput("https://github.com/litterthanlit/hypher")).toBe(
      "litterthanlit/hypher"
    );
    expect(parseGithubRepoBindInput("https://github.com/litterthanlit/hypher.git")).toBe(
      "litterthanlit/hypher"
    );
    expect(parseGithubRepoBindInput("git@github.com:litterthanlit/hypher.git")).toBe(
      "litterthanlit/hypher"
    );
  });

  it("rejects empty, invalid, and oversized input", () => {
    expect(parseGithubRepoBindInput("")).toBeNull();
    expect(parseGithubRepoBindInput("not-a-repo")).toBeNull();
    expect(parseGithubRepoBindInput("https://gitlab.com/org/repo")).toBeNull();
    expect(parseGithubRepoBindInput("x".repeat(501))).toBeNull();
  });
});

describe("planGithubRepoBind", () => {
  it("binds owner/name without a token and skips validate/sync", () => {
    expect(planGithubRepoBind("litterthanlit/hypher", false)).toEqual({
      ok: true,
      repo: "litterthanlit/hypher",
      validateAndSync: false,
    });
  });

  it("binds a full GitHub URL without a token", () => {
    expect(planGithubRepoBind("https://github.com/litterthanlit/hypher", false)).toEqual({
      ok: true,
      repo: "litterthanlit/hypher",
      validateAndSync: false,
    });
  });

  it("keeps validate and sync when a PAT is present", () => {
    expect(planGithubRepoBind("litterthanlit/hypher", true)).toEqual({
      ok: true,
      repo: "litterthanlit/hypher",
      validateAndSync: true,
    });
  });

  it("returns a bind error for invalid input even if a token exists", () => {
    expect(planGithubRepoBind("nope", true)).toEqual({
      ok: false,
      error: INVALID_GITHUB_REPO_INPUT,
    });
  });
});
