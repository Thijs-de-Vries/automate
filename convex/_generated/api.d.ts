/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as appMetadata from "../appMetadata.js";
import type * as calisthenics from "../calisthenics.js";
import type * as constants from "../constants.js";
import type * as crons from "../crons.js";
import type * as notifications from "../notifications.js";
import type * as notificationsNode from "../notificationsNode.js";
import type * as packing from "../packing.js";
import type * as publicTransport from "../publicTransport.js";
import type * as publicTransportActions from "../publicTransportActions.js";
import type * as spaces from "../spaces.js";
import type * as tasks from "../tasks.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  appMetadata: typeof appMetadata;
  calisthenics: typeof calisthenics;
  constants: typeof constants;
  crons: typeof crons;
  notifications: typeof notifications;
  notificationsNode: typeof notificationsNode;
  packing: typeof packing;
  publicTransport: typeof publicTransport;
  publicTransportActions: typeof publicTransportActions;
  spaces: typeof spaces;
  tasks: typeof tasks;
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
