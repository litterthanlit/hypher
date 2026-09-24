/**
 * Hypher git helpers. Node built-ins only, synchronous, read-only against the
 * real repository. Git failures return null or empty values; nothing throws.
 *
 * Canonical source: packages/hypher-git/index.mjs.
 * Vendored copy: extensions/cursor/scripts/vendor/hypher-git.mjs
 * (refresh with `node script/sync-hypher-git.mjs`; do not edit the copy).
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export const GIT_TIMEOUT_MS = 10_000;
export const TREE_TIMEOUT_MS = 60_000;

/**
 * Run git and return stdout (trimmed unless `trim` is false), or null when git fails or times out.
 * @param {string | undefined} cwd
 * @param {string[]} args
 * @param {{ env?: Record<string, string>, timeoutMs?: number, trim?: boolean }} [options]
 * @returns {string | null}
 */
export function git(cwd, args, { env, timeoutMs = GIT_TIMEOUT_MS, trim = true } = {}) {
  try {
    const out = execFileSync("git", args, {
      encoding: "utf8",
      timeout: timeoutMs,
      stdio: ["ignore", "pipe", "ignore"],
      ...(cwd ? { cwd } : {}),
      ...(env ? { env: { ...process.env, ...env } } : {}),
    });
    return trim ? out.trim() : out;
  } catch {
    return null;
  }
}

/**
 * `owner/repo` from a GitHub remote URL or `owner/repo`, else null.
 * Mirrors hypher-web/shared/githubRepo.ts exactly (a parity test enforces it).
 * @param {string | undefined | null} input
 * @returns {string | null}
 */
export function normalizeGitHubRepo(input) {
  const raw = (input ?? "").trim();
  if (!raw) return null;

  let value = raw.replace(/\.git$/i, "");
  const sshMatch = value.match(/^git@github\.com:(.+)$/i);
  if (sshMatch?.[1]) {
    value = sshMatch[1];
  } else if (/github\.com/i.test(value)) {
    try {
      const url = new URL(value.startsWith("http") ? value : `https://${value.replace(/^git\+/, "")}`);
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length >= 2) {
        value = `${parts[0]}/${parts[1]}`;
      }
    } catch {
      return null;
    }
  }

  value = value.replace(/^\/+/, "").replace(/\.git$/i, "");
  if (!/^[\w.-]+\/[\w.-]+$/.test(value)) return null;
  return value;
}

/**
 * URL of `origin`, else of the first remote, else null.
 * @param {string | undefined} cwd
 * @param {{ timeoutMs?: number }} [options]
 * @returns {string | null}
 */
export function remoteUrl(cwd, { timeoutMs } = {}) {
  const origin = git(cwd, ["remote", "get-url", "origin"], { timeoutMs });
  if (origin) return origin;
  const names = (git(cwd, ["remote"], { timeoutMs }) ?? "")
    .split("\n").map((line) => line.trim()).filter(Boolean);
  if (names.length === 0) return null;
  const name = names.includes("origin") ? "origin" : names[0];
  return git(cwd, ["remote", "get-url", name], { timeoutMs }) || null;
}

/**
 * @typedef {object} RepoIdentity
 * @property {string | null} root Work tree top level.
 * @property {string | null} remote Origin URL, else first remote.
 * @property {string | null} repository `owner/repo` for a GitHub remote.
 * @property {string | null} branch Current branch (also on an unborn branch); "HEAD" when detached.
 * @property {string | null} commit HEAD commit.
 * @property {boolean} dirty
 * @property {string[]} changedFiles `git status --porcelain` lines.
 */

/**
 * Identity of the repository containing cwd. Outside git every field is null.
 * @param {string} [cwd]
 * @param {{ timeoutMs?: number }} [options]
 * @returns {RepoIdentity}
 */
export function repoIdentity(cwd, { timeoutMs } = {}) {
  const opts = { timeoutMs };
  const root = git(cwd, ["rev-parse", "--show-toplevel"], opts) || null;
  const remote = remoteUrl(cwd, opts);
  const commit = git(cwd, ["rev-parse", "HEAD"], opts) || null;
  const ref = git(cwd, ["symbolic-ref", "-q", "HEAD"], opts);
  const branch = ref ? ref.replace(/^refs\/heads\//, "") : commit ? "HEAD" : null;
  const status = git(cwd, ["status", "--porcelain"], { ...opts, trim: false });
  const changedFiles = (status ?? "").split("\n").map((line) => line.trimEnd()).filter(Boolean);
  return {
    root,
    remote,
    repository: normalizeGitHubRepo(remote),
    branch,
    commit,
    dirty: changedFiles.length > 0,
    changedFiles,
  };
}

/**
 * Tree hash of the working tree (tracked edits plus untracked, non-ignored files),
 * built in a throwaway index so the real index is never touched. Null on failure.
 * @param {string} [cwd]
 * @returns {string | null}
 */
export function worktreeTreeHash(cwd) {
  const root = git(cwd, ["rev-parse", "--show-toplevel"]);
  if (!root) return null;
  let dir;
  try {
    dir = mkdtempSync(path.join(os.tmpdir(), "hypher-index-"));
    const opts = { env: { GIT_INDEX_FILE: path.join(dir, "index") }, timeoutMs: TREE_TIMEOUT_MS };
    if (git(root, ["read-tree", "HEAD"], opts) === null) return null;
    if (git(root, ["add", "-A"], opts) === null) return null;
    const tree = git(root, ["write-tree"], opts);
    return tree && /^[0-9a-f]{40,64}$/.test(tree) ? tree : null;
  } catch {
    return null;
  } finally {
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
}

const HANDOFF_GITHUB_REMOTE = /(?:github\.com[:/])([^/]+\/[^/]+?)(?:\.git)?\/?$/;

/**
 * @typedef {object} HandoffRepoSnapshot
 * @property {string} [repository]
 * @property {string} branch
 * @property {string} commit
 * @property {boolean} dirty
 * @property {string} [worktreePath]
 * @property {string} [dirtyFingerprint] `tree:<sha>` when dirty.
 */

/**
 * Repository snapshot for a structured handoff (`currentRepo` / `proposal.repo`).
 * Reads only `origin`. Null outside a checkout with a commit.
 * @param {string} [cwd]
 * @returns {HandoffRepoSnapshot | null}
 */
export function handoffRepoSnapshot(cwd) {
  const remote = git(cwd, ["config", "--get", "remote.origin.url"]);
  const repository = remote?.match(HANDOFF_GITHUB_REMOTE)?.[1] ?? null;
  const worktreePath = git(cwd, ["rev-parse", "--show-toplevel"]);
  const branch = git(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
  const commit = git(cwd, ["rev-parse", "HEAD"]);
  const status = git(cwd, ["status", "--porcelain"]);
  if (!branch || !commit) return null;
  const dirty = Boolean(status);
  const tree = dirty ? worktreeTreeHash(cwd) : null;
  return {
    ...(repository ? { repository } : {}),
    branch,
    commit,
    dirty,
    ...(worktreePath ? { worktreePath } : {}),
    ...(tree ? { dirtyFingerprint: `tree:${tree}` } : {}),
  };
}

function commitSha(cwd, rev) {
  if (typeof rev !== "string" || !rev.trim() || rev.startsWith("-")) return null;
  return git(cwd, ["rev-parse", "--verify", "-q", `${rev.trim()}^{commit}`]) || null;
}

/**
 * Whether commit a is an ancestor of (or equal to) b. Null when unknown.
 * @param {string | undefined} cwd
 * @param {string} a
 * @param {string} b
 * @returns {boolean | null}
 */
export function isAncestor(cwd, a, b) {
  const from = commitSha(cwd, a);
  const to = commitSha(cwd, b);
  if (!from || !to) return null;
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", from, to], {
      timeout: GIT_TIMEOUT_MS,
      stdio: "ignore",
      ...(cwd ? { cwd } : {}),
    });
    return true;
  } catch (error) {
    return error?.status === 1 ? false : null;
  }
}

/**
 * Number of commits reachable from `to` but not from `from` (`from..to`). Null when unknown.
 * @param {string | undefined} cwd
 * @param {string} from
 * @param {string} to
 * @returns {number | null}
 */
export function commitsBetween(cwd, from, to) {
  const a = commitSha(cwd, from);
  const b = commitSha(cwd, to);
  if (!a || !b) return null;
  const count = Number(git(cwd, ["rev-list", "--count", `${a}..${b}`]) ?? NaN);
  return Number.isInteger(count) ? count : null;
}

/**
 * @typedef {"same" | "ahead" | "behind" | "diverged" | "unknown"} CommitRelationKind
 * @typedef {{ relation: CommitRelationKind, ahead: number | null, behind: number | null }} CommitRelation
 */

/**
 * How `current` relates to `saved`: ahead = commits only in current, behind = commits only in saved.
 * @param {string | undefined} cwd
 * @param {string} saved
 * @param {string} current
 * @returns {CommitRelation}
 */
export function commitRelation(cwd, saved, current) {
  const unknown = { relation: /** @type {const} */ ("unknown"), ahead: null, behind: null };
  const a = commitSha(cwd, saved);
  const b = commitSha(cwd, current);
  if (!a || !b) return unknown;
  if (a === b) return { relation: "same", ahead: 0, behind: 0 };
  const counts = git(cwd, ["rev-list", "--left-right", "--count", `${a}...${b}`])?.split(/\s+/).map(Number);
  if (!counts || counts.length !== 2 || !counts.every(Number.isInteger)) return unknown;
  const [behind, ahead] = counts;
  const relation = ahead && behind ? "diverged" : ahead ? "ahead" : behind ? "behind" : "same";
  return { relation, ahead, behind };
}
