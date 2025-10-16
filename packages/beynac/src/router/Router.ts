import { addRoute, createRouter, findRoute, RouterContext } from "rou3";
import type { Container } from "../container";
import type { Controller } from "../core/Controller";
import type { MiddlewareReference } from "../core/Middleware";
import type { NoArgConstructor } from "../utils";
import { globalConstraints } from "./helpers";
import type { RouteDefinition, Routes, UrlFunction } from "./public-types";

// ============================================================================
// Domain Translation Helpers
// ============================================================================

/**
 * Convert a domain pattern to path format for rou3 matching
 * Input: ":subdomain.example.com" (already in rou3 format)
 * Output: "{/:subdomain/example/com/}"
 */
function translateDomainToPath(domain: string): string {
  // Convert dots to slashes and wrap with curly braces
  return "{/" + domain.replace(/\./g, "/") + "/}";
}

/**
 * Convert a hostname to path format for matching
 * Input: "acme.example.com"
 * Output: "{/acme/example/com/}"
 */
function hostnameToPath(hostname: string): string {
  // Convert dots to slashes and wrap with curly braces
  return "{/" + hostname.replace(/\./g, "/") + "/}";
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

      // If route has domain, generate protocol-relative URL
      if (route.domainPattern) {
        let domain = route.domainPattern;
        let path = route.path;

        // Replace parameters in both domain and path
        // Note: paths are stored internally in rou3 format (:param, **:param)
        for (const [key, value] of Object.entries(params)) {
          const stringValue = String(value);
          // Replace in domain
          domain = domain.replace(`**:${key}`, stringValue);
          domain = domain.replace(`:${key}`, stringValue);
          // Replace in path
          path = path.replace(`**:${key}`, stringValue);
          path = path.replace(`:${key}`, stringValue);
        }

        return `//${domain}${path}`;
      }

      // No domain - return path only
      // Note: paths are stored internally in rou3 format (:param, **:param)
      let path = route.path;
      for (const [key, value] of Object.entries(params)) {
        // Replace wildcard parameters (**:key) and regular parameters (:key)
        path = path.replace(`**:${key}`, String(value));
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
 * Router - Main routing implementation
 */
export class Router {
  private router: RouterContext<{ route: RouteDefinition }>;
  private namedRoutes = new Map<string, RouteDefinition>();

  constructor(private container: Container) {
    this.router = createRouter<{ route: RouteDefinition }>();
  }

  /**
   * Register routes with the router
   */
  register(routes: Routes): void {
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
      if (route.domainPattern) {
        // For domain routes, encode domain as path segments so rou3 can match naturally
        // Example: ":subdomain.example.com" + "/users/:id" -> "/:subdomain/example/com//users/:id"
        const domainPath = translateDomainToPath(route.domainPattern);
        const fullPath = domainPath + route.path;
        addRoute(this.router, method, fullPath, { route });
      } else {
        // Register path only: "/path" (has leading slash)
        addRoute(this.router, method, route.path, { route });
      }
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
    // Try domain-specific route first by encoding hostname as path
    // Example: "acme.example.com" + "/users" -> "/acme/example/com//users"
    const hostnamePath = hostnameToPath(hostname);
    const fullPath = hostnamePath + path;
    let result = findRoute(this.router, method, fullPath);

    if (!result) {
      // Fallback to domain-agnostic route: just the path "/users"
      result = findRoute(this.router, method, path);
    }

    if (!result) {
      return undefined;
    }

    const data = result.data;
    const route = data.route;
    const params = result.params || {};

    // Check parameter constraints (rou3 extracts all params automatically now!)
    if (!this.#checkConstraints(route, params)) {
      return undefined;
    }

    return {
      route,
      params,
    };
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
    // Execute middleware pipeline
    const finalHandler = async (req: Request): Promise<Response> => {
      let handler = route.handler;

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
      // Replace wildcard parameters (**:key) and regular parameters (:key)
      path = path.replace(`**:${key}`, String(value));
      path = path.replace(`:${key}`, String(value));
    }

    return path;
  }
}
