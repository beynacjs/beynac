/**
 * Type experiment file - implementations are stubs, only types matter
 *
 * Goal: Prove that route name/param types can flow correctly through:
 * - Individual routes extracting params from paths
 * - Groups merging multiple routes
 * - Name prefixes being applied to keys
 * - Path prefix params being added to all route params
 * - Nested groups accumulating both name and param prefixes
 */

import { expectTypeOf, test } from "bun:test";

// ============================================================================
// Type Helpers
// ============================================================================

/**
 * Extract parameter names from a path pattern
 * "/users/:id/:name" -> "id" | "name"
 * "/users" -> never
 */
type ExtractRouteParams<T extends string> = T extends `${infer _Start}:${infer Param}/${infer Rest}`
  ? Param | ExtractRouteParams<`/${Rest}`>
  : T extends `${infer _Start}:${infer Param}`
    ? Param
    : never;

/**
 * Extract the NameParamsMap from a Route or RouteGroup
 */
type ExtractMap<T> = T extends Route<infer Map> ? Map : T extends RouteGroup<infer Map> ? Map : {};

/**
 * Flatten intersection types and force IDE to display expanded form
 * { a: never } & { b: "id" } -> { a: never; b: "id" }
 */
type Prettify<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;

/**
 * Merge an array of Routes/RouteGroups via intersection, then prettify
 */
type MergeChildren<Children extends readonly any[]> = Prettify<
  Children extends readonly [infer First, ...infer Rest]
    ? ExtractMap<First> & MergeChildren<Rest>
    : {}
>;

/**
 * Add prefix params to all values in a map
 * { "show": "postId" } + "userId" -> { "show": "postId" | "userId" }
 * { "index": never } + "userId" -> { "index": "userId" }
 */
type AddPrefixParams<Map extends Record<string, string>, PrefixParams extends string> = {
  [K in keyof Map]: Map[K] extends never ? PrefixParams : Map[K] | PrefixParams;
};

/**
 * Prepend a name prefix to all keys in a map
 * { "show": "id" } + "users." -> { "users.show": "id" }
 */
type PrependNamePrefix<
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
type ParamsObject<U extends string> = U extends never ? {} : { [K in U]: string | number };

// ============================================================================
// Classes (phantom types only)
// ============================================================================

/**
 * A route with a name->params map
 * Route<{ "users.show": "id" | "name" }>
 * Route<{ "users.index": never }> // no params
 * Route<{}> // unnamed route
 */
class Route<NameParamsMap extends Record<string, string> = {}> {
  readonly __nameParamsMap!: NameParamsMap;
}

/**
 * A group of routes with merged name->params map
 */
class RouteGroup<NameParamsMap extends Record<string, string> = {}> {
  readonly __nameParamsMap!: NameParamsMap;

  /**
   * Generate a URL from a named route
   * - If route has no params (never), params argument is optional (can omit)
   * - If route has params, params argument is required
   */
  url<N extends keyof NameParamsMap & string>(
    name: N,
    ...args: NameParamsMap[N] extends never
      ? [] | [params?: ParamsObject<NameParamsMap[N]>]
      : [params: ParamsObject<NameParamsMap[N]>]
  ): string {
    return null as any;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a route
 */
function route<const Path extends string, const Name extends string = never>(
  path: Path,
  options?: { name?: Name },
): Name extends never ? Route<{}> : Route<{ [K in Name]: ExtractRouteParams<Path> }> {
  return null as any;
}

/**
 * Create a group of routes
 */
function group<
  const Children extends readonly (Route<any> | RouteGroup<any>)[],
  const PathPrefix extends string = "",
  const NamePrefix extends string = "",
>(
  options: { prefix?: PathPrefix; namePrefix?: NamePrefix },
  children: Children,
): RouteGroup<
  PrependNamePrefix<
    ExtractRouteParams<PathPrefix> extends never
      ? MergeChildren<Children>
      : AddPrefixParams<MergeChildren<Children>, ExtractRouteParams<PathPrefix>>,
    NamePrefix
  >
> {
  return new RouteGroup() as any;
}

// ============================================================================
// Tests - verify types flow correctly
// ============================================================================

test("ExtractRouteParams helper works", () => {
  type Test1 = ExtractRouteParams<"/users/:id">;
  expectTypeOf<Test1>().toEqualTypeOf<"id">();

  type Test2 = ExtractRouteParams<"/users/:id/:name">;
  expectTypeOf<Test2>().toEqualTypeOf<"id" | "name">();

  type Test3 = ExtractRouteParams<"/users">;
  expectTypeOf<Test3>().toEqualTypeOf<never>();
});

test("single route with params", () => {
  const r = route("/users/:id", { name: "show" });
  expectTypeOf(r).toEqualTypeOf<Route<{ show: "id" }>>();
});

test("single route with multiple params", () => {
  const r = route("/users/:id/posts/:postId", { name: "show" });
  expectTypeOf(r).toEqualTypeOf<Route<{ show: "id" | "postId" }>>();
});

test("single route without params", () => {
  const r = route("/users", { name: "index" });
  expectTypeOf(r).toEqualTypeOf<Route<{ index: never }>>();
});

test("unnamed route", () => {
  const r = route("/users");
  // Type check: verify it's a Route with empty map
  expectTypeOf(r).toHaveProperty("__nameParamsMap");
});

test("merge two routes", () => {
  const g = group({}, [route("/users", { name: "index" }), route("/users/:id", { name: "show" })]);

  expectTypeOf(g).toEqualTypeOf<
    RouteGroup<{
      index: never;
      show: "id";
    }>
  >();
});

test("merge routes with multiple params", () => {
  const g = group({}, [
    route("/users/:id/posts/:postId", { name: "userPost" }),
    route("/articles/:slug", { name: "article" }),
  ]);

  expectTypeOf(g).toEqualTypeOf<
    RouteGroup<{
      userPost: "id" | "postId";
      article: "slug";
    }>
  >();
});

test("name prefix", () => {
  const g = group({ namePrefix: "users." }, [
    route("/", { name: "index" }),
    route("/:id", { name: "show" }),
  ]);

  expectTypeOf(g).toEqualTypeOf<
    RouteGroup<{
      "users.index": never;
      "users.show": "id";
    }>
  >();
});

test("path prefix with params", () => {
  const g = group({ prefix: "/users/:userId" }, [route("/posts/:postId", { name: "show" })]);

  expectTypeOf(g).toEqualTypeOf<
    RouteGroup<{
      show: "userId" | "postId";
    }>
  >();
});

test("path prefix with params and no route params", () => {
  const g = group({ prefix: "/users/:userId" }, [route("/posts", { name: "index" })]);

  expectTypeOf(g).toEqualTypeOf<
    RouteGroup<{
      index: "userId";
    }>
  >();
});

test("nested groups", () => {
  const inner = group({ namePrefix: "users." }, [
    route("/", { name: "index" }),
    route("/:id", { name: "show" }),
  ]);

  const outer = group({ namePrefix: "api." }, [inner]);

  expectTypeOf(outer).toEqualTypeOf<
    RouteGroup<{
      "api.users.index": never;
      "api.users.show": "id";
    }>
  >();
});

test("nested groups accumulate prefix params", () => {
  const inner = group({ prefix: "/users/:userId", namePrefix: "users." }, [
    route("/posts/:postId", { name: "show" }),
  ]);

  const outer = group({ prefix: "/api/:version", namePrefix: "api." }, [inner]);

  expectTypeOf(outer).toEqualTypeOf<
    RouteGroup<{
      "api.users.show": "version" | "userId" | "postId";
    }>
  >();
});

test("merge routes and groups", () => {
  const usersGroup = group({ namePrefix: "users." }, [
    route("/", { name: "index" }),
    route("/:id", { name: "show" }),
  ]);

  const combined = group({}, [usersGroup, route("/health", { name: "health" })]);

  expectTypeOf(combined).toEqualTypeOf<
    RouteGroup<{
      "users.index": never;
      "users.show": "id";
      health: never;
    }>
  >();
});

test("deeply nested groups with full prefix accumulation", () => {
  // Inner group: has name prefix + path prefix with param
  const orgsGroup = group({ prefix: "/orgs/:orgId", namePrefix: "orgs." }, [
    route("/users", { name: "users" }),
    route("/users/:userId", { name: "userDetail" }),
  ]);

  // Outer group: has name prefix + path prefix with param, contains inner group + standalone route
  const apiRoutes = group({ prefix: "/api/:version", namePrefix: "api." }, [
    orgsGroup,
    route("/health", { name: "health" }),
  ]);

  expectTypeOf(apiRoutes).toEqualTypeOf<
    RouteGroup<{
      "api.orgs.users": "version" | "orgId";
      "api.orgs.userDetail": "version" | "orgId" | "userId";
      "api.health": "version";
    }>
  >();

  // Verify url() works with accumulated params
  apiRoutes.url("api.orgs.users", { version: "v1", orgId: "org123" });
  apiRoutes.url("api.orgs.userDetail", { version: "v1", orgId: "org123", userId: "user456" });
  apiRoutes.url("api.health", { version: "v1" });
});

test("url() method with no params", () => {
  const g = group({}, [route("/users", { name: "index" })]);

  // Should allow calling without params
  g.url("index");
});

test("url() method with params", () => {
  const g = group({}, [route("/users/:id", { name: "show" })]);

  // Should require params
  g.url("show", { id: "123" });
  g.url("show", { id: 456 });

  // Type check: verify return type is string
  expectTypeOf(g.url("show", { id: "123" })).toBeString();
});

test("url() method with multiple params", () => {
  const g = group({}, [route("/users/:userId/posts/:postId", { name: "show" })]);

  g.url("show", { userId: "u123", postId: "p456" });
  g.url("show", { userId: 1, postId: 2 });
});

test("url() method with mixed routes", () => {
  const g = group({}, [
    route("/users", { name: "index" }),
    route("/users/:id", { name: "show" }),
    route("/users/:id/posts/:postId", { name: "userPost" }),
  ]);

  // No params
  g.url("index");

  // Single param
  g.url("show", { id: "123" });

  // Multiple params
  g.url("userPost", { id: "u1", postId: "p1" });

  // Type check: verify return types
  expectTypeOf(g.url("index")).toBeString();
  expectTypeOf(g.url("show", { id: "123" })).toBeString();
  expectTypeOf(g.url("userPost", { id: "u1", postId: "p1" })).toBeString();
});
