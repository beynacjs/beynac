import type { Controller } from "../core/Controller";
import type { MiddlewareReference } from "../core/Middleware";
import type { NoArgConstructor } from "../utils";
import type { RouteConstraint } from "./public-types";

// ============================================================================
// Internal Types (shared between router implementation files)
// ============================================================================

/**
 * A route handler can be a Controller instance or class constructor
 */
export type RouteHandler = Controller | NoArgConstructor<Controller>;

/**
 * Parameter constraint definition
 */
export interface ParameterConstraint {
  param: string;
  pattern: RouteConstraint;
}

/**
 * A single route definition (pure data, no methods)
 * Stores user-facing syntax: {param} and {...wildcard}
 */
export interface RouteDefinition {
  methods: readonly string[];
  path: string;
  handler: RouteHandler;
  routeName?: string | undefined;
  middleware: MiddlewareReference[];
  withoutMiddleware: MiddlewareReference[];
  constraints: ParameterConstraint[];
  domainPattern?: string | undefined;
}

/**
 * Result of matching a route
 */
export interface RouteMatch {
  route: RouteDefinition;
  params: Record<string, string>;
}

/**
 * Interface for route matching implementations
 * Abstracts the underlying routing engine (rou3, etc.)
 */
export interface RouteMatcher {
  /**
   * Register a route definition with the matcher
   */
  register(route: RouteDefinition): void;

  /**
   * Find a matching route for the given request
   * @param method HTTP method
   * @param path Request path
   * @param hostname Request hostname (for domain routing)
   * @returns RouteMatch if found, undefined otherwise
   */
  match(method: string, path: string, hostname: string): RouteMatch | undefined;
}
