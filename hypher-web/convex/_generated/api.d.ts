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
import type * as beta from "../beta.js";
import type * as canvasShares from "../canvasShares.js";
import type * as connections from "../connections.js";
import type * as crons from "../crons.js";
import type * as digestEmail from "../digestEmail.js";
import type * as digestEmailDispatcher from "../digestEmailDispatcher.js";
import type * as github from "../github.js";
import type * as githubIntegrations from "../githubIntegrations.js";
import type * as githubInternal from "../githubInternal.js";
import type * as githubPat from "../githubPat.js";
import type * as githubProjectActions from "../githubProjectActions.js";
import type * as githubTokens from "../githubTokens.js";
import type * as http from "../http.js";
import type * as httpRateLimit from "../httpRateLimit.js";
import type * as launchReadiness from "../launchReadiness.js";
import type * as legacy from "../legacy.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_clerk from "../lib/clerk.js";
import type * as lib_quotedReply from "../lib/quotedReply.js";
import type * as lib_rateLimit from "../lib/rateLimit.js";
import type * as lib_samplePreviewConstants from "../lib/samplePreviewConstants.js";
import type * as objects from "../objects.js";
import type * as onboarding from "../onboarding.js";
import type * as projectMemories from "../projectMemories.js";
import type * as projects from "../projects.js";
import type * as seed from "../seed.js";
import type * as subscriptions from "../subscriptions.js";
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
  beta: typeof beta;
  canvasShares: typeof canvasShares;
  connections: typeof connections;
  crons: typeof crons;
  digestEmail: typeof digestEmail;
  digestEmailDispatcher: typeof digestEmailDispatcher;
  github: typeof github;
  githubIntegrations: typeof githubIntegrations;
  githubInternal: typeof githubInternal;
  githubPat: typeof githubPat;
  githubProjectActions: typeof githubProjectActions;
  githubTokens: typeof githubTokens;
  http: typeof http;
  httpRateLimit: typeof httpRateLimit;
  launchReadiness: typeof launchReadiness;
  legacy: typeof legacy;
  "lib/auth": typeof lib_auth;
  "lib/clerk": typeof lib_clerk;
  "lib/quotedReply": typeof lib_quotedReply;
  "lib/rateLimit": typeof lib_rateLimit;
  "lib/samplePreviewConstants": typeof lib_samplePreviewConstants;
  objects: typeof objects;
  onboarding: typeof onboarding;
  projectMemories: typeof projectMemories;
  projects: typeof projects;
  seed: typeof seed;
  subscriptions: typeof subscriptions;
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
