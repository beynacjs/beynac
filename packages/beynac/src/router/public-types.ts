import type { MiddlewareReference } from "../core/Middleware";
import type { RouteDefinition, RouteHandler } from "./internal-types";

// ============================================================================
// Public Types
// ============================================================================

/**
 * Route constraint - can be RegExp or validation function
 */
export type RouteConstraint = RegExp | ((value: string) => boolean);

/**
 * Collection of routes with type-tracked name→params map
 */
export interface Routes<Params extends Record<string, string> = {}> {
  readonly __nameParamsMap?: Params; // Phantom type for type inference
  readonly routes: readonly RouteDefinition[]; // Flat array of route definitions (internal structure)
}

/**
 * Base options shared by both routes and groups
 */
export interface BaseRouteOptions {
  /** Middleware applied to route(s) */
  middleware?: MiddlewareReference | MiddlewareReference[];

  /** Middleware to exclude from parent groups */
  withoutMiddleware?: MiddlewareReference | MiddlewareReference[];

  /** Domain pattern constraint */
  domain?: string;

  /** Parameter constraints */
  where?: Record<string, RouteConstraint>;
}

// Re-export internal types for use within the router package
// RouteDefinition is not exported from index.ts so it remains internal
// RouteHandler IS exported from index.ts as it's part of the public API
export type { RouteDefinition, RouteHandler };

/**
 * Options for individual routes
 */
export interface RouteOptions<Name extends string = never> extends BaseRouteOptions {
  /** Route name for URL generation */
  name?: Name;
}

/**
 * Options for route groups
 */
export interface RouteGroupOptions<NamePrefix extends string = ""> extends BaseRouteOptions {
  /** Path prefix for all routes in group */
  prefix?: string;

  /** Name prefix for all routes in group (e.g., "admin.") */
  namePrefix?: NamePrefix;
}

/**
 * Type-safe URL generation function
 * - Routes without params: url("route.name")
 * - Routes with params: url("route.name", { id: 123 }) - params required by TypeScript
 */
export type UrlFunction<Params extends Record<string, string>> = <N extends keyof Params & string>(
  name: N,
  ...args: Params[N] extends never
    ? [] | [params?: ParamsObject<Params[N]>]
    : [params: ParamsObject<Params[N]>]
) => string;

// ============================================================================
// Helper Types (not exported)
// ============================================================================

/**
 * Extract parameter names from a path pattern
 * "/users/{id}/{name}" -> "id" | "name"
 * "/files/{...path}" -> "path"
 * "/users/{id}/files/{...path}" -> "id" | "path"
 * "/users" -> never
 */
export type ExtractRouteParams<T extends string> =
  // First try to match regular {param} at the beginning
  T extends `${infer Before}{${infer Param}}${infer After}`
    ? // Check if this is actually a wildcard {...param}
      Param extends `...${infer WildcardParam}`
      ? WildcardParam | ExtractRouteParams<`${Before}${After}`>
      : // Regular param
        Param | ExtractRouteParams<`${Before}${After}`>
    : never;

/**
 * Extract parameters from both domain and path, returning union of both
 * Domain: "{account}.example.com", Path: "/users/{id}" -> "account" | "id"
 */
export type ExtractDomainAndPathParams<
  Domain extends string | undefined,
  Path extends string,
> = Domain extends string
  ? ExtractRouteParams<Domain> | ExtractRouteParams<Path>
  : ExtractRouteParams<Path>;

/**
 * Extract the NameParamsMap from Routes
 */
export type ExtractMap<T> = T extends Routes<infer Map> ? Map : {};

/**
 * Flatten intersection types and force IDE to display expanded form
 * { a: never } & { b: "id" } -> { a: never; b: "id" }
 */
export type Prettify<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;

/**
 * Merge an array of Routes via intersection, then prettify
 */
export type MergeChildren<Children extends readonly unknown[]> = Prettify<
  Children extends readonly [infer First, ...infer Rest]
    ? ExtractMap<First> & MergeChildren<Rest>
    : {}
>;

/**
 * Add prefix params to all values in a map
 * { "show": "postId" } + "userId" -> { "show": "postId" | "userId" }
 * { "index": never } + "userId" -> { "index": "userId" }
 */
export type AddPrefixParams<Map extends Record<string, string>, PrefixParams extends string> = {
  [K in keyof Map]: Map[K] extends never ? PrefixParams : Map[K] | PrefixParams;
};

/**
 * Prepend a name prefix to all keys in a map
 * { "show": "id" } + "users." -> { "users.show": "id" }
 */
export type PrependNamePrefix<
  Map extends Record<string, string>,
  Prefix extends string,
> = Prefix extends ""
  ? Map
  : {
      [K in keyof Map as K extends string ? `${Prefix}${K}` : never]: Map[K];
    };

/**
 * Convert a union of param names to an object type
 * "id" | "name" -> { id: string | number, name: string | number }
 * never -> {} (no params needed)
 */
export type ParamsObject<U extends string> = U extends never ? {} : { [K in U]: string | number };
