import type { NoArgConstructor } from "../utils";
import type { ControllerContext } from "./Controller";

export type MiddlewareNext = (ctx: ControllerContext) => Response | Promise<Response>;

export type FunctionMiddleware = (
	ctx: ControllerContext,
	next: MiddlewareNext,
) => Response | Promise<Response>;

interface IClassMiddlewareInstance {
	handle(ctx: ControllerContext, next: MiddlewareNext): Response | Promise<Response>;
}

export type ClassMiddleware = NoArgConstructor<IClassMiddlewareInstance> & {
	isClassMiddleware: true;
};

/**
 * Base class for middleware that processes HTTP requests.
 * Middleware can modify requests, short-circuit responses, or pass through to the next handler.
 */
export abstract class BaseMiddleware implements IClassMiddlewareInstance {
	static readonly isClassMiddleware = true;

	/**
	 * Handle an HTTP request and optionally pass it to the next handler.
	 *
	 * @param ctx - Controller context containing request and route parameters
	 * @param next - Function to call the next middleware or final handler
	 * @returns Response or Promise resolving to Response
	 */
	abstract handle(ctx: ControllerContext, next: MiddlewareNext): Response | Promise<Response>;
}

export type MiddlewareReference = FunctionMiddleware | ClassMiddleware;

export function isClassMiddleware(value: unknown): value is ClassMiddleware {
	return (
		typeof value === "function" && "isClassMiddleware" in value && value.isClassMiddleware === true
	);
}
