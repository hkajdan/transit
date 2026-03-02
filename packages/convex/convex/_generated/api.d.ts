/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as osm_enrich from "../osm/enrich.js";
import type * as osm_ingest from "../osm/ingest.js";
import type * as railways_queries from "../railways/queries.js";
import type * as railways_transform from "../railways/transform.js";
import type * as sncf_ingest from "../sncf/ingest.js";
import type * as sncf_ingest_railways from "../sncf/ingest_railways.js";
import type * as sncf_migrate from "../sncf/migrate.js";
import type * as sncf_migrate_railways from "../sncf/migrate_railways.js";
import type * as stations_queries from "../stations/queries.js";
import type * as stations_transform from "../stations/transform.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "osm/enrich": typeof osm_enrich;
  "osm/ingest": typeof osm_ingest;
  "railways/queries": typeof railways_queries;
  "railways/transform": typeof railways_transform;
  "sncf/ingest": typeof sncf_ingest;
  "sncf/ingest_railways": typeof sncf_ingest_railways;
  "sncf/migrate": typeof sncf_migrate;
  "sncf/migrate_railways": typeof sncf_migrate_railways;
  "stations/queries": typeof stations_queries;
  "stations/transform": typeof stations_transform;
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
