import { addRoute, createRouter, findRoute, type RouterContext } from "rou3";
import type { RouteDefinition, RouteMatch, RouteMatcher } from "./router-types";
import { PARAM_PATTERN, WILDCARD_PARAM_PATTERN } from "./syntax";

function translateRouteSyntax(path: string): string {
  // Translate {...param} to **:param (wildcard)
  path = path.replace(WILDCARD_PARAM_PATTERN, "**:$1");

  // Translate {param} to :param (regular parameter)
  path = path.replace(PARAM_PATTERN, ":$1");

  return path;
}

function translateDomainToPath(domain: string): string {
  // rou3 doesn't support domain routing out of a box so we convert the domain
  // into a path segment like {/www/example/com/} to take advantage of
  // path-based matching.
  return "{/" + domain.replace(/\./g, "/") + "/}";
}

export class Rou3RouteMatcher implements RouteMatcher {
  private router: RouterContext<{ route: RouteDefinition }>;

  constructor() {
    this.router = createRouter<{ route: RouteDefinition }>();
  }

  register(route: RouteDefinition): void {
    let path = translateRouteSyntax(route.path);
    if (route.domainPattern) {
      path = translateDomainToPath(translateRouteSyntax(route.domainPattern)) + path;
    }
    for (const method of route.methods) {
      addRoute(this.router, method, path, { route });
    }
  }

  match(method: string, path: string, hostname: string): RouteMatch | undefined {
    const hostnamePath = translateDomainToPath(hostname);
    const fullPath = hostnamePath + path;
    let result = findRoute(this.router, method, fullPath);

    if (!result) {
      // Fallback to domain-agnostic route: just the path "/users"
      result = findRoute(this.router, method, path);
    }

    if (!result) {
      return undefined;
    }

    const { route } = result.data;
    const params = result.params ?? {};

    return { route, params };
  }
}
