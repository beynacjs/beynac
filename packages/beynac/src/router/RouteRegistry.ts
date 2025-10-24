import type { RouteDefinition, Routes, UrlFunction } from "./router-types";
import { replaceRouteParams } from "./syntax";

export class RouteRegistry<Params extends Record<string, string> = {}> {
	readonly url: UrlFunction<Params>;
	#namedRoutes = new Map<string, RouteDefinition>();

	constructor(routes: Routes<Params> = []) {
		for (const route of routes) {
			if (route.routeName) {
				this.#namedRoutes.set(route.routeName, route);
			}
		}

		// Create type-safe URL generation function
		this.url = (name, ...args) => {
			const route = this.#namedRoutes.get(name);
			if (!route) {
				throw new Error(`Route "${name}" not found`);
			}

			const params = args[0] ?? {};

			if (route.domainPattern) {
				// TODO currently we generate a protocol-relative URL, we should reflect back the request protocol
				const domain = replaceRouteParams(route.domainPattern, params);
				const path = replaceRouteParams(route.path, params);
				return `//${domain}${path}`;
			}

			// TODO currently we generate a site-absolute URL, we should reflect back the request host and protocol
			return replaceRouteParams(route.path, params);
		};
	}
}
