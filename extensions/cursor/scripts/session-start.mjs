#!/usr/bin/env node

import { emit, readStdinJson, runSessionStart } from "./hypher-session.mjs";

async function main() {
  try {
    const input = await readStdinJson();
    const output = await runSessionStart({ input, env: process.env });
    emit(output);
  } catch {
    emit({
      additional_context: [
        "Hypher session start (automatic via Cursor plugin hook).",
        "",
        "Load project memory once: resolve_project_for_repo on this workspace git remote, then get_project_context if matched.",
        "If unmatched, point to https://hypher.app/app/settings/integrations. Do not invent project status.",
        "At session end, post one handoff. /hypher-brief and /hypher-handoff stay as manual overrides.",
      ].join("\n"),
    });
  }
}

await main();
