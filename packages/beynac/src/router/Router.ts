import type { Container } from "../contracts";
import { ControllerContext, MiddlewareNext } from "../core/Controller";
import { Rou3RouteMatcher } from "./Rou3RouteMatcher";
import type {
  BuiltInRouteConstraint,
  RouteConstraint,
  RouteDefinition,
  RouteMatcher,
  Routes,
} from "./router-types";

export class Router {
  private matcher: RouteMatcher = new Rou3RouteMatcher();

  constructor(private container: Container) {}

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

    const match = this.matcher.match(request.method, url.pathname, hostname);

    if (!match || !this.#checkConstraints(match.route, match.params)) {
      return new Response("Not Found", { status: 404 });
    }

    return this.#executeRoute(match.route, request, url, match.params);
  }

  #checkConstraints(route: RouteDefinition, params: Record<string, string>): boolean {
    // Check route-specific constraints (from 'where')
    // These MUST match - 404 if parameter doesn't exist or validation fails
    for (const { param, constraint } of route.constraints) {
      const value = params[param];
      if (value == null) return false;
      if (!matchConstraint(constraint, value)) return false;
    }

    // Check global pattern constraints (from 'globalPatterns')
    // These only validate if the parameter exists
    for (const { param, constraint } of route.globalConstraints) {
      const value = params[param];
      if (value != null && !matchConstraint(constraint, value)) return false;
    }

    return true;
  }

  async #executeRoute(
    route: RouteDefinition,
    request: Request,
    url: URL,
    params: Record<string, string>,
  ): Promise<Response> {
    const ctx: ControllerContext = { request, params, url };

    const finalHandler = async (ctx: ControllerContext): Promise<Response> => {
      const handler =
        typeof route.handler === "function" ? this.container.get(route.handler) : route.handler;
      return handler.handle(ctx);
    };

    const middlewareInstances = route.middleware.map((ref) => {
      if (typeof ref === "function") {
        return this.container.get(ref);
      }
      return ref;
    });

    let next: MiddlewareNext = finalHandler;

    for (let i = middlewareInstances.length - 1; i >= 0; i--) {
      const middleware = middlewareInstances[i];
      const currentNext = next;
      next = (ctx) => middleware.handle(ctx, currentNext);
    }

    return next(ctx);
  }
}

const BUILT_IN_CONSTRAINTS: Record<BuiltInRouteConstraint, RegExp> = {
  numeric: /^\d+$/,
  alphanumeric: /^[a-zA-Z0-9]+$/,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  ulid: /^[0-9A-Z]{26}$/i,
};

/**
 * Check if a value matches a constraint
 */
function matchConstraint(constraint: RouteConstraint, value: string): boolean {
  let pattern: RegExp | ((value: string) => boolean);

  if (typeof constraint === "string") {
    pattern = BUILT_IN_CONSTRAINTS[constraint];
    if (!pattern) {
      throw new Error(
        `"${constraint}" is not a valid constraint, use ${Object.keys(BUILT_IN_CONSTRAINTS).join(", ")} or define your own regex or function`,
      );
    }
  } else {
    pattern = constraint;
  }

  if (typeof pattern === "function") {
    return pattern(value);
  }
  return pattern.test(value);
}
