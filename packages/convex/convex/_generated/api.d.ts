/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as railways_queries from "../railways/queries.js";
import type * as railways_transform from "../railways/transform.js";
import type * as stations_queries from "../stations/queries.js";
import type * as stations_transform from "../stations/transform.js";
import type * as z_osm_stations from "../z_osm/stations.js";
import type * as z_sncf_railways from "../z_sncf/railways.js";
import type * as z_sncf_stations from "../z_sncf/stations.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "railways/queries": typeof railways_queries;
  "railways/transform": typeof railways_transform;
  "stations/queries": typeof stations_queries;
  "stations/transform": typeof stations_transform;
  "z_osm/stations": typeof z_osm_stations;
  "z_sncf/railways": typeof z_sncf_railways;
  "z_sncf/stations": typeof z_sncf_stations;
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
