import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  commitRelation,
  commitsBetween,
  handoffRepoSnapshot,
  isAncestor,
  normalizeGitHubRepo,
  repoIdentity,
  worktreeTreeHash,
} from "./index.mjs";

function tempDir() {
  return mkdtempSync(path.join(os.tmpdir(), "hypher-git-test-"));
}

function tempRepo({ remote = "git@github.com:acme/widgets.git", commit = true } = {}) {
  const dir = tempDir();
  const run = (...args) => execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();
  run("init", "-q", "-b", "main");
  run("config", "user.email", "test@example.com");
  run("config", "user.name", "Test");
  run("config", "commit.gpgsign", "false");
  if (remote) run("remote", "add", "origin", remote);
  writeFileSync(path.join(dir, "a.txt"), "one\n");
  writeFileSync(path.join(dir, ".gitignore"), "ignored.log\n");
  if (commit) {
    run("add", "-A");
    run("commit", "-q", "-m", "init");
  }
  const commitFile = (name, body) => {
    writeFileSync(path.join(dir, name), body);
    run("add", name);
    run("commit", "-q", "-m", name);
    return run("rev-parse", "HEAD");
  };
  return { dir, run, commitFile, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

function hypherTempDirs() {
  return readdirSync(os.tmpdir()).filter((name) => name.startsWith("hypher-index-")).sort();
}

test("normalizeGitHubRepo reads ssh, https, .git, trailing slash, and owner/repo", () => {
  assert.equal(normalizeGitHubRepo("git@github.com:acme/widgets.git"), "acme/widgets");
  assert.equal(normalizeGitHubRepo("https://github.com/acme/widgets.git"), "acme/widgets");
  assert.equal(normalizeGitHubRepo("https://github.com/acme/widgets/"), "acme/widgets");
  assert.equal(normalizeGitHubRepo("acme/widgets"), "acme/widgets");
  assert.equal(normalizeGitHubRepo("https://gitlab.com/acme/widgets.git"), null);
  assert.equal(normalizeGitHubRepo(""), null);
  assert.equal(normalizeGitHubRepo(null), null);
});

test("repoIdentity reads root, origin, branch, commit, and changed files", () => {
  const repo = tempRepo();
  try {
    const clean = repoIdentity(repo.dir);
    assert.equal(clean.root, repo.run("rev-parse", "--show-toplevel"));
    assert.equal(clean.remote, repo.run("remote", "get-url", "origin"));
    assert.equal(clean.repository, "acme/widgets");
    assert.equal(clean.branch, "main");
    assert.equal(clean.commit, repo.run("rev-parse", "HEAD"));
    assert.equal(clean.dirty, false);
    assert.deepEqual(clean.changedFiles, []);

    writeFileSync(path.join(repo.dir, "a.txt"), "two\n");
    writeFileSync(path.join(repo.dir, "new.txt"), "new\n");
    const dirty = repoIdentity(repo.dir);
    assert.equal(dirty.dirty, true);
    assert.deepEqual(dirty.changedFiles, [" M a.txt", "?? new.txt"]);
  } finally {
    repo.cleanup();
  }
});

test("repoIdentity prefers origin, else the first remote, else null", () => {
  const repo = tempRepo({ remote: null });
  try {
    assert.equal(repoIdentity(repo.dir).remote, null);
    assert.equal(repoIdentity(repo.dir).repository, null);
    repo.run("remote", "add", "upstream", "https://github.com/up/stream.git");
    assert.equal(repoIdentity(repo.dir).repository, "up/stream");
    repo.run("remote", "add", "origin", "https://github.com/acme/widgets");
    assert.equal(repoIdentity(repo.dir).repository, "acme/widgets");
  } finally {
    repo.cleanup();
  }
});

test("repoIdentity reports detached HEAD as HEAD and an unborn branch by name", () => {
  const repo = tempRepo();
  const unborn = tempRepo({ commit: false });
  try {
    repo.run("checkout", "-q", "--detach");
    assert.equal(repoIdentity(repo.dir).branch, "HEAD");
    const fresh = repoIdentity(unborn.dir);
    assert.equal(fresh.branch, "main");
    assert.equal(fresh.commit, null);
    assert.equal(handoffRepoSnapshot(unborn.dir), null);
  } finally {
    repo.cleanup();
    unborn.cleanup();
  }
});

test("outside git nothing throws and every field is empty", () => {
  const dir = tempDir();
  try {
    assert.deepEqual(repoIdentity(dir), {
      root: null, remote: null, repository: null, branch: null, commit: null, dirty: false, changedFiles: [],
    });
    assert.deepEqual(repoIdentity(path.join(dir, "missing")).changedFiles, []);
    assert.equal(worktreeTreeHash(dir), null);
    assert.equal(handoffRepoSnapshot(dir), null);
    assert.equal(isAncestor(dir, "HEAD", "HEAD"), null);
    assert.equal(commitsBetween(dir, "HEAD", "HEAD"), null);
    assert.deepEqual(commitRelation(dir, "HEAD", "HEAD"), { relation: "unknown", ahead: null, behind: null });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("worktreeTreeHash is deterministic, counts untracked, skips ignored, and leaves the index alone", () => {
  const repo = tempRepo();
  const before = hypherTempDirs();
  try {
    const cleanTree = worktreeTreeHash(repo.dir);
    assert.equal(cleanTree, repo.run("rev-parse", "HEAD^{tree}"));

    writeFileSync(path.join(repo.dir, "a.txt"), "two\n");
    const edited = worktreeTreeHash(repo.dir);
    assert.match(edited, /^[0-9a-f]{40,64}$/);
    assert.notEqual(edited, cleanTree);
    assert.equal(worktreeTreeHash(repo.dir), edited);

    writeFileSync(path.join(repo.dir, "ignored.log"), "noise\n");
    assert.equal(worktreeTreeHash(repo.dir), edited);

    writeFileSync(path.join(repo.dir, "new.txt"), "untracked\n");
    assert.notEqual(worktreeTreeHash(repo.dir), edited);

    assert.doesNotThrow(() => repo.run("diff", "--cached", "--quiet"));
    assert.match(repo.run("status", "--porcelain"), /\?\? new\.txt/);
    assert.deepEqual(hypherTempDirs(), before);
  } finally {
    repo.cleanup();
  }
});

test("handoffRepoSnapshot keeps the handoff shape", () => {
  const repo = tempRepo();
  try {
    const clean = handoffRepoSnapshot(repo.dir);
    assert.deepEqual(clean, {
      repository: "acme/widgets",
      branch: "main",
      commit: repo.run("rev-parse", "HEAD"),
      dirty: false,
      worktreePath: repo.run("rev-parse", "--show-toplevel"),
    });
    writeFileSync(path.join(repo.dir, "a.txt"), "two\n");
    const dirty = handoffRepoSnapshot(repo.dir);
    assert.equal(dirty.dirty, true);
    assert.equal(dirty.dirtyFingerprint, `tree:${worktreeTreeHash(repo.dir)}`);
    repo.run("checkout", "-q", "--detach");
    assert.equal(handoffRepoSnapshot(repo.dir).branch, "HEAD");
  } finally {
    repo.cleanup();
  }
});

test("commitRelation reports same, ahead, behind, and diverged with counts", () => {
  const repo = tempRepo();
  try {
    const base = repo.run("rev-parse", "HEAD");
    assert.deepEqual(commitRelation(repo.dir, base, base), { relation: "same", ahead: 0, behind: 0 });

    repo.commitFile("b.txt", "b\n");
    const tip = repo.commitFile("c.txt", "c\n");
    assert.deepEqual(commitRelation(repo.dir, base, tip), { relation: "ahead", ahead: 2, behind: 0 });
    assert.deepEqual(commitRelation(repo.dir, tip, base), { relation: "behind", ahead: 0, behind: 2 });
    assert.equal(isAncestor(repo.dir, base, tip), true);
    assert.equal(isAncestor(repo.dir, tip, base), false);
    assert.equal(commitsBetween(repo.dir, base, tip), 2);
    assert.equal(commitsBetween(repo.dir, tip, base), 0);

    repo.run("checkout", "-q", "-b", "side", base);
    const side = repo.commitFile("d.txt", "d\n");
    assert.deepEqual(commitRelation(repo.dir, tip, side), { relation: "diverged", ahead: 1, behind: 2 });
    assert.equal(isAncestor(repo.dir, tip, side), false);

    assert.deepEqual(commitRelation(repo.dir, "0".repeat(40), side), { relation: "unknown", ahead: null, behind: null });
    assert.deepEqual(commitRelation(repo.dir, "--all", side), { relation: "unknown", ahead: null, behind: null });
    assert.equal(isAncestor(repo.dir, "nope", side), null);
  } finally {
    repo.cleanup();
  }
});
