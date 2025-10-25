import type { Configuration, Container } from "../contracts";
import type { MiddlewareReference } from "./Middleware";
import { addRoute, createMatcher, findRoute, type MatcherContext } from "./matcher";
import { RequestHandler } from "./RequestHandler";
import type {
	BuiltInRouteConstraint,
	ParamConstraint,
	RouteDefinition,
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

export class Router {
	#matcher: MatcherContext<{ route: RouteDefinition }>;
	#middlewarePriority: MiddlewareReference[] | undefined;
	#sortedMiddlewareSets = new WeakSet();
	#requestHandler: RequestHandler;

	constructor(
		private container: Container,
		options?: RouterOptions,
		config?: Pick<Configuration, "throwOnInvalidParamAccess" | "development">,
	) {
		this.#matcher = createMatcher<{ route: RouteDefinition }>();
		this.#middlewarePriority = options?.middlewarePriority;
		this.#requestHandler = new RequestHandler(this.container, config);
	}

	/**
	 * Register routes with the router
	 */
	register(routes: Routes): void {
		for (const route of routes) {
			for (const method of route.methods) {
				addRoute(this.#matcher, method, route.path, { route }, route.domainPattern);
			}

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

		const result = findRoute(this.#matcher, request.method, url.pathname, hostname);

		if (!result) {
			return new Response("Not Found", { status: 404 });
		}

		const { route } = result.data;
		const params = result.params ?? {};

		if (!this.#checkConstraints(route, params)) {
			return new Response("Not Found", { status: 404 });
		}

		return this.#requestHandler.handle(route, request, url, params);
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
