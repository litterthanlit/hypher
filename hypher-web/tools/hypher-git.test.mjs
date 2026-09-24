import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeGitHubRepo as normalizeTs } from "../shared/githubRepo.ts";
import { normalizeGitHubRepo as normalizeMjs } from "../../packages/hypher-git/index.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const INPUTS = [
  "git@github.com:acme/widgets.git",
  "git@github.com:acme/widgets",
  "GIT@GitHub.com:Acme/Widgets.GIT",
  "https://github.com/acme/widgets.git",
  "https://github.com/acme/widgets",
  "https://github.com/acme/widgets/",
  "https://github.com/acme/widgets.git/",
  "https://www.github.com/acme/widgets.git",
  "https://user:token@github.com/acme/widgets.git",
  "https://github.com/acme/widgets/tree/main",
  "http://github.com/acme/widgets",
  "https://GitHub.com/Acme/Widgets",
  "github.com/acme/widgets",
  "github.com:acme/widgets",
  "ssh://git@github.com/acme/widgets.git",
  "git://github.com/acme/widgets.git",
  "git+https://github.com/acme/widgets.git",
  "https://github.com/acme",
  "https://gitlab.com/acme/widgets.git",
  "git@gitlab.com:acme/widgets.git",
  "acme/widgets",
  "/acme/widgets",
  "acme/widgets.js",
  "acme/wid gets",
  "acme/widgets/extra",
  "/local/path/repo",
  "  acme/widgets  ",
  "",
  "   ",
  null,
  undefined,
];

describe("packages/hypher-git", () => {
  it("normalizes GitHub repos exactly like shared/githubRepo.ts", () => {
    for (const input of INPUTS) {
      expect(normalizeMjs(input), JSON.stringify(input)).toBe(normalizeTs(input));
    }
  });

  it("is vendored byte-identical into the Cursor plugin", () => {
    const canonical = readFileSync(path.join(repoRoot, "packages/hypher-git/index.mjs"));
    const vendored = readFileSync(path.join(repoRoot, "extensions/cursor/scripts/vendor/hypher-git.mjs"));
    expect(vendored.equals(canonical), "run: node script/sync-hypher-git.mjs").toBe(true);
  });
});
