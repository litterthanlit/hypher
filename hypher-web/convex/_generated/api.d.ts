/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as actions from "../actions.js";
import type * as activity from "../activity.js";
import type * as agentEvents from "../agentEvents.js";
import type * as ai from "../ai.js";
import type * as apiKeys from "../apiKeys.js";
import type * as authz from "../authz.js";
import type * as beta from "../beta.js";
import type * as captureTokens from "../captureTokens.js";
import type * as connections from "../connections.js";
import type * as crons from "../crons.js";
import type * as github from "../github.js";
import type * as githubIntegrations from "../githubIntegrations.js";
import type * as githubInternal from "../githubInternal.js";
import type * as githubPat from "../githubPat.js";
import type * as githubProjectActions from "../githubProjectActions.js";
import type * as githubTokens from "../githubTokens.js";
import type * as handoffs from "../handoffs.js";
import type * as http from "../http.js";
import type * as httpRateLimit from "../httpRateLimit.js";
import type * as launchReadiness from "../launchReadiness.js";
import type * as legacy from "../legacy.js";
import type * as lib_actionAuth from "../lib/actionAuth.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_clerk from "../lib/clerk.js";
import type * as lib_rateLimit from "../lib/rateLimit.js";
import type * as oauth from "../oauth.js";
import type * as oauthContext from "../oauthContext.js";
import type * as objects from "../objects.js";
import type * as projectMemories from "../projectMemories.js";
import type * as projects from "../projects.js";
import type * as subscriptions from "../subscriptions.js";
import type * as tags from "../tags.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  actions: typeof actions;
  activity: typeof activity;
  agentEvents: typeof agentEvents;
  ai: typeof ai;
  apiKeys: typeof apiKeys;
  authz: typeof authz;
  beta: typeof beta;
  captureTokens: typeof captureTokens;
  connections: typeof connections;
  crons: typeof crons;
  github: typeof github;
  githubIntegrations: typeof githubIntegrations;
  githubInternal: typeof githubInternal;
  githubPat: typeof githubPat;
  githubProjectActions: typeof githubProjectActions;
  githubTokens: typeof githubTokens;
  handoffs: typeof handoffs;
  http: typeof http;
  httpRateLimit: typeof httpRateLimit;
  launchReadiness: typeof launchReadiness;
  legacy: typeof legacy;
  "lib/actionAuth": typeof lib_actionAuth;
  "lib/auth": typeof lib_auth;
  "lib/clerk": typeof lib_clerk;
  "lib/rateLimit": typeof lib_rateLimit;
  oauth: typeof oauth;
  oauthContext: typeof oauthContext;
  objects: typeof objects;
  projectMemories: typeof projectMemories;
  projects: typeof projects;
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
