#!/usr/bin/env node

const DEFAULT_ENDPOINT = "https://hypher.app/api/agent/events";
const KINDS = new Set(["handoff", "build_log", "question", "suggestion", "artifact", "next_action"]);

export function parseArgs(argv) {
  const options = { suggestedActions: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (!flag?.startsWith("--")) throw new Error(`Unexpected argument: ${flag}`);
    const key = flag.slice(2);
    if (key === "dry-run") {
      options.dryRun = true;
      continue;
    }
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${flag}`);
    i += 1;
    if (key === "action") options.suggestedActions.push(value.trim());
    else options[key] = value.trim();
  }
  return options;
}

function requireFlag(options, key) {
  if (!options[key]) throw new Error(`Missing required flag: --${key}`);
  return options[key];
}

export function buildPayload(options) {
  const source = requireFlag(options, "source");
  const title = requireFlag(options, "title");
  const body = requireFlag(options, "body");
  const kind = options.kind || "handoff";
  if (!KINDS.has(kind)) throw new Error(`Invalid --kind: ${kind}`);

  const payload = { source, kind, title, body };
  for (const key of ["project", "repo", "branch", "commitSha", "artifactUrl"]) {
    if (options[key]) payload[key] = options[key];
  }
  if (options.suggestedActions?.length) payload.suggestedActions = options.suggestedActions;
  return payload;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const endpoint = options.endpoint || process.env.HYPHER_ENDPOINT || DEFAULT_ENDPOINT;
  const apiKey = options.apiKey || process.env.HYPHER_API_KEY;
  const payload = buildPayload(options);

  if (options.dryRun) {
    console.log(JSON.stringify({ endpoint, payload }, null, 2));
    return;
  }
  if (!apiKey) throw new Error("Missing API key. Set HYPHER_API_KEY or pass --apiKey.");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Hypher handoff failed (${response.status}): ${text}`);
  console.log(text);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
