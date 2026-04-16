/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activity from "../activity.js";
import type * as ai from "../ai.js";
import type * as apiKeys from "../apiKeys.js";
import type * as connections from "../connections.js";
import type * as crons from "../crons.js";
import type * as github from "../github.js";
import type * as githubInternal from "../githubInternal.js";
import type * as http from "../http.js";
import type * as legacy from "../legacy.js";
import type * as objects from "../objects.js";
import type * as tags from "../tags.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activity: typeof activity;
  ai: typeof ai;
  apiKeys: typeof apiKeys;
  connections: typeof connections;
  crons: typeof crons;
  github: typeof github;
  githubInternal: typeof githubInternal;
  http: typeof http;
  legacy: typeof legacy;
  objects: typeof objects;
  tags: typeof tags;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
