import { addRoute, createRouter, findRoute, RouterContext } from "rou3";
import type { Container } from "../container";
import type { NoArgConstructor } from "../utils";
import { arrayWrap } from "../utils";
import type { Controller } from "./Controller";
import type { MiddlewareReference } from "./Middleware";

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * A route handler can be a Controller instance or class constructor
 */
export type RouteHandler = Controller | NoArgConstructor<Controller>;

/**
 * Route constraint - can be RegExp or validation function
 */
export type RouteConstraint = RegExp | ((value: string) => boolean);

/**
 * Parameter constraint definition
 */
interface ParameterConstraint {
  param: string;
  pattern: RouteConstraint;
}

/**
 * A single route definition (pure data, no methods)
 */
export interface RouteDefinition {
  methods: readonly string[];
  path: string;
  handler: RouteHandler;
  routeName?: string | undefined;
  middleware: MiddlewareReference[];
  constraints: ParameterConstraint[];
  domainPattern?: string | undefined;
  redirect?: { to: string; status: number } | undefined;
}

/**
 * Collection of routes with type-tracked name→params map
 */
export interface Routes<Params extends Record<string, string> = {}> {
  readonly __nameParamsMap?: Params; // Phantom type for type inference
  readonly routes: readonly RouteDefinition[]; // Flat array of route definitions
}

/**
 * Base options shared by both routes and groups
 */
export interface BaseRouteOptions {
  /** Middleware applied to route(s) */
  middleware?: MiddlewareReference | MiddlewareReference[];

  /** Domain pattern constraint */
  domain?: string;

  /** Parameter constraints */
  where?: Record<string, RouteConstraint>;
}

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

// ============================================================================
// Type Helper Utilities
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
 * Extract the NameParamsMap from Routes
 */
type ExtractMap<T> = T extends Routes<infer Map> ? Map : {};

/**
 * Flatten intersection types and force IDE to display expanded form
 * { a: never } & { b: "id" } -> { a: never; b: "id" }
 */
type Prettify<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;

/**
 * Merge an array of Routes via intersection, then prettify
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
// Constraint Helpers
// ============================================================================

/** Constraint: parameter must be numeric */
export const isNumber: RegExp = /^\d+$/;

/** Constraint: parameter must be alphabetic */
export const isAlpha: RegExp = /^[a-zA-Z]+$/;

/** Constraint: parameter must be alphanumeric */
export const isAlphaNumeric: RegExp = /^[a-zA-Z0-9]+$/;

/** Constraint: parameter must be UUID v4 */
export const isUuid: RegExp =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Constraint: parameter must be ULID */
export const isUlid: RegExp = /^[0-9A-HJKMNP-TV-Z]{26}$/i;

/** Constraint: parameter must be one of the given values */
export function isIn(values: readonly string[]): RegExp {
  return new RegExp(`^(${values.join("|")})$`);
}

// ============================================================================
// Routes Factory
// ============================================================================

/**
 * Create a Routes collection from an array of RouteDefinition
 */
function createRoutes<Params extends Record<string, string> = {}>(
  routes: RouteDefinition[],
): Routes<Params> {
  return { routes };
}

// ============================================================================
// Route Registry
// ============================================================================

/**
 * Registry for named routes with type-safe URL generation
 */
export class RouteRegistry<Params extends Record<string, string> = {}> {
  readonly url: UrlFunction<Params>;
  private namedRoutes = new Map<string, RouteDefinition>();

  constructor(routes: Routes<Params>) {
    // Build map of named routes
    for (const route of routes.routes) {
      if (route.routeName) {
        this.namedRoutes.set(route.routeName, route);
      }
    }

    // Create type-safe URL generation function
    this.url = (name, ...args) => {
      const route = this.namedRoutes.get(name);
      if (!route) {
        throw new Error(`Route "${name}" not found`);
      }

      const params = args[0] || {};
      let path = route.path;
      for (const [key, value] of Object.entries(params)) {
        path = path.replace(`:${key}`, String(value));
      }
      return path;
    };
  }
}

// ============================================================================
// Router Implementation
// ============================================================================

/**
 * Global parameter constraints
 */
const globalConstraints = new Map<string, RouteConstraint>();

/**
 * RouterV2 - New routing implementation
 */
export class RouterV2 {
  private router: RouterContext<{ route: RouteDefinition }>;
  private namedRoutes = new Map<string, RouteDefinition>();

  constructor(private container: Container) {
    this.router = createRouter<{ route: RouteDefinition }>();
  }

  /**
   * Register routes with the router
   */
  register(routes: Routes<any>): void {
    for (const route of routes.routes) {
      this.#registerRoute(route);
    }
  }

  #registerRoute(route: RouteDefinition): void {
    // Track named routes for URL generation
    if (route.routeName) {
      this.namedRoutes.set(route.routeName, route);
    }

    // Register route for each HTTP method
    for (const method of route.methods) {
      addRoute(this.router, method, route.path, { route });
    }
  }

  /**
   * Handle an HTTP request
   */
  async handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const hostname = url.hostname;

    // Try to match route
    const match = this.#match(request.method, url.pathname, hostname);

    if (!match) {
      return new Response("Not Found", { status: 404 });
    }

    return this.#executeRoute(match.route, request, match.params);
  }

  #match(method: string, path: string, hostname: string) {
    const result = findRoute(this.router, method, path);
    if (!result) {
      return undefined;
    }

    const data = result.data;
    const route = data.route;

    // Check domain constraint
    if (route.domainPattern && !this.#matchDomain(hostname, route.domainPattern)) {
      return undefined;
    }

    const params = result.params || {};

    // Check parameter constraints
    if (!this.#checkConstraints(route, params)) {
      return undefined;
    }

    return {
      route,
      params,
    };
  }

  #matchDomain(hostname: string, pattern: string): boolean {
    // Convert pattern to regex, replacing {param} with capture groups
    const regexPattern = pattern.replace(/\{([^}]+)\}/g, "([^.]+)");
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(hostname);
  }

  #checkConstraints(route: RouteDefinition, params: Record<string, string>): boolean {
    // Check route-specific constraints
    for (const constraint of route.constraints) {
      const value = params[constraint.param];
      if (value) {
        // Support both RegExp and function constraints
        if (typeof constraint.pattern === "function") {
          if (!constraint.pattern(value)) return false;
        } else {
          if (!constraint.pattern.test(value)) return false;
        }
      }
    }

    // Check global constraints
    for (const [param, pattern] of globalConstraints) {
      const value = params[param];
      if (value) {
        if (typeof pattern === "function") {
          if (!pattern(value)) return false;
        } else {
          if (!pattern.test(value)) return false;
        }
      }
    }

    return true;
  }

  async #executeRoute(
    route: RouteDefinition,
    request: Request,
    params: Record<string, string>,
  ): Promise<Response> {
    // Handle redirects
    if (route.redirect) {
      return new Response(null, {
        status: route.redirect.status,
        headers: { Location: route.redirect.to },
      });
    }

    // Execute middleware pipeline
    const finalHandler = async (req: Request): Promise<Response> => {
      let handler: RouteHandler = route.handler;

      // Instantiate controller if it's a class
      if (typeof handler === "function" && "prototype" in handler) {
        handler = this.container.get(handler as NoArgConstructor<Controller>);
      }

      // Call controller's handle method
      return (handler as Controller).handle(req, params);
    };

    return this.#executeMiddlewarePipeline(route.middleware, request, finalHandler);
  }

  async #executeMiddlewarePipeline(
    middlewareRefs: MiddlewareReference[],
    request: Request,
    finalHandler: (request: Request) => Response | Promise<Response>,
  ): Promise<Response> {
    const middlewareInstances = middlewareRefs.map((ref) => {
      if (typeof ref === "function") {
        return this.container.get(ref);
      }
      return ref;
    });

    // Build pipeline from innermost to outermost
    let next: (request: Request) => Response | Promise<Response> = finalHandler;

    for (let i = middlewareInstances.length - 1; i >= 0; i--) {
      const middleware = middlewareInstances[i];
      const currentNext = next;
      next = (request: Request) => middleware.handle(request, currentNext);
    }

    return next(request);
  }

  /**
   * Generate a URL from a named route
   * @param name The route name
   * @param params Optional parameters to fill in route placeholders
   * @returns The generated URL path
   * @throws Error if the route name is not found
   */
  routeUrl(name: string, params: Record<string, string | number> = {}): string {
    const route = this.namedRoutes.get(name);
    if (!route) {
      throw new Error(`Route "${name}" not found`);
    }

    let path = route.path;

    // Replace parameter placeholders with provided values
    for (const [key, value] of Object.entries(params)) {
      path = path.replace(`:${key}`, String(value));
    }

    return path;
  }
}

// ============================================================================
// Global Helper Functions
// ============================================================================

// --- HTTP Method Routes ---

/**
 * Helper to create a route with common logic
 */
function createRoute<const Path extends string, const Name extends string = never>(
  method: string | readonly string[],
  path: Path,
  handler: RouteHandler,
  options?: RouteOptions<Name>,
): [Name] extends [never] ? Routes<{}> : Routes<{ [K in Name]: ExtractRouteParams<Path> }> {
  const methods = typeof method === "string" ? [method] : method;

  // Convert where constraints to ParameterConstraint[]
  const constraints: ParameterConstraint[] = [];
  if (options?.where) {
    for (const [param, pattern] of Object.entries(options.where)) {
      constraints.push({ param, pattern });
    }
  }

  const route: RouteDefinition = {
    methods,
    path,
    handler,
    routeName: options?.name,
    middleware: options?.middleware ? arrayWrap(options.middleware) : [],
    constraints,
    domainPattern: options?.domain,
  };

  return createRoutes([route]) as any;
}

/**
 * Type for HTTP method route functions
 */
type RouteMethodFunction = <const Path extends string, const Name extends string = never>(
  path: Path,
  handler: RouteHandler,
  options?: RouteOptions<Name>,
) => [Name] extends [never] ? Routes<{}> : Routes<{ [K in Name]: ExtractRouteParams<Path> }>;

export const get: RouteMethodFunction = (path, handler, options) =>
  createRoute("GET", path, handler, options);

export const post: RouteMethodFunction = (path, handler, options) =>
  createRoute("POST", path, handler, options);

export const put: RouteMethodFunction = (path, handler, options) =>
  createRoute("PUT", path, handler, options);

export const patch: RouteMethodFunction = (path, handler, options) =>
  createRoute("PATCH", path, handler, options);

export const delete_: RouteMethodFunction = (path, handler, options) =>
  createRoute("DELETE", path, handler, options);

export const options: RouteMethodFunction = (path, handler, options) =>
  createRoute("OPTIONS", path, handler, options);

// --- Multi-Method Routes ---

export function match<const Path extends string, const Name extends string = never>(
  methods: readonly string[],
  path: Path,
  handler: RouteHandler,
  options?: RouteOptions<Name>,
): [Name] extends [never] ? Routes<{}> : Routes<{ [K in Name]: ExtractRouteParams<Path> }> {
  return createRoute(methods, path, handler, options);
}

export function any<const Path extends string, const Name extends string = never>(
  path: Path,
  handler: RouteHandler,
  options?: RouteOptions<Name>,
): [Name] extends [never] ? Routes<{}> : Routes<{ [K in Name]: ExtractRouteParams<Path> }> {
  const methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"];
  return match(methods, path, handler, options);
}

// --- Special Routes ---

export function redirect<const Path extends string>(
  from: Path,
  to: string,
  status = 302,
): Routes<{}> {
  const route: RouteDefinition = {
    methods: ["GET"],
    path: from,
    handler: {
      handle() {
        return new Response(null, { status, headers: { Location: to } });
      },
    },
    middleware: [],
    constraints: [],
    redirect: { to, status },
  };
  return createRoutes([route]);
}

export function permanentRedirect<const Path extends string>(from: Path, to: string): Routes<{}> {
  return redirect(from, to, 301);
}

// --- Route Grouping ---

/**
 * Helper to apply path prefix
 */
function applyPathPrefix(prefix: string | undefined, path: string): string {
  if (!prefix) return path;
  const normalizedPrefix = prefix.startsWith("/") ? prefix : `/${prefix}`;
  return path === "/" ? normalizedPrefix : `${normalizedPrefix}${path}`;
}

/**
 * Helper to apply name prefix
 */
function applyNamePrefix(prefix: string | undefined, name: string | undefined): string | undefined {
  if (!prefix || !name) return name;
  return `${prefix}${name}`;
}

/**
 * Group routes with shared options - flattens immediately
 */
export function group<
  const Children extends readonly Routes<any>[],
  const PathPrefix extends string = "",
  const NamePrefix extends string = "",
>(
  options: RouteGroupOptions<NamePrefix> & { prefix?: PathPrefix },
  children: Children | (() => Children),
): Routes<
  PrependNamePrefix<
    ExtractRouteParams<PathPrefix> extends never
      ? MergeChildren<Children>
      : AddPrefixParams<MergeChildren<Children>, ExtractRouteParams<PathPrefix>>,
    NamePrefix
  >
> {
  const childrenArray = typeof children === "function" ? children() : children;

  // Convert group options constraints to ParameterConstraint[]
  const groupConstraints: ParameterConstraint[] = [];
  if (options.where) {
    for (const [param, pattern] of Object.entries(options.where)) {
      groupConstraints.push({ param, pattern });
    }
  }

  const groupMiddleware = options.middleware ? arrayWrap(options.middleware) : [];

  // Flatten immediately - process all child routes
  const flatRoutes: RouteDefinition[] = [];

  for (const childRoutes of childrenArray) {
    for (const route of childRoutes.routes) {
      flatRoutes.push({
        ...route,
        path: applyPathPrefix(options.prefix, route.path),
        routeName: applyNamePrefix(options.namePrefix, route.routeName),
        middleware: [...groupMiddleware, ...route.middleware],
        constraints: [...groupConstraints, ...route.constraints],
        domainPattern: options.domain ?? route.domainPattern,
      });
    }
  }

  return createRoutes(flatRoutes) as any;
}

// --- Global Configuration ---

export function pattern(param: string, patternValue: RouteConstraint): void {
  globalConstraints.set(param, patternValue);
}

// --- Named Exports ---

/**
 * Export delete_ as delete for cleaner API
 * (delete is a reserved keyword so internal implementation uses delete_)
 */
export { delete_ as delete };
