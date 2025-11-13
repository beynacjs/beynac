import type { TypeToken } from "../container/container-key";
import { createTypeToken } from "../container/container-key";
import type { Container } from "../contracts";
import type { Dispatcher } from "./Dispatcher";
import { IntegrationContext } from "./IntegrationContext";
import type { Storage } from "./Storage";

export type QueryParams =
	| Record<string, string | number | undefined | null | Array<string | number | undefined | null>>
	| URLSearchParams;

/**
 * Options for routes with required parameters
 */
export type UrlOptionsWithParams<T extends string> = {
	params: Record<T, string | number>;
	query?: QueryParams | undefined;
};

/**
 * Options for routes WITHOUT parameters (params can be {}, undefined, or omitted)
 */
export type UrlOptionsNoParams = {
	params?: Record<never, never> | undefined;
	query?: QueryParams | undefined;
};

/**
 * Application contract for handling HTTP requests
 */
export interface Application<RouteParams extends Record<string, string> = {}> {
	/**
	 * Public container for dependency injection
	 */
	container: Container;

	/**
	 * Handle an incoming HTTP request. The request will be routed to the
	 * appropriate handler and will go through the middleware pipeline.
	 */
	handleRequest(request: Request, context: IntegrationContext): Promise<Response>;

	/**
	 * Execute a callback in a context where request data is available.
	 *
	 * This enables Beynac features that require request data, like the `Cookies`
	 * and `Headers` facades, and higher-level features like authentication that
	 * require access to headers and cookies.
	 */
	withIntegration<R>(context: IntegrationContext, callback: () => R): R;

	/**
	 * Accessor for the event dispatcher
	 */
	readonly events: Dispatcher;

	/**
	 * Accessor for the storage manager
	 */
	readonly storage: Storage;

	/**
	 * Generate a URL for a named route with type-safe parameters and optional query string
	 */
	url<N extends keyof RouteParams & string>(
		name: N,
		...args: RouteParams[N] extends never
			? [] | [options?: UrlOptionsNoParams]
			: [options: UrlOptionsWithParams<RouteParams[N]>]
	): string;
}

export const Application: TypeToken<Application> = createTypeToken("Application");
