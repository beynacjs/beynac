/** @jsxImportSource ../view */

import { STATUS_CODES } from "node:http";
import { inject } from "../container/inject";
import { RequestLocals, ViewRenderer } from "../contracts";
import { AbortException, abort, abortExceptionKey } from "./abort";
import type { ControllerContext } from "./Controller";
import { BaseMiddleware, type MiddlewareNext } from "./Middleware";
import {
	CurrentRouteDefinition,
	RouteDefinition,
	type StatusPageComponent,
	StatusPages,
} from "./router-types";

/**
 * Middleware that renders custom error pages for 4xx and 5xx responses.
 */
export class StatusPagesMiddleware extends BaseMiddleware {
	constructor(
		private currentRoute: RouteDefinition = inject(CurrentRouteDefinition),
		private locals: RequestLocals = inject(RequestLocals),
		private viewRenderer: ViewRenderer = inject(ViewRenderer),
	) {
		super();
	}

	async handle(ctx: ControllerContext, next: MiddlewareNext): Promise<Response> {
		let response: Response;
		let abortException: AbortException | undefined;

		try {
			response = await next(ctx);
		} catch (error) {
			if (error instanceof AbortException) {
				abortException = error;
				response = error.response;
			} else {
				// Convert unknown errors to 500 responses
				abort.internalServerError(
					"Internal Server Error",
					error instanceof Error
						? error
						: new Error(`Request terminated by throwing non-Error value: ${String(error)}`, {
								cause: error,
							}),
				);
			}
		}

		// Only handle error responses (4xx and 5xx)
		if (response.status >= 400 && response.status < 600) {
			const statusPages = this.currentRoute.statusPages;
			if (statusPages) {
				const StatusPageComponent = matchStatusPage(statusPages, response.status);

				if (StatusPageComponent) {
					if (abortException) {
						this.locals.delete(abortExceptionKey);
					}

					const statusText = STATUS_CODES[response.status];
					const jsx = (
						<StatusPageComponent
							status={response.status}
							statusText={statusText}
							error={abortException?.cause ?? abortException}
						/>
					);

					// Return rendered response with original status code (never streamed)
					return this.viewRenderer.renderResponse(jsx, {
						status: response.status,
						streaming: false,
					});
				}
			}
		}

		return response;
	}
}

function matchStatusPage(statusPages: StatusPages, status: number): StatusPageComponent | null {
	if (statusPages[status]) {
		return statusPages[status];
	}

	if (status >= 400 && status < 500 && "4xx" in statusPages) {
		return statusPages["4xx"];
	}

	if (status >= 500 && status < 600 && "5xx" in statusPages) {
		return statusPages["5xx"];
	}

	return null;
}
