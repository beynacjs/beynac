import type { RouteDefinition } from "./internal-types";
import type { Routes, UrlFunction } from "./public-types";

// ============================================================================
// Route Registry
// ============================================================================

/**
 * Registry for named routes with type-safe URL generation
 */
export class RouteRegistry<Params extends Record<string, string> = {}> {
  readonly url: UrlFunction<Params>;
  private namedRoutes = new Map<string, RouteDefinition>();

  constructor(routes?: Routes<Params>) {
    // Build map of named routes
    for (const route of routes?.routes ?? []) {
      if (route.routeName) {
        this.namedRoutes.set(route.routeName, route);
      }
    }

    // Create type-safe URL generation function
    this.url = (name, ...args) => {
      const route = this.namedRoutes.get(name);
      if (!route) {
        throw new Error(`Route "${name}" not found`);
      }

      const params = args[0] || {};

      // If route has domain, generate protocol-relative URL
      if (route.domainPattern) {
        let domain = route.domainPattern;
        let path = route.path;

        // Replace parameters in both domain and path
        // Note: paths are stored in user format {param}, {...wildcard}
        for (const [key, value] of Object.entries(params)) {
          const stringValue = String(value);
          // Replace in domain
          domain = domain.replace(`{...${key}}`, stringValue);
          domain = domain.replace(`{${key}}`, stringValue);
          // Replace in path
          path = path.replace(`{...${key}}`, stringValue);
          path = path.replace(`{${key}}`, stringValue);
        }

        return `//${domain}${path}`;
      }

      // No domain - return path only
      // Note: paths are stored in user format {param}, {...wildcard}
      let path = route.path;
      for (const [key, value] of Object.entries(params)) {
        // Replace wildcard parameters ({...key}) and regular parameters ({key})
        path = path.replace(`{...${key}}`, String(value));
        path = path.replace(`{${key}}`, String(value));
      }
      return path;
    };
  }
}
