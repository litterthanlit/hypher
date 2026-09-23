/**
 * `_generated/api.d.ts` predates `projectMemoryMcp` and `structuredHandoffs`, so
 * `internal.structuredHandoffs.*` / `api.structuredHandoffs.*` do not typecheck
 * even though the functions are deployed (Convex's runtime `api` / `internal`
 * are proxies that accept any path). Until codegen runs against a deployment,
 * type those two modules from their source here. Once codegen lists both
 * modules, delete this file and use `_generated/api` directly.
 *
 * The Next.js side imports only the type (`import type { GeneratedApiGap }`) and
 * casts `api` once in `src/app/api/mcp/route.ts`.
 */
import type { ApiFromModules, FilterApi, FunctionReference } from "convex/server";
import { internal as generatedInternal } from "../_generated/api";
import type * as projectMemoryMcp from "../projectMemoryMcp";
import type * as structuredHandoffs from "../structuredHandoffs";

export type GeneratedApiGap<Visibility extends "public" | "internal"> = FilterApi<
  ApiFromModules<{
    projectMemoryMcp: typeof projectMemoryMcp;
    structuredHandoffs: typeof structuredHandoffs;
  }>,
  FunctionReference<any, Visibility>
>;

export const internal = generatedInternal as typeof generatedInternal & GeneratedApiGap<"internal">;
