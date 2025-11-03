import type { NoArgConstructor } from "../utils";
import type { ControllerContext } from "./Controller";

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
	 * @returns Response or Promise resolving to Response
	 */
	handle(ctx: ControllerContext, next: MiddlewareNext): Response | Promise<Response>;
}

export type MiddlewareNext = (ctx: ControllerContext) => Response | Promise<Response>;

export type MiddlewareReference = NoArgConstructor<Middleware>;
