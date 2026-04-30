/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as amboss from "../amboss.js";
import type * as articles from "../articles.js";
import type * as categories from "../categories.js";
import type * as codes from "../codes.js";
import type * as ontology from "../ontology.js";
import type * as overview from "../overview.js";
import type * as pipeline from "../pipeline.js";
import type * as sections from "../sections.js";
import type * as sources from "../sources.js";
import type * as specialties from "../specialties.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  amboss: typeof amboss;
  articles: typeof articles;
  categories: typeof categories;
  codes: typeof codes;
  ontology: typeof ontology;
  overview: typeof overview;
  pipeline: typeof pipeline;
  sections: typeof sections;
  sources: typeof sources;
  specialties: typeof specialties;
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
