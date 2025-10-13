import type { NoArgConstructor } from "../utils";

/**
 * Middleware interface for processing HTTP requests.
 * Middleware can modify requests, short-circuit responses, or pass through to the next handler.
 */
export interface Middleware {
  /**
   * Handle an HTTP request and optionally pass it to the next handler.
   *
   * @param request - The incoming HTTP request
   * @param next - Function to call the next middleware or final handler
   * @returns Response or Promise resolving to the HTTP response
   */
  handle(
    request: Request,
    next: (request: Request) => Response | Promise<Response>,
  ): Response | Promise<Response>;
}

/**
 * A middleware reference can be:
 * - A class constructor that will be instantiated via the container
 * - An instance of a middleware (including inline object literals)
 */
export type MiddlewareReference = Middleware | NoArgConstructor<Middleware>;
