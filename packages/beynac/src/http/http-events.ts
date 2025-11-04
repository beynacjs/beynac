import type { ControllerContext } from "./Controller";

export class RequestHandled {
	readonly #response: Response;

	constructor(
		public readonly context: ControllerContext,
		public readonly responseStatus: number,
		public readonly responseHeaders: Headers,
		response: Response,
	) {
		this.#response = response;
	}

	/**
	 * Get a clone of the response.
	 *
	 * WARNING: Cloning a streaming response will buffer all data in memory.
	 * Only call this if you need to inspect the response body.
	 */
	cloneResponse(): Response {
		return this.#response.clone() as Response;
	}
}
