/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ResendOTP from "../ResendOTP.js";
import type * as ResendOTPPasswordReset from "../ResendOTPPasswordReset.js";
import type * as _lib_access from "../_lib/access.js";
import type * as amboss from "../amboss.js";
import type * as articles from "../articles.js";
import type * as auth from "../auth.js";
import type * as categories from "../categories.js";
import type * as codes from "../codes.js";
import type * as http from "../http.js";
import type * as ontology from "../ontology.js";
import type * as otpRateLimit from "../otpRateLimit.js";
import type * as overview from "../overview.js";
import type * as pipeline from "../pipeline.js";
import type * as sections from "../sections.js";
import type * as sources from "../sources.js";
import type * as specialties from "../specialties.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ResendOTP: typeof ResendOTP;
  ResendOTPPasswordReset: typeof ResendOTPPasswordReset;
  "_lib/access": typeof _lib_access;
  amboss: typeof amboss;
  articles: typeof articles;
  auth: typeof auth;
  categories: typeof categories;
  codes: typeof codes;
  http: typeof http;
  ontology: typeof ontology;
  otpRateLimit: typeof otpRateLimit;
  overview: typeof overview;
  pipeline: typeof pipeline;
  sections: typeof sections;
  sources: typeof sources;
  specialties: typeof specialties;
  users: typeof users;
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
