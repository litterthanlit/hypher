import type { ErrorEvent, EventHint } from "@sentry/core";

const SENSITIVE_KEYS = new Set([
  "token",
  "pat",
  "password",
  "authorization",
  "access_token",
  "refresh_token",
  "github_token",
]);

function scrubValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    return value
      .replace(/Bearer\s+[\w.-]+/gi, "Bearer [redacted]")
      .replace(/\bghp_[a-zA-Z0-9]+\b/g, "ghp_[redacted]")
      .replace(/\bgithub_pat_[a-zA-Z0-9_]+\b/gi, "github_pat_[redacted]");
  }
  if (Array.isArray(value)) return value.map(scrubValue);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const kl = k.toLowerCase();
      if (SENSITIVE_KEYS.has(kl) || kl.includes("token") || kl === "pat") {
        out[k] = "[redacted]";
      } else {
        out[k] = scrubValue(v);
      }
    }
    return out;
  }
  return value;
}

export function sentryBeforeSend(
  event: ErrorEvent,
  _hint: EventHint
): ErrorEvent | null {
  if (event.request) {
    if (event.request.data) event.request.data = scrubValue(event.request.data);
    if (event.request.headers) {
      event.request.headers = scrubValue(event.request.headers) as Record<
        string,
        string
      >;
    }
  }
  if (event.extra) event.extra = scrubValue(event.extra) as typeof event.extra;
  if (event.contexts) event.contexts = scrubValue(event.contexts) as typeof event.contexts;
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((b) => ({
      ...b,
      data: b.data ? (scrubValue(b.data) as typeof b.data) : b.data,
      message: typeof b.message === "string" ? scrubValue(b.message) as string : b.message,
    }));
  }
  return event;
}
