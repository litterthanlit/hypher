#!/usr/bin/env node
// Copy packages/hypher-git/index.mjs into the Cursor plugin, which is installed
// from extensions/cursor alone and cannot import outside its folder.
// `--check` exits 1 instead of writing when the copy is stale.
import { copyFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CANONICAL = path.join(root, "packages/hypher-git/index.mjs");
const VENDORED = path.join(root, "extensions/cursor/scripts/vendor/hypher-git.mjs");

function read(file) {
  try {
    return readFileSync(file);
  } catch {
    return null;
  }
}

const check = process.argv.includes("--check");
const same = read(VENDORED)?.equals(read(CANONICAL)) ?? false;
if (check) {
  if (!same) {
    console.error(`${path.relative(root, VENDORED)} is stale. Run: node script/sync-hypher-git.mjs`);
    process.exitCode = 1;
  }
} else if (!same) {
  copyFileSync(CANONICAL, VENDORED);
  console.log(`Updated ${path.relative(root, VENDORED)}`);
}
