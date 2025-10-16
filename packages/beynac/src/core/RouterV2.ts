import { addRoute, createRouter, findRoute, RouterContext } from "rou3";
import type { Container } from "../container";
import { RouteParams } from "../contracts/Router";
import type { NoArgConstructor } from "../utils";
import { arrayWrap } from "../utils";
import type { Controller } from "./Controller";
import type { MiddlewareReference } from "./Middleware";

// ============================================================================
// Type Definitions
// ============================================================================
type Foo = Record<never, string>;
/**
 * A route handler can be a Controller instance or class constructor
 */
export type RouteHandler = Controller | NoArgConstructor<Controller>;

/**
 * Parameter constraint definition
 */
interface ParameterConstraint {
  param: string;
  pattern: RegExp;
}

/**
 * Configuration for creating a route
 */
interface RouteConfig {
  methods: readonly string[];
  path: string;
  handler: RouteHandler | ((request: Request) => Response | Promise<Response>);
  routeName?: string;
  middlewareStack?: MiddlewareReference[];
  constraints?: ParameterConstraint[];
  domainPattern?: string;
  redirect?: { to: string; status: number };
  isFallback?: boolean;
  viewResponse?: Response;
}

/**
 * A route with type-tracked name and path
 */
export class Route<Name extends string = never, Path extends string = string> {
  readonly __name!: Name;
  readonly __path!: Path;

  methods: readonly string[];
  path: string;
  handler: RouteHandler | ((request: Request) => Response | Promise<Response>);
  routeName?: string;
  middlewareStack: MiddlewareReference[];
  constraints: ParameterConstraint[];
  domainPattern?: string;
  redirect?: { to: string; status: number };
  isFallback: boolean;
  viewResponse?: Response;

  constructor(config: RouteConfig) {
    this.methods = config.methods;
    this.path = config.path;
    this.handler = config.handler;
    if (config.routeName !== undefined) this.routeName = config.routeName;
    this.middlewareStack = config.middlewareStack ?? [];
    this.constraints = config.constraints ?? [];
    if (config.domainPattern !== undefined) this.domainPattern = config.domainPattern;
    if (config.redirect !== undefined) this.redirect = config.redirect;
    this.isFallback = config.isFallback ?? false;
    if (config.viewResponse !== undefined) this.viewResponse = config.viewResponse;
  }

  #copy<N extends string = Name, P extends string = Path>(
    overrides: Partial<RouteConfig> = {},
  ): Route<N, P> {
    const newConfig: RouteConfig = {
      methods: overrides.methods ?? this.methods,
      path: overrides.path ?? this.path,
      handler: overrides.handler ?? this.handler,
      middlewareStack: overrides.middlewareStack ?? this.middlewareStack,
      constraints: overrides.constraints ?? this.constraints,
    };
    const routeName = overrides.routeName ?? this.routeName;
    if (routeName !== undefined) {
      newConfig.routeName = routeName;
    }
    const domainPattern = overrides.domainPattern ?? this.domainPattern;
    if (domainPattern !== undefined) {
      newConfig.domainPattern = domainPattern;
    }
    const redirect = overrides.redirect ?? this.redirect;
    if (redirect !== undefined) {
      newConfig.redirect = redirect;
    }
    const isFallback = overrides.isFallback ?? this.isFallback;
    if (isFallback !== undefined) {
      newConfig.isFallback = isFallback;
    }
    const viewResponse = overrides.viewResponse ?? this.viewResponse;
    if (viewResponse !== undefined) {
      newConfig.viewResponse = viewResponse;
    }
    // Type assertion needed: Route constructor returns Route<never, string> but we need Route<N, P>
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- Route constructor defaults to Route<never>, assertion needed for generic type parameters
    return new Route(newConfig) as Route<N, P>;
  }

  /** Assign a name to this route */
  name<const N extends string>(name: N): Route<N, Path> {
    return this.#copy<N, Path>({ routeName: name });
  }

  /** Add middleware to this route */
  middleware(middleware: MiddlewareReference | MiddlewareReference[]): Route<Name, Path> {
    return this.#copy({
      middlewareStack: [...this.middlewareStack, ...arrayWrap(middleware)],
    });
  }

  /** Apply regex constraint to a parameter */
  where(param: string, pattern: string | RegExp): Route<Name, Path> {
    const regex = typeof pattern === "string" ? new RegExp(pattern) : pattern;
    return this.#copy({
      constraints: [...this.constraints, { param, pattern: regex }],
    });
  }

  /** Constraint: parameter must be numeric */
  whereNumber(param: string): Route<Name, Path> {
    return this.where(param, /^\d+$/);
  }

  /** Constraint: parameter must be alphabetic */
  whereAlpha(param: string): Route<Name, Path> {
    return this.where(param, /^[a-zA-Z]+$/);
  }

  /** Constraint: parameter must be alphanumeric */
  whereAlphaNumeric(param: string): Route<Name, Path> {
    return this.where(param, /^[a-zA-Z0-9]+$/);
  }

  /** Constraint: parameter must be UUID v4 */
  whereUuid(param: string): Route<Name, Path> {
    return this.where(
      param,
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  }

  /** Constraint: parameter must be ULID */
  whereUlid(param: string): Route<Name, Path> {
    return this.where(param, /^[0-9A-HJKMNP-TV-Z]{26}$/i);
  }

  /** Constraint: parameter must be one of the given values */
  whereIn(param: string, values: readonly string[]): Route<Name, Path> {
    const pattern = new RegExp(`^(${values.join("|")})$`);
    return this.where(param, pattern);
  }

  /** Restrict route to specific domain/subdomain pattern */
  domain(pattern: string): Route<Name, Path> {
    return this.#copy({ domainPattern: pattern });
  }

  /** Apply group options to this route */
  applyGroupOptions(options: RouteGroupOptions<string>): Route<string, string> {
    let result: Route<string, string> = this as unknown as Route<string, string>;

    // Apply prefix
    if (options.prefix) {
      const prefix = options.prefix.startsWith("/") ? options.prefix : `/${options.prefix}`;
      const path = this.path === "/" ? prefix : `${prefix}${this.path}`;
      result = result.#copy({ path });
    }

    // Apply name prefix
    if (options.namePrefix && result.routeName) {
      result = result.#copy({ routeName: `${options.namePrefix}${result.routeName}` });
    }

    // Apply middleware
    if (options.middleware) {
      result = result.middleware(options.middleware);
    }

    // Apply domain
    if (options.domain) {
      result = result.domain(options.domain);
    }

    return result;
  }
}

/**
 * Options for route groups
 */
export interface RouteGroupOptions<NamePrefix extends string = ""> {
  /** URI prefix for all routes in group */
  prefix?: string;

  /** Name prefix for all routes in group (e.g., "admin.") */
  namePrefix?: NamePrefix;

  /** Middleware applied to all routes in group */
  middleware?: MiddlewareReference | MiddlewareReference[];

  /** Domain pattern for all routes in group */
  domain?: string;
}

/**
 * Options for individual routes (alternative to fluent API)
 */
export interface RouteOptions<Name extends string = never> {
  name?: Name;
  middleware?: MiddlewareReference | MiddlewareReference[];
  domain?: string;
}

// ============================================================================
// Type Helper Utilities
// ============================================================================

/**
 * Convert union to intersection type
 * Used for merging multiple route maps into one
 */
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void
  ? I
  : never;

/**
 * Extract name→params map from a single route
 */
type RouteToMap<R> =
  R extends Route<infer N, infer P> ? (N extends never ? {} : { [K in N]: RouteParams<P> }) : {};

/**
 * Merge all route maps from an array of routes/groups
 */
type MergeRouteInfo<Routes extends readonly any[]> = UnionToIntersection<
  Routes[number] extends Route<any, any>
    ? RouteToMap<Routes[number]>
    : Routes[number] extends RouteGroup<infer M>
      ? M
      : {}
>;

/**
 * Prepend a prefix to all keys in a map
 */
type PrependPrefixToMap<Map extends Record<string, any>, Prefix extends string> = Prefix extends ""
  ? Map
  : {
      [K in keyof Map as K extends string ? `${Prefix}${K}` : never]: Map[K];
    };

/**
 * Widen parameter values from string to string | number for url() method convenience
 */
type WidenParams<ParamsMap extends Record<string, any>> = {
  [K in keyof ParamsMap]: {
    [P in keyof ParamsMap[K]]: string | number;
  };
};

/**
 * Collection of routes with aggregated name→params map
 */
export class RouteGroup<
  NameParamsMap extends Record<string, Record<string, string | number>> = Record<never, never>,
> {
  readonly __nameParamsMap!: NameParamsMap;

  constructor(
    private routes: readonly (Route<string, string> | RouteGroup<any>)[],
    private options: RouteGroupOptions<string> = {},
  ) {}

  /** Internal method to get all routes */
  _getRoutes(): Route<string, string>[] {
    const allRoutes: Route<string, string>[] = [];

    for (const route of this.routes) {
      if (route instanceof Route) {
        allRoutes.push(route.applyGroupOptions(this.options));
      } else if (route instanceof RouteGroup) {
        // Recursively get routes from nested groups and apply current group options
        const nestedRoutes = route._getRoutes();
        for (const nestedRoute of nestedRoutes) {
          allRoutes.push(nestedRoute.applyGroupOptions(this.options));
        }
      }
    }

    return allRoutes;
  }

  /** Generate a URL from a named route in this group */
  url<N extends keyof NameParamsMap & string>(
    name: N,
    ...args: {} extends NameParamsMap[N]
      ? [params?: WidenParams<NameParamsMap>[N]]
      : [params: WidenParams<NameParamsMap>[N]]
  ): string {
    const routes = this._getRoutes();
    const route = routes.find((r) => r.routeName === name);
    if (!route) {
      throw new Error(`Route "${name}" not found`);
    }

    const params = args[0] || {};
    let path = route.path;
    for (const [key, value] of Object.entries(params)) {
      path = path.replace(`:${key}`, String(value));
    }
    return path;
  }
}

// ============================================================================
// Router Implementation
// ============================================================================

/**
 * Global parameter constraints
 */
const globalConstraints = new Map<string, RegExp>();

/**
 * RouterV2 - New routing implementation
 */
export class RouterV2 {
  private router: RouterContext<{ route: Route<string, string> }>;
  private fallbackRoute: Route<string, string> | undefined;
  private namedRoutes = new Map<string, Route<string, string>>();

  constructor(private container: Container) {
    this.router = createRouter<{ route: Route<string, string> }>();
  }

  /**
   * Register routes with the router
   */
  register(routes: (Route<string, string> | RouteGroup<any>)[]): void {
    for (const item of routes) {
      if (item instanceof Route) {
        this.#registerRoute(item);
      } else if (item instanceof RouteGroup) {
        for (const route of item._getRoutes()) {
          this.#registerRoute(route);
        }
      }
    }
  }

  #registerRoute(route: Route<string, string>): void {
    // Handle fallback routes separately
    if (route.isFallback) {
      this.fallbackRoute = route;
      return;
    }

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
      // Use fallback if available
      if (this.fallbackRoute) {
        return this.#executeRoute(this.fallbackRoute, request, {});
      }
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

  #checkConstraints(route: Route<string, string>, params: Record<string, string>): boolean {
    // Check route-specific constraints
    for (const constraint of route.constraints) {
      const value = params[constraint.param];
      if (value && !constraint.pattern.test(value)) {
        return false;
      }
    }

    // Check global constraints
    for (const [param, pattern] of globalConstraints) {
      const value = params[param];
      if (value && !pattern.test(value)) {
        return false;
      }
    }

    return true;
  }

  async #executeRoute(
    route: Route<string, string>,
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

    // Handle view routes
    if (route.viewResponse) {
      return route.viewResponse;
    }

    // Execute middleware pipeline
    const finalHandler = async (req: Request): Promise<Response> => {
      let handler: RouteHandler | ((request: Request) => Response | Promise<Response>) =
        route.handler;

      // Instantiate controller if it's a class
      if (typeof handler === "function" && "prototype" in handler) {
        handler = this.container.get(handler as NoArgConstructor<Controller>);
      }

      // For function handlers (used internally for redirect/view), call them directly
      if (typeof handler === "function") {
        return (handler as (request: Request) => Response | Promise<Response>)(req);
      }

      // Call controller's handle method
      return (handler as Controller).handle(req, params);
    };

    return this.#executeMiddlewarePipeline(route.middlewareStack, request, finalHandler);
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
): Route<Name, Path> {
  const methods = typeof method === "string" ? [method] : method;
  let route: Route<any, Path> = new Route({
    methods,
    path,
    handler,
  });
  if (options?.name) {
    route = route.name(options.name);
  }
  if (options?.middleware) {
    route = route.middleware(options.middleware);
  }
  if (options?.domain) {
    route = route.domain(options.domain);
  }
  return route as Route<Name, Path>;
}

/**
 * Type for HTTP method route functions
 */
type RouteMethodFunction = <const Path extends string, const Name extends string = never>(
  path: Path,
  handler: RouteHandler,
  options?: RouteOptions<Name>,
) => Route<Name, Path>;

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
): Route<Name, Path> {
  return createRoute(methods, path, handler, options);
}

export function any<const Path extends string, const Name extends string = never>(
  path: Path,
  handler: RouteHandler,
  options?: RouteOptions<Name>,
): Route<Name, Path> {
  const methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"];
  return match(methods, path, handler, options);
}

// --- Special Routes ---

/**
 * Placeholder handler for special routes (redirect/view)
 * This is never actually called as these routes are handled specially
 */
const placeholderHandler: (request: Request) => Response = () => new Response();

export function redirect<const Path extends string>(
  from: Path,
  to: string,
  status = 302,
): Route<never, Path> {
  return new Route({
    methods: ["GET"],
    path: from,
    handler: placeholderHandler,
    redirect: { to, status },
  });
}

export function permanentRedirect<const Path extends string>(
  from: Path,
  to: string,
): Route<never, Path> {
  return redirect(from, to, 301);
}

export function fallback(handler: RouteHandler): Route<never, "/*"> {
  return new Route({
    methods: ["GET"],
    path: "/*",
    handler,
    isFallback: true,
  });
}

export function view<const Path extends string>(
  path: Path,
  content: string | Response,
): Route<never, Path> {
  const response =
    typeof content === "string"
      ? new Response(content, { headers: { "Content-Type": "text/html" } })
      : content;

  return new Route({
    methods: ["GET"],
    path,
    handler: placeholderHandler,
    viewResponse: response,
  });
}

// --- Route Grouping ---

export function group<
  const Routes extends readonly (Route<any, any> | RouteGroup<any>)[],
  const NamePrefix extends string = "",
>(
  options: RouteGroupOptions<NamePrefix>,
  routesOrCallback: Routes | (() => Routes),
): RouteGroup<PrependPrefixToMap<MergeRouteInfo<Routes>, NamePrefix>> {
  const routes = typeof routesOrCallback === "function" ? routesOrCallback() : routesOrCallback;
  return new RouteGroup(routes, options);
}

// --- Global Configuration ---

export function pattern(param: string, patternValue: string | RegExp): void {
  const regex = typeof patternValue === "string" ? new RegExp(patternValue) : patternValue;
  globalConstraints.set(param, regex);
}

// --- Named Exports ---

/**
 * Export delete_ as delete for cleaner API
 * (delete is a reserved keyword so internal implementation uses delete_)
 */
export { delete_ as delete };
