import type { NoArgConstructor } from "../utils";
import type { ControllerContext, ControllerReturn } from "./Controller";

/**
 * Middleware interface for processing HTTP requests.
 * Middleware can modify requests, short-circuit responses, or pass through to the next handler.
 */
export interface Middleware {
  /**
   * Handle an HTTP request and optionally pass it to the next handler.
   *
   * @param ctx - Controller context containing request and route parameters
   * @param next - Function to call the next middleware or final handler
   * @returns Response, JSX.Element, null, or Promise resolving to any of these
   */
  handle(ctx: ControllerContext, next: MiddlewareNext): ControllerReturn;
}

export type MiddlewareNext = (ctx: ControllerContext) => ControllerReturn;

export type MiddlewareReference = NoArgConstructor<Middleware>;
