import { inject } from "../container/inject";
import type { QueryParams } from "../contracts/Application";
import { Configuration } from "../contracts/Configuration";
import { Container } from "../contracts/Container";
import { Headers } from "../contracts/Headers";
import { IntegrationContext } from "../contracts/IntegrationContext";
import { getHostAndPortFromHeaders, getProtocolFromHeaders, parseHostString } from "./original-url";
import { type RouteDefinition, type Routes } from "./router-types";
import { replaceRouteParams } from "./syntax";

export class RouteUrlGenerator {
	#namedRoutes = new Map<string, RouteDefinition>();
	#container: Container;
	#config: Configuration;

	constructor(
		container: Container = inject(Container),
		config: Configuration = inject(Configuration),
	) {
		this.#container = container;
		this.#config = config;
	}

	register(routes: Routes): void {
		for (const route of routes) {
			if (route.routeName) {
				this.#namedRoutes.set(route.routeName, route);
			}
		}
	}

	url(
		name: string,
		options?: {
			params?: Record<string, string | number> | undefined;
			query?: QueryParams | undefined;
		},
	): string {
		const route = this.#namedRoutes.get(name);
		if (!route) {
			throw new Error(`Route "${name}" not found`);
		}

		const routeParams = options?.params ?? {};
		const path = replaceRouteParams(route.path, routeParams);

		// ============================================================
		// 2. Gather context information (if in request scope)
		// ============================================================
		const appUrl = this.#config.appUrl;
		let headers: Headers | undefined;
		let requestUrl: URL | undefined;

		const integrationContext = this.#container.getIfAvailable(IntegrationContext);
		headers = this.#container.getIfAvailable(Headers) ?? undefined;
		if (integrationContext) {
			requestUrl = integrationContext.requestUrl ?? undefined;
		}

		// ============================================================
		// 3. Resolve PROTOCOL using precedence hierarchy
		// ============================================================
		let protocol: string | null = null;

		// Step 1: Check config override (highest priority)
		if (appUrl?.overrideHttps !== undefined) {
			protocol = appUrl.overrideHttps ? "https:" : "http:";
		}

		// Step 2: Check request headers (X-Forwarded-Proto, etc.)
		if (protocol === null && headers) {
			protocol = getProtocolFromHeaders(headers);
		}

		// Step 3: Check config default
		if (protocol === null && appUrl?.defaultHttps !== undefined) {
			protocol = appUrl.defaultHttps ? "https:" : "http:";
		}

		// Step 4: Check request URL (lowest priority)
		if (protocol === null && requestUrl) {
			protocol = requestUrl.protocol;
		}

		// ============================================================
		// 4. Resolve HOST using precedence hierarchy
		// ============================================================
		let host: string | null = null;

		// Step 1: Check config override (highest priority)
		if (appUrl?.overrideHost) {
			const { hostname, port } = parseHostString(appUrl.overrideHost);
			host = port ? `${hostname}:${port}` : hostname;
		}

		// Step 2: Check request headers (X-Forwarded-Host, Host, X-Forwarded-Port)
		if (host === null && headers) {
			const { hostname, port } = getHostAndPortFromHeaders(headers);
			if (hostname) {
				host = port ? `${hostname}:${port}` : hostname;
			}
		}

		// Step 3: Check config default
		if (host === null && appUrl?.defaultHost) {
			const { hostname, port } = parseHostString(appUrl.defaultHost);
			host = port ? `${hostname}:${port}` : hostname;
		}

		// Step 4: Check request URL (lowest priority)
		if (host === null && requestUrl) {
			host = requestUrl.port ? `${requestUrl.hostname}:${requestUrl.port}` : requestUrl.hostname;
		}

		// ============================================================
		// 5. Build final URL with domain route special handling
		// ============================================================

		// Build base URL first
		let baseUrl: string;

		// For domain routes, use the domain from the route but protocol from resolution
		if (route.domainPattern) {
			const domain = replaceRouteParams(route.domainPattern, routeParams);

			if (protocol && domain) {
				// Build absolute URL with port omission rules
				const { hostname: domainHostname, port: domainPort } = parseHostString(domain);
				const shouldOmitPort =
					(protocol === "http:" && domainPort === "80") ||
					(protocol === "https:" && domainPort === "443");
				const finalHost =
					shouldOmitPort || !domainPort ? domainHostname : `${domainHostname}:${domainPort}`;

				baseUrl = `${protocol}//${finalHost}${path}`;
			} else {
				// Fallback to protocol-relative URL
				baseUrl = `//${domain}${path}`;
			}
		} else if (protocol && host) {
			// For regular routes, try to build absolute URL
			const { hostname, port: hostPort } = parseHostString(host);
			const shouldOmitPort =
				(protocol === "http:" && hostPort === "80") ||
				(protocol === "https:" && hostPort === "443");
			const finalHost = shouldOmitPort || !hostPort ? hostname : `${hostname}:${hostPort}`;

			baseUrl = `${protocol}//${finalHost}${path}`;
		} else {
			// Fallback to site-absolute URL
			baseUrl = path;
		}

		// ============================================================
		// 6. Append query string if provided
		// ============================================================
		const queryString = this.#buildQueryString(options?.query);
		return queryString ? `${baseUrl}?${queryString}` : baseUrl;
	}

	#buildQueryString(query: QueryParams | undefined): string {
		if (!query) {
			return "";
		}

		// Handle URLSearchParams directly
		if (query instanceof URLSearchParams) {
			return query.toString();
		}

		// Build query string from Record
		const params = new URLSearchParams();

		for (const [key, value] of Object.entries(query)) {
			if (value === null || value === undefined) {
				// Skip null and undefined values
				continue;
			}

			if (Array.isArray(value)) {
				// Handle arrays - add multiple entries
				for (const item of value) {
					if (item !== null && item !== undefined) {
						params.append(key, String(item));
					}
				}
			} else {
				// Handle scalar values
				params.append(key, String(value));
			}
		}

		return params.toString();
	}
}
