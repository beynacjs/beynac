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
 * Parameter constraint definition
 */
interface ParameterConstraint {
  param: string;
  pattern: RegExp;
}

/**
 * A route definition with type-tracked name
 */
export interface Route<Name extends string = never> {
  readonly __name: Name;

  /** Assign a name to this route */
  name<const N extends string>(name: N): Route<N>;

  /** Add middleware to this route */
  middleware(middleware: MiddlewareReference | MiddlewareReference[]): Route<Name>;

  /** Apply regex constraint to a parameter */
  where(param: string, pattern: string | RegExp): Route<Name>;

  /** Constraint: parameter must be numeric */
  whereNumber(param: string): Route<Name>;

  /** Constraint: parameter must be alphabetic */
  whereAlpha(param: string): Route<Name>;

  /** Constraint: parameter must be alphanumeric */
  whereAlphaNumeric(param: string): Route<Name>;

  /** Constraint: parameter must be UUID v4 */
  whereUuid(param: string): Route<Name>;

  /** Constraint: parameter must be ULID */
  whereUlid(param: string): Route<Name>;

  /** Constraint: parameter must be one of the given values */
  whereIn(param: string, values: readonly string[]): Route<Name>;

  /** Restrict route to specific domain/subdomain pattern */
  domain(pattern: string): Route<Name>;
}

/**
 * A collection of routes with aggregated name types
 */
export interface RouteGroup<Names extends string = never> {
  readonly __names: Names;
}

/**
 * Options for route groups
 */
export interface RouteGroupOptions {
  /** URI prefix for all routes in group */
  prefix?: string;

  /** Name prefix for all routes in group (e.g., "admin.") */
  namePrefix?: string;

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
// Internal Route Definition
// ============================================================================

/**
 * Internal representation of a route with all its configuration
 */
class RouteDefinition {
  constructor(
    public methods: readonly string[],
    public path: string,
    public handler: RouteHandler | ((request: Request) => Response | Promise<Response>),
    public routeName: string | undefined = undefined,
    public middlewareStack: MiddlewareReference[] = [],
    public constraints: ParameterConstraint[] = [],
    public domainPattern: string | undefined = undefined,
    public isRedirect = false,
    public redirectTo: string | undefined = undefined,
    public redirectStatus: number | undefined = undefined,
    public isFallback = false,
    public viewResponse: Response | undefined = undefined,
  ) {}

  /**
   * Create a copy of this route definition with modified properties
   */
  #copy(overrides: Partial<RouteDefinition>): RouteDefinition {
    return new RouteDefinition(
      overrides.methods ?? this.methods,
      overrides.path ?? this.path,
      overrides.handler ?? this.handler,
      overrides.routeName ?? this.routeName,
      overrides.middlewareStack ?? this.middlewareStack,
      overrides.constraints ?? this.constraints,
      overrides.domainPattern ?? this.domainPattern,
      overrides.isRedirect ?? this.isRedirect,
      overrides.redirectTo ?? this.redirectTo,
      overrides.redirectStatus ?? this.redirectStatus,
      overrides.isFallback ?? this.isFallback,
      overrides.viewResponse ?? this.viewResponse,
    );
  }

  withName(name: string): RouteDefinition {
    return this.#copy({ routeName: name });
  }

  withMiddleware(middleware: MiddlewareReference | MiddlewareReference[]): RouteDefinition {
    return this.#copy({
      middlewareStack: [...this.middlewareStack, ...arrayWrap(middleware)],
    });
  }

  withConstraint(param: string, pattern: RegExp): RouteDefinition {
    return this.#copy({
      constraints: [...this.constraints, { param, pattern }],
    });
  }

  withDomain(pattern: string): RouteDefinition {
    return this.#copy({ domainPattern: pattern });
  }

  /**
   * Apply group options to this route definition
   */
  applyGroupOptions(options: RouteGroupOptions): RouteDefinition {
    let result = this as RouteDefinition;

    // Apply prefix
    if (options.prefix) {
      const prefix = options.prefix.startsWith("/") ? options.prefix : `/${options.prefix}`;
      const path = this.path === "/" ? prefix : `${prefix}${this.path}`;
      result = result.#copy({ path });
    }

    // Apply name prefix
    if (options.namePrefix && result.routeName) {
      result = result.withName(`${options.namePrefix}${result.routeName}`);
    }

    // Apply middleware
    if (options.middleware) {
      result = result.withMiddleware(options.middleware);
    }

    // Apply domain
    if (options.domain) {
      result = result.withDomain(options.domain);
    }

    return result;
  }
}

// ============================================================================
// Public Route Implementation
// ============================================================================

/**
 * Public-facing immutable Route object
 */
class RouteImpl<Name extends string = never> implements Route<Name> {
  readonly __name!: Name;

  constructor(private definition: RouteDefinition) {}

  name<const N extends string>(name: N): Route<N> {
    return new RouteImpl(this.definition.withName(name)) as Route<N>;
  }

  middleware(middleware: MiddlewareReference | MiddlewareReference[]): Route<Name> {
    return new RouteImpl(this.definition.withMiddleware(middleware));
  }

  where(param: string, pattern: string | RegExp): Route<Name> {
    const regex = typeof pattern === "string" ? new RegExp(pattern) : pattern;
    return new RouteImpl(this.definition.withConstraint(param, regex));
  }

  whereNumber(param: string): Route<Name> {
    return this.where(param, /^\d+$/);
  }

  whereAlpha(param: string): Route<Name> {
    return this.where(param, /^[a-zA-Z]+$/);
  }

  whereAlphaNumeric(param: string): Route<Name> {
    return this.where(param, /^[a-zA-Z0-9]+$/);
  }

  whereUuid(param: string): Route<Name> {
    return this.where(
      param,
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  }

  whereUlid(param: string): Route<Name> {
    return this.where(param, /^[0-9A-HJKMNP-TV-Z]{26}$/i);
  }

  whereIn(param: string, values: readonly string[]): Route<Name> {
    const pattern = new RegExp(`^(${values.join("|")})$`);
    return this.where(param, pattern);
  }

  domain(pattern: string): Route<Name> {
    return new RouteImpl(this.definition.withDomain(pattern));
  }

  /** Internal method to get the route definition */
  _getDefinition(): RouteDefinition {
    return this.definition;
  }
}

// ============================================================================
// Route Group Implementation
// ============================================================================

/**
 * Collection of routes with aggregated names
 */
class RouteGroupImpl<Names extends string = never> implements RouteGroup<Names> {
  readonly __names!: Names;

  constructor(
    private routes: (RouteImpl<string> | RouteGroupImpl<string>)[],
    private options: RouteGroupOptions = {},
  ) {}

  /** Internal method to get all route definitions */
  _getDefinitions(): RouteDefinition[] {
    const definitions: RouteDefinition[] = [];

    for (const route of this.routes) {
      if (route instanceof RouteImpl) {
        const def = route._getDefinition();
        definitions.push(def.applyGroupOptions(this.options));
      } else if (route instanceof RouteGroupImpl) {
        // Recursively get definitions from nested groups and apply current group options
        const nestedDefs = route._getDefinitions();
        for (const nestedDef of nestedDefs) {
          definitions.push(nestedDef.applyGroupOptions(this.options));
        }
      }
    }

    return definitions;
  }
}

// ============================================================================
// Router Implementation
// ============================================================================

/**
 * Data stored with each route in rou3
 */
interface RouteData {
  definition: RouteDefinition;
}

/**
 * Global parameter constraints
 */
const globalConstraints = new Map<string, RegExp>();

/**
 * RouterV2 - New routing implementation
 */
export class RouterV2 {
  private router: RouterContext<RouteData>;
  private fallbackRoute: RouteDefinition | undefined;

  constructor(private container: Container) {
    this.router = createRouter<RouteData>();
  }

  /**
   * Register routes with the router
   */
  register(routes: (Route<string> | RouteGroup<string>)[]): void {
    for (const route of routes) {
      if (route instanceof RouteImpl) {
        this.#registerDefinition(route._getDefinition());
      } else if (route instanceof RouteGroupImpl) {
        for (const def of route._getDefinitions()) {
          this.#registerDefinition(def);
        }
      }
    }
  }

  #registerDefinition(def: RouteDefinition): void {
    // Handle fallback routes separately
    if (def.isFallback) {
      this.fallbackRoute = def;
      return;
    }

    // Register route for each HTTP method
    for (const method of def.methods) {
      addRoute(this.router, method, def.path, { definition: def });
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

    return this.#executeRoute(match.definition, request, match.params);
  }

  #match(method: string, path: string, hostname: string) {
    const result = findRoute(this.router, method, path);
    if (!result) {
      return undefined;
    }

    const data = result.data;
    const def = data.definition;

    // Check domain constraint
    if (def.domainPattern && !this.#matchDomain(hostname, def.domainPattern)) {
      return undefined;
    }

    const params = result.params || {};

    // Check parameter constraints
    if (!this.#checkConstraints(def, params)) {
      return undefined;
    }

    return {
      definition: def,
      params,
    };
  }

  #matchDomain(hostname: string, pattern: string): boolean {
    // Convert pattern to regex, replacing {param} with capture groups
    const regexPattern = pattern.replace(/\{([^}]+)\}/g, "([^.]+)");
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(hostname);
  }

  #checkConstraints(def: RouteDefinition, params: Record<string, string>): boolean {
    // Check route-specific constraints
    for (const constraint of def.constraints) {
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
    def: RouteDefinition,
    request: Request,
    params: Record<string, string>,
  ): Promise<Response> {
    // Handle redirects
    if (def.isRedirect && def.redirectTo) {
      return new Response(null, {
        status: def.redirectStatus || 302,
        headers: { Location: def.redirectTo },
      });
    }

    // Handle view routes
    if (def.viewResponse) {
      return def.viewResponse;
    }

    // Execute middleware pipeline
    const finalHandler = async (req: Request): Promise<Response> => {
      let handler: RouteHandler | ((request: Request) => Response | Promise<Response>) =
        def.handler;

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

    return this.#executeMiddlewarePipeline(def.middlewareStack, request, finalHandler);
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
}

// ============================================================================
// Global Helper Functions
// ============================================================================

/**
 * Helper type to extract all route names from an array
 */
type ExtractNames<Routes extends readonly (Route<string> | RouteGroup<string>)[]> =
  Routes[number] extends Route<infer Name> | RouteGroup<infer Name> ? Name : never;

// --- HTTP Method Routes ---

/**
 * Helper to create a route with common logic
 */
function createRoute<const Name extends string = never>(
  method: string | readonly string[],
  path: string,
  handler: RouteHandler,
  options?: RouteOptions<Name>,
): Route<Name> {
  const methods = typeof method === "string" ? [method] : method;
  const def = new RouteDefinition(methods, path, handler);
  let route: Route<Name> = new RouteImpl<Name>(def);
  if (options?.name) {
    route = route.name(options.name);
  }
  if (options?.middleware) {
    route = route.middleware(options.middleware);
  }
  if (options?.domain) {
    route = route.domain(options.domain);
  }
  return route;
}

/**
 * Type for HTTP method route functions
 */
type RouteMethodFunction = <const Name extends string = never>(
  path: string,
  handler: RouteHandler,
  options?: RouteOptions<Name>,
) => Route<Name>;

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

export function match<const Name extends string = never>(
  methods: readonly string[],
  path: string,
  handler: RouteHandler,
  options?: RouteOptions<Name>,
): Route<Name> {
  return createRoute(methods, path, handler, options);
}

export function any<const Name extends string = never>(
  path: string,
  handler: RouteHandler,
  options?: RouteOptions<Name>,
): Route<Name> {
  const methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"];
  return match(methods, path, handler, options);
}

// --- Special Routes ---

/**
 * Placeholder handler for special routes (redirect/view)
 * This is never actually called as these routes are handled specially
 */
const placeholderHandler: (request: Request) => Response = () => new Response();

export function redirect(from: string, to: string, status = 302): Route<never> {
  const def = new RouteDefinition(
    ["GET"],
    from,
    placeholderHandler,
    undefined,
    [],
    [],
    undefined,
    true,
    to,
    status,
  );
  return new RouteImpl(def);
}

export function permanentRedirect(from: string, to: string): Route<never> {
  return redirect(from, to, 301);
}

export function fallback(handler: RouteHandler): Route<never> {
  const def = new RouteDefinition(
    ["GET"],
    "/*",
    handler,
    undefined,
    [],
    [],
    undefined,
    false,
    undefined,
    undefined,
    true,
  );
  return new RouteImpl(def);
}

export function view(path: string, content: string | Response): Route<never> {
  const response =
    typeof content === "string"
      ? new Response(content, { headers: { "Content-Type": "text/html" } })
      : content;

  const def = new RouteDefinition(
    ["GET"],
    path,
    placeholderHandler,
    undefined,
    [],
    [],
    undefined,
    false,
    undefined,
    undefined,
    false,
    response,
  );
  return new RouteImpl(def);
}

// --- Route Grouping ---

export function group<const Routes extends readonly (Route<string> | RouteGroup<string>)[]>(
  options: RouteGroupOptions,
  routesOrCallback: Routes | (() => Routes),
): RouteGroup<ExtractNames<Routes>> {
  const routes = typeof routesOrCallback === "function" ? routesOrCallback() : routesOrCallback;
  return new RouteGroupImpl(routes as (RouteImpl<string> | RouteGroupImpl<string>)[], options);
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
