import type { Controller } from "../core/Controller";
import type { MiddlewareReference } from "../core/Middleware";
import type { NoArgConstructor } from "../utils";
import type { MiddlewareSet } from "./MiddlewareSet";

/**
 * A collection of route definitions, returned by route creation functions like
 * get(), post(), group(), etc. This type includes type information about route
 * names and their parameters, enabling type-safe URL generation.
 *
 * The generic parameter `Params` is a map of route names to their parameter
 * names, used for type-safe URL generation with RouteRegistry.url().
 *
 * @example
 * // Single route with no parameters
 * const routes = get('/dashboard', DashboardController, { name: 'dashboard' })
 * // routes is Routes<{ dashboard: never }>
 *
 * @example
 * // Single route with parameters
 * const routes = get('/users/{id}', UserController, { name: 'users.show' })
 * // routes is Routes<{ 'users.show': 'id' }>
 *
 * @example
 * // Multiple routes combined
 * const routes = group([
 *   get('/users', UsersController, { name: 'users.index' }),
 *   get('/users/{id}', UserController, { name: 'users.show' }),
 * ])
 * // routes is Routes<{ 'users.index': never, 'users.show': 'id' }>
 */
export type Routes<Params extends Record<string, string> = {}> = readonly RouteDefinition[] & {
  readonly __nameParamsMap?: Params; // Phantom type for type inference
};

/**
 * Base options shared by both routes and groups
 */
interface BaseRouteOptions<PathPart extends string> {
  /**
   * A middleware class or array of classes
   */
  middleware?: MiddlewareReference | MiddlewareReference[];

  /**
   * Remove middleware that was added in this or a parent group
   */
  withoutMiddleware?: MiddlewareReference | MiddlewareReference[];

  /**
   * Domain pattern constraint, e.g. "api.example.com". Can contain patterns
   * capture a parameter e.g. "{customer}.example.com"
   */
  domain?: string;

  /**
   * Define a required format for parameters. If the route matches but the
   * parameter does not have the correct format, a 404 response will be sent.
   * This uses typescript validation, you can only validate params added in the
   * same route or group.
   *
   * @example
   * get(/user/{id}, UserController, {where: {id: 'uuid'}})
   */
  where?: Partial<Record<ExtractRouteParams<PathPart>, ParamConstraint>>;

  /**
   * Define a required format for parameters. This is like `where`, but can
   * apply to parameters defined anywhere.
   *
   * If the route matches but the parameter does not have the correct format, a
   * 404 response will be sent. This uses typescript validation, you can only
   * validate params added in the same route or group.
   *
   * @example
   * // require that all `id` parameters in child routes are UUIDs
   * group({where: {id: 'uuid'}}, [
   *    ... define child routes...
   * ])
   */
  parameterPatterns?: Record<string, ParamConstraint>;
}

/**
 * Options for individual routes defined in e.g. get(), post() etc
 */
export interface RouteOptions<Name extends string, Path extends string>
  extends BaseRouteOptions<Path> {
  /**
   * Route name for URL generation
   *
   * @example
   * get('/user/{id}', UserController, {name: 'users.show'})
   * // later
   * app.url('users.show', {id: '123'}); // returns 'https://example.com/user/123'
   */
  name?: Name;
}

/**
 * Options for route groups, which allow you to apply shared configuration to
 * multiple routes at once.
 */
export interface RouteGroupOptions<NamePrefix extends string = "", PathPrefix extends string = "">
  extends BaseRouteOptions<PathPrefix> {
  /**
   * Path prefix for all routes in the group. The prefix will be prepended to
   * all route paths.
   *
   * @example
   * group({ prefix: '/api/v1' }, [
   *   get('/users', UsersController), // matches '/api/v1/users'
   * ])
   */
  prefix?: PathPrefix;

  /**
   * Name prefix for all routes in the group. The prefix will be prepended to
   * all route names, allowing you to organize routes hierarchically.
   *
   * @example
   * group({ namePrefix: 'admin.' }, [
   *   get('/dashboard', DashboardController, { name: 'dashboard' }), // name: 'admin.dashboard'
   *   get('/users', UsersController, { name: 'users' }), // name: 'admin.users'
   * ])
   */
  namePrefix?: NamePrefix;
}

/**
 * A route handler can be either a Controller instance or a Controller class.
 * The router will automatically instantiate controller classes when needed.
 *
 * @example
 * // Using a controller class
 * get('/users', UsersController)
 *
 * @example
 * // Using an inline controller object
 * get('/health', {
 *   handle() {
 *     return new Response('OK');
 *   }
 * })
 */
export type RouteHandler = Controller | NoArgConstructor<Controller>;

export type UrlFunction<Params extends Record<string, string>> = <N extends keyof Params & string>(
  name: N,
  ...args: Params[N] extends never
    ? [] | [params?: ParamsObject<Params[N]>]
    : [params: ParamsObject<Params[N]>]
) => string;

export type ParamsObject<U extends string> = Prettify<Record<U, string | number>>;

export type BuiltInRouteConstraint = "numeric" | "alphanumeric" | "uuid" | "ulid";

export type ParamConstraint = BuiltInRouteConstraint | RegExp | ((value: string) => boolean);

export type ParamConstraints = Record<string, ParamConstraint | undefined>;

export interface RouteDefinition {
  methods: readonly string[];
  path: string;
  handler: RouteHandler;
  routeName?: string | undefined;
  middleware: MiddlewareSet | null;
  constraints: ParamConstraints | null;
  globalConstraints: ParamConstraints | null;
  domainPattern?: string | undefined;
}

export interface RouteMatch {
  route: RouteDefinition;
  params: Record<string, string>;
}

export interface RouteMatcher {
  register(route: RouteDefinition): void;
  match(method: string, path: string, hostname: string): RouteMatch | undefined;
}

/**
 * Extract parameter names from a path pattern
 * "/users/{id}/{...rest}" -> "id" | "rest"
 */
export type ExtractRouteParams<T extends string> =
  T extends `${infer Before}{${infer Param}}${infer After}`
    ? Param extends `...${infer WildcardParam}`
      ? WildcardParam | ExtractRouteParams<`${Before}${After}`>
      : Param | ExtractRouteParams<`${Before}${After}`>
    : never;

export type ExtractDomainAndPathParams<
  Domain extends string | undefined,
  Path extends string,
> = Domain extends string
  ? ExtractRouteParams<Domain> | ExtractRouteParams<Path>
  : ExtractRouteParams<Path>;

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

type ExtractMap<T> = T extends Routes<infer Map> ? Map : {};

export type AddPrefixParams<Map extends Record<string, string>, PrefixParams extends string> = {
  [K in keyof Map]: Map[K] extends never ? PrefixParams : Map[K] | PrefixParams;
};

/**
 * Prepend a name prefix to all keys in a map
 * { "show": "id" } + "users." -> { "users.show": "id" }
 */
export type PrependNamePrefix<Map extends Record<string, string>, Prefix extends string> = {
  [K in keyof Map as K extends string ? `${Prefix}${K}` : never]: Map[K];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- `any` was the only way I could get type checking to work here
export type GroupChildren = readonly Routes<any>[];

export type GroupedRoutes<
  Children extends GroupChildren,
  NamePrefix extends string = "",
  PathPrefix extends string = "",
> = Routes<
  PrependNamePrefix<
    ExtractRouteParams<PathPrefix> extends never
      ? MergeChildren<Children>
      : AddPrefixParams<MergeChildren<Children>, ExtractRouteParams<PathPrefix>>,
    NamePrefix
  >
>;
