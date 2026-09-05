#!/usr/bin/env node

import { emit, readStdinJson, runSessionEnd } from "./hypher-session.mjs";

async function main() {
  try {
    const input = await readStdinJson();
    await runSessionEnd({ input, env: process.env });
  } catch {
    // Fire-and-forget: never fail the session. Cursor ignores this response.
  }
  emit({});
}

await main();
