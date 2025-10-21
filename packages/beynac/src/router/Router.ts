import type { Configuration, Container } from "../contracts";
import { ControllerContext } from "../core/Controller";
import type { MiddlewareReference } from "../core/Middleware";
import { throwOnMissingPropertyAccess } from "./params-access-checker";
import { Rou3RouteMatcher } from "./Rou3RouteMatcher";
import type {
  BuiltInRouteConstraint,
  ParamConstraint,
  RouteDefinition,
  RouteMatcher,
  Routes,
} from "./router-types";

export interface RouterOptions {
  /**
   * Global middleware priority list. Middleware in this list will execute first,
   * in the order specified. All other middleware will execute after, in their
   * original relative order.
   */
  middlewarePriority?: MiddlewareReference[] | undefined;
}

type ConfigRequiredByRouter = Pick<Configuration, "throwOnInvalidParamAccess" | "development">;

export class Router {
  #matcher: RouteMatcher = new Rou3RouteMatcher();
  #middlewarePriority: MiddlewareReference[] | undefined;
  #sortedMiddlewareSets = new WeakSet();
  #throwOnInvalidParam: boolean;

  constructor(
    private container: Container,
    options?: RouterOptions,
    config?: ConfigRequiredByRouter,
  ) {
    this.#middlewarePriority = options?.middlewarePriority;

    switch (config?.throwOnInvalidParamAccess ?? "development") {
      case "always":
        this.#throwOnInvalidParam = true;
        break;
      case "never":
        this.#throwOnInvalidParam = false;
        break;
      case "development":
        this.#throwOnInvalidParam = !!config?.development;
        break;
    }
  }

  /**
   * Register routes with the router
   */
  register(routes: Routes): void {
    for (const route of routes) {
      this.#matcher.register(route);

      // Apply priority sorting once per MiddlewareSet instance
      if (
        route.middleware &&
        this.#middlewarePriority &&
        !this.#sortedMiddlewareSets.has(route.middleware)
      ) {
        route.middleware.applyPriority(this.#middlewarePriority);
        this.#sortedMiddlewareSets.add(route.middleware);
      }
    }
  }

  /**
   * Handle an HTTP request
   */
  async handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const hostname = url.hostname;

    const match = this.#matcher.match(request.method, url.pathname, hostname);

    if (!match || !this.#checkConstraints(match.route, match.params)) {
      return new Response("Not Found", { status: 404 });
    }

    return this.#executeRoute(match.route, request, url, match.params);
  }

  #checkConstraints(route: RouteDefinition, params: Record<string, string>): boolean {
    // Check route-specific constraints (from 'where')
    // These MUST match - 404 if parameter doesn't exist or validation fails
    for (const [param, constraint] of Object.entries(route.constraints ?? {})) {
      if (constraint == null) continue;
      const value = params[param];
      if (value == null) return false;
      if (!matchConstraint(constraint, value)) return false;
    }

    // Check global pattern constraints (from 'parameterPatterns')
    // These only validate if the parameter exists
    for (const [param, constraint] of Object.entries(route.globalConstraints ?? {})) {
      if (constraint == null) continue;
      const value = params[param];
      if (value != null && !matchConstraint(constraint, value)) return false;
    }

    return true;
  }

  async #executeRoute(
    route: RouteDefinition,
    request: Request,
    url: URL,
    rawParams: Record<string, string>,
  ): Promise<Response> {
    const decodedParams: Record<string, string> = {};
    for (const [key, value] of Object.entries(rawParams)) {
      try {
        decodedParams[key] = decodeURIComponent(value);
      } catch {
        // If decoding fails, use the original value
        decodedParams[key] = value;
      }
    }

    const ctx: ControllerContext = {
      request,
      params: this.#throwOnInvalidParam
        ? throwOnMissingPropertyAccess(decodedParams)
        : decodedParams,
      rawParams: this.#throwOnInvalidParam ? throwOnMissingPropertyAccess(rawParams) : rawParams,
      url,
      meta: route.meta || {},
    };

    const finalHandler = async (ctx: ControllerContext): Promise<Response> => {
      const handler =
        typeof route.handler === "function" ? this.container.get(route.handler) : route.handler;
      return handler.handle(ctx);
    };

    const pipeline = route.middleware
      ? route.middleware.buildPipeline(this.container, finalHandler)
      : finalHandler;

    return pipeline(ctx);
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
function matchConstraint(constraint: ParamConstraint, value: string): boolean {
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
