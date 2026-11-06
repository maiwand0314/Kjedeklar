/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as http from "../http.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_tenant from "../lib/tenant.js";
import type * as ops_guard from "../ops/guard.js";
import type * as ops_organizations from "../ops/organizations.js";
import type * as ops_seed from "../ops/seed.js";
import type * as ops_testing from "../ops/testing.js";
import type * as ops_users from "../ops/users.js";
import type * as organizations_queries from "../organizations/queries.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  http: typeof http;
  "lib/errors": typeof lib_errors;
  "lib/tenant": typeof lib_tenant;
  "ops/guard": typeof ops_guard;
  "ops/organizations": typeof ops_organizations;
  "ops/seed": typeof ops_seed;
  "ops/testing": typeof ops_testing;
  "ops/users": typeof ops_users;
  "organizations/queries": typeof organizations_queries;
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

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
};
