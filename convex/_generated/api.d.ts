/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as account_actions from "../account/actions.js";
import type * as account_queries from "../account/queries.js";
import type * as auth from "../auth.js";
import type * as email_actions from "../email/actions.js";
import type * as email_config from "../email/config.js";
import type * as email_seal from "../email/seal.js";
import type * as email_templates from "../email/templates.js";
import type * as http from "../http.js";
import type * as invitations_actions from "../invitations/actions.js";
import type * as invitations_internal from "../invitations/internal.js";
import type * as invitations_model from "../invitations/model.js";
import type * as invitations_mutations from "../invitations/mutations.js";
import type * as invitations_queries from "../invitations/queries.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_invitation from "../lib/invitation.js";
import type * as lib_rls from "../lib/rls.js";
import type * as lib_tenant from "../lib/tenant.js";
import type * as lib_verification from "../lib/verification.js";
import type * as ops_guard from "../ops/guard.js";
import type * as ops_organizations from "../ops/organizations.js";
import type * as ops_seed from "../ops/seed.js";
import type * as ops_testing from "../ops/testing.js";
import type * as ops_users from "../ops/users.js";
import type * as ops_workspaces from "../ops/workspaces.js";
import type * as organizations_queries from "../organizations/queries.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "account/actions": typeof account_actions;
  "account/queries": typeof account_queries;
  auth: typeof auth;
  "email/actions": typeof email_actions;
  "email/config": typeof email_config;
  "email/seal": typeof email_seal;
  "email/templates": typeof email_templates;
  http: typeof http;
  "invitations/actions": typeof invitations_actions;
  "invitations/internal": typeof invitations_internal;
  "invitations/model": typeof invitations_model;
  "invitations/mutations": typeof invitations_mutations;
  "invitations/queries": typeof invitations_queries;
  "lib/errors": typeof lib_errors;
  "lib/invitation": typeof lib_invitation;
  "lib/rls": typeof lib_rls;
  "lib/tenant": typeof lib_tenant;
  "lib/verification": typeof lib_verification;
  "ops/guard": typeof ops_guard;
  "ops/organizations": typeof ops_organizations;
  "ops/seed": typeof ops_seed;
  "ops/testing": typeof ops_testing;
  "ops/users": typeof ops_users;
  "ops/workspaces": typeof ops_workspaces;
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
