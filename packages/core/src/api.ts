import { createServerClient } from "./server";
import type { HypherConfig } from "./types";

/** @deprecated Use `@hypher/core/server` for API-key clients. */
export function createClient(config: HypherConfig) {
  if (typeof window !== "undefined") {
    console.warn(
      "[hypher] Browser API-key clients are deprecated. Use @hypher/core/browser with a short-lived capture token provider."
    );
  }
  return createServerClient(config);
}
