import { addRoute, createRouter, findRoute, type RouterContext } from "rou3";
import { globalConstraints } from "./helpers";
import type { RouteDefinition, RouteMatch, RouteMatcher } from "./router-types";

// ============================================================================
// Syntax Translation
// ============================================================================

/**
 * Validate and translate user-facing route syntax to rou3's internal syntax
 * User syntax: {param} and {...path}
 * rou3 syntax: :param and **:path
 */
function translateRouteSyntax(path: string): string {
  const originalPath = path;

  // Validate: reject asterisks (could leak through to rou3)
  if (path.includes("*")) {
    throw new Error(
      `Route path "${path}" contains asterisk characters. Use {...param} for wildcard routes instead of ** or *.`,
    );
  }

  // Validate: reject colons (reserved for rou3 internal use)
  if (path.includes(":")) {
    throw new Error(
      `Route path "${path}" contains colon characters. Use {param} syntax instead of :param.`,
    );
  }

  // Validate: detect wrong wildcard order {param...}
  if (/\{[^}]+\.\.\.\}/.test(path)) {
    throw new Error(
      `Route path "${path}" has incorrect wildcard syntax. Use {...param} not {param...}.`,
    );
  }

  // Validate: parameters must be whole path segments
  // Check for text before opening brace (except at start or after /, .)
  if (/[^/.]\{/.test(path)) {
    throw new Error(
      `Route path "${path}" has invalid parameter syntax. Parameters must capture whole path segments, not partial segments. Use /{param}/ not /text{param}/.`,
    );
  }

  // Check for text after closing brace (except at end or before /, .)
  if (/\}[^/.]/.test(path)) {
    throw new Error(
      `Route path "${path}" has invalid parameter syntax. Parameters must capture whole path segments, not partial segments. Use /{param}/ not /{param}text/.`,
    );
  }

  // Translate {...param} to **:param (wildcard)
  path = path.replace(/\{\.\.\.([a-zA-Z_][a-zA-Z0-9_]*)\}/g, "**:$1");

  // Translate {param} to :param (regular parameter)
  path = path.replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, ":$1");

  // Validate: any remaining curly braces are invalid
  if (path.includes("{") || path.includes("}")) {
    throw new Error(
      `Route path "${originalPath}" contains invalid curly braces. ` +
        `Curly braces can only be used for parameters like {param} or {...wildcard}.`,
    );
  }

  return path;
}

// ============================================================================
// Domain Translation Helpers
// ============================================================================

/**
 * Convert a domain pattern to path format for rou3 matching
 * Input: ":subdomain.example.com" (already in rou3 format)
 * Output: "{/:subdomain/example/com/}"
 */
function translateDomainToPath(domain: string): string {
  // Convert dots to slashes and wrap with curly braces
  return "{/" + domain.replace(/\./g, "/") + "/}";
}

/**
 * Convert a hostname to path format for matching
 * Input: "acme.example.com"
 * Output: "{/acme/example/com/}"
 */
function hostnameToPath(hostname: string): string {
  // Convert dots to slashes and wrap with curly braces
  return "{/" + hostname.replace(/\./g, "/") + "/}";
}

// ============================================================================
// Rou3RouteMatcher Implementation
// ============================================================================

/**
 * RouteMatcher implementation using rou3 routing library
 */
export class Rou3RouteMatcher implements RouteMatcher {
  private router: RouterContext<{ route: RouteDefinition }>;

  constructor() {
    this.router = createRouter<{ route: RouteDefinition }>();
  }

  register(route: RouteDefinition): void {
    // Translate user syntax to rou3 syntax
    const translatedPath = translateRouteSyntax(route.path);
    const translatedDomain = route.domainPattern
      ? translateRouteSyntax(route.domainPattern)
      : undefined;

    // Register route for each HTTP method
    for (const method of route.methods) {
      if (translatedDomain) {
        // For domain routes, encode domain as path segments so rou3 can match naturally
        // Example: ":subdomain.example.com" + "/users/:id" -> "/:subdomain/example/com//users/:id"
        const domainPath = translateDomainToPath(translatedDomain);
        const fullPath = domainPath + translatedPath;
        addRoute(this.router, method, fullPath, { route });
      } else {
        // Register path only: "/path" (has leading slash)
        addRoute(this.router, method, translatedPath, { route });
      }
    }
  }

  match(method: string, path: string, hostname: string): RouteMatch | undefined {
    // Try domain-specific route first by encoding hostname as path
    // Example: "acme.example.com" + "/users" -> "/acme/example/com//users"
    const hostnamePath = hostnameToPath(hostname);
    const fullPath = hostnamePath + path;
    let result = findRoute(this.router, method, fullPath);

    if (!result) {
      // Fallback to domain-agnostic route: just the path "/users"
      result = findRoute(this.router, method, path);
    }

    if (!result) {
      return undefined;
    }

    const data = result.data;
    const route = data.route;
    const params = result.params || {};

    // Check parameter constraints (rou3 extracts all params automatically now!)
    if (!this.#checkConstraints(route, params)) {
      return undefined;
    }

    return {
      route,
      params,
    };
  }

  #checkConstraints(route: RouteDefinition, params: Record<string, string>): boolean {
    // Check route-specific constraints
    for (const constraint of route.constraints) {
      const value = params[constraint.param];
      if (value) {
        // Support both RegExp and function constraints
        if (typeof constraint.pattern === "function") {
          if (!constraint.pattern(value)) return false;
        } else {
          if (!constraint.pattern.test(value)) return false;
        }
      }
    }

    // Check global constraints
    for (const [param, pattern] of globalConstraints) {
      const value = params[param];
      if (value) {
        if (typeof pattern === "function") {
          if (!pattern(value)) return false;
        } else {
          if (!pattern.test(value)) return false;
        }
      }
    }

    return true;
  }
}
