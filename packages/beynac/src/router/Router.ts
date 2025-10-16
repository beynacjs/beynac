import type { Container } from "../container";
import type { Controller } from "../core/Controller";
import type { MiddlewareReference } from "../core/Middleware";
import type { NoArgConstructor } from "../utils";
import type { RouteDefinition, RouteMatcher } from "./internal-types";
import type { Routes } from "./public-types";
import { Rou3RouteMatcher } from "./Rou3RouteMatcher";

// ============================================================================
// Router Implementation
// ============================================================================

/**
 * Router - Main routing implementation
 */
export class Router {
  private matcher: RouteMatcher;

  constructor(
    private container: Container,
    matcher?: RouteMatcher,
  ) {
    this.matcher = matcher || new Rou3RouteMatcher();
  }

  /**
   * Register routes with the router
   */
  register(routes: Routes): void {
    for (const route of routes.routes) {
      this.matcher.register(route);
    }
  }

  /**
   * Handle an HTTP request
   */
  async handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const hostname = url.hostname;

    // Try to match route
    const match = this.matcher.match(request.method, url.pathname, hostname);

    if (!match) {
      return new Response("Not Found", { status: 404 });
    }

    return this.#executeRoute(match.route, request, match.params);
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
}
