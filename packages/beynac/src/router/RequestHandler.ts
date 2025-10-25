import { inject } from "../container/inject";
import { Configuration, Container, RequestLocals } from "../contracts";
import { extendsClass } from "../utils";
import { renderResponse } from "../view/markup-stream";
import { isJsxElement, type JSX } from "../view/public-types";
import { AbortException, abortExceptionKey } from "./abort";
import { Controller, type ControllerContext, type ControllerReturn } from "./Controller";
import { throwOnMissingPropertyAccess } from "./params-access-checker";
import type { ControllerReference, RouteDefinition, RouteWithParams } from "./router-types";

export class RequestHandler {
	#throwOnInvalidParam: boolean;

	constructor(
		private container: Container = inject(Container),
		config: Configuration = inject(Configuration),
	) {
		switch (config.throwOnInvalidParamAccess ?? "development") {
			case "always":
				this.#throwOnInvalidParam = true;
				break;
			case "never":
				this.#throwOnInvalidParam = false;
				break;
			case "development":
				this.#throwOnInvalidParam = !!config.development;
				break;
		}
	}

	async handle(match: RouteWithParams): Promise<Response> {
		// Get RequestLocals for this request (scoped)
		const locals = this.container.get(RequestLocals);

		try {
			// Decode URL parameters
			const decodedParams: Record<string, string> = {};
			for (const [key, value] of Object.entries(match.params)) {
				try {
					decodedParams[key] = decodeURIComponent(value);
				} catch {
					// If decoding fails, use the original value
					decodedParams[key] = value;
				}
			}

			// Create controller context
			const ctx: ControllerContext = {
				request: match.request,
				params: this.#throwOnInvalidParam
					? throwOnMissingPropertyAccess(decodedParams)
					: decodedParams,
				rawParams: this.#throwOnInvalidParam
					? throwOnMissingPropertyAccess(match.params)
					: match.params,
				url: match.url,
				meta: match.route.meta || {},
			};

			// Build and execute pipeline
			const finalHandler = async (ctx: ControllerContext): Promise<Response> => {
				let result: ControllerReturn;
				if (extendsClass(match.route.controller, Controller)) {
					const controller = this.container.get(match.route.controller);
					result = controller.handle(ctx);
				} else {
					// Check if controller is a class constructor that doesn't extend Controller
					if (
						typeof match.route.controller === "function" &&
						match.route.controller.toString().startsWith("class ")
					) {
						throw new Error(
							`${controllerDescription(match.route.controller)} for ${match.route.path} is a class but does not extend Controller. ` +
								`Class-based handlers must extend the Controller class.`,
						);
					}
					result = match.route.controller(ctx);
				}

				return this.#convertToResponse(match.route, await result);
			};

			const pipeline = match.route.middleware
				? match.route.middleware.buildPipeline(this.container, finalHandler)
				: finalHandler;

			const pipelineResult = await pipeline(ctx);
			const response = await this.#convertToResponse(match.route, pipelineResult);

			// Check if abort was caught by user code
			const abortException = locals.get(abortExceptionKey);
			if (abortException) {
				// TODO: Connect to logging mechanism when available
				console.error(
					"abort() was caught and ignored by user code. The abort response will be returned anyway, but unnecessary work has probably been done. Ensure that your code rethrows AbortException if caught.",
				);
				throw abortException;
			}

			return response;
		} catch (error) {
			// Handle AbortException - return the wrapped response
			if (error instanceof AbortException) {
				locals.delete(abortExceptionKey); // Mark as properly handled
				return error.response;
			}

			// Re-throw any other errors
			throw error;
		}
	}

	async #convertToResponse(
		route: RouteDefinition,
		result: Response | JSX.Element | null,
	): Promise<Response> {
		if (result instanceof Response) {
			return result;
		}

		if (result === null) {
			return new Response();
		}

		if (isJsxElement(result)) {
			return renderResponse(result);
		}

		const hasHandleMethod = typeof (result as Controller)?.handle !== "function";

		if (hasHandleMethod) {
			throw new Error(
				`${controllerDescription(route.controller)} for ${route.path} returned an object with a 'handle' method. This can happen if you have a controller that does not extend the Controller class.`,
			);
		}

		throw new Error(
			`${controllerDescription(route.controller)} for ${route.path} returned an invalid value. Expected Response, JSX element, or null, ` +
				`but got: ${Object.prototype.toString.call(result)}`,
		);
	}
}

const controllerDescription = (controller: ControllerReference) => {
	return "Controller" + (controller.name ? " " : "") + controller.name;
};
