import type { Controller } from "../core/Controller";
import { arrayWrap } from "../utils";
import type { ParameterConstraint, RouteDefinition, RouteHandler } from "./internal-types";
import type {
  AddPrefixParams,
  ExtractDomainAndPathParams,
  ExtractRouteParams,
  MergeChildren,
  PrependNamePrefix,
  RouteConstraint,
  RouteGroupOptions,
  RouteOptions,
  Routes,
} from "./public-types";

// ============================================================================
// Syntax Validation
// ============================================================================

/**
 * Validate user-facing route syntax
 * User syntax: {param} and {...path}
 * This validates early so users get immediate feedback
 */
function validateRouteSyntax(path: string): void {
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

  // Validate parameter names: {...param} and {param}
  const wildcardParams = path.match(/\{\.\.\.([a-zA-Z_][a-zA-Z0-9_]*)\}/g);
  const regularParams = path.match(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g);

  // Validate: any remaining curly braces after extracting valid params are invalid
  let testPath = path;
  if (wildcardParams) {
    for (const param of wildcardParams) {
      testPath = testPath.replace(param, "");
    }
  }
  if (regularParams) {
    for (const param of regularParams) {
      testPath = testPath.replace(param, "");
    }
  }

  if (testPath.includes("{") || testPath.includes("}")) {
    throw new Error(
      `Route path "${originalPath}" contains invalid curly braces. ` +
        `Curly braces can only be used for parameters like {param} or {...wildcard}.`,
    );
  }
}

// ============================================================================
// Constraint Validators
// ============================================================================

/** Constraint: parameter must be numeric */
export const isNumber: RegExp = /^\d+$/;

/** Constraint: parameter must be alphabetic */
export const isAlpha: RegExp = /^[a-zA-Z]+$/;

/** Constraint: parameter must be alphanumeric */
export const isAlphaNumeric: RegExp = /^[a-zA-Z0-9]+$/;

/** Constraint: parameter must be UUID v4 */
export const isUuid: RegExp =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Constraint: parameter must be ULID */
export const isUlid: RegExp = /^[0-9A-HJKMNP-TV-Z]{26}$/i;

/** Constraint: parameter must be one of the given values */
export function isIn(values: readonly string[]): RegExp {
  return new RegExp(`^(${values.join("|")})$`);
}

// ============================================================================
// Routes Factory
// ============================================================================

/**
 * Create a Routes collection from an array of RouteDefinition
 */
function createRoutes<Params extends Record<string, string> = {}>(
  routes: RouteDefinition[],
): Routes<Params> {
  return { routes };
}

// ============================================================================
// Route Creation
// ============================================================================

/**
 * Helper to create a route with common logic
 */
function createRoute<
  const Path extends string,
  const Name extends string = never,
  const Domain extends string | undefined = undefined,
>(
  method: string | readonly string[],
  path: Path,
  handler: RouteHandler,
  options?: RouteOptions<Name> & { domain?: Domain },
): [Name] extends [never]
  ? Routes<{}>
  : Routes<{ [K in Name]: ExtractDomainAndPathParams<Domain, Path> }> {
  const methods = typeof method === "string" ? [method] : method;

  // Validate: path must start with "/" or be empty string
  if (path !== "" && !path.startsWith("/")) {
    throw new Error(`Route path "${path}" must start with "/" or be empty string.`);
  }

  // Validate syntax early for immediate feedback
  validateRouteSyntax(path);
  if (options?.domain) {
    validateRouteSyntax(options.domain);
  }

  // Convert where constraints to ParameterConstraint[]
  const constraints: ParameterConstraint[] = [];
  if (options?.where) {
    for (const [param, pattern] of Object.entries(options.where)) {
      constraints.push({ param, pattern });
    }
  }

  const route: RouteDefinition = {
    methods,
    path, // Store user syntax: {param} and {...wildcard}
    handler,
    routeName: options?.name,
    middleware: options?.middleware ? arrayWrap(options.middleware) : [],
    withoutMiddleware: options?.withoutMiddleware ? arrayWrap(options.withoutMiddleware) : [],
    constraints,
    domainPattern: options?.domain, // Store user syntax
  };

  // Type assertion needed because TypeScript can't infer the complex conditional return type
  return createRoutes([route]) as [Name] extends [never]
    ? Routes<{}>
    : Routes<{ [K in Name]: ExtractDomainAndPathParams<Domain, Path> }>;
}

/**
 * Type for HTTP method route functions
 */
type RouteMethodFunction = <
  const Path extends string,
  const Name extends string = never,
  const Domain extends string | undefined = undefined,
>(
  path: Path,
  handler: RouteHandler,
  options?: RouteOptions<Name> & { domain?: Domain },
) => [Name] extends [never]
  ? Routes<{}>
  : Routes<{ [K in Name]: ExtractDomainAndPathParams<Domain, Path> }>;

export const get: RouteMethodFunction = (path, handler, options) =>
  createRoute("GET", path, handler, options);

export const post: RouteMethodFunction = (path, handler, options) =>
  createRoute("POST", path, handler, options);

export const put: RouteMethodFunction = (path, handler, options) =>
  createRoute("PUT", path, handler, options);

export const patch: RouteMethodFunction = (path, handler, options) =>
  createRoute("PATCH", path, handler, options);

export const delete_: RouteMethodFunction = (path, handler, options) =>
  createRoute("DELETE", path, handler, options);

export const options: RouteMethodFunction = (path, handler, options) =>
  createRoute("OPTIONS", path, handler, options);

// ============================================================================
// Multi-Method Routes
// ============================================================================

export function match<
  const Path extends string,
  const Name extends string = never,
  const Domain extends string | undefined = undefined,
>(
  methods: readonly string[],
  path: Path,
  handler: RouteHandler,
  options?: RouteOptions<Name> & { domain?: Domain },
): [Name] extends [never]
  ? Routes<{}>
  : Routes<{ [K in Name]: ExtractDomainAndPathParams<Domain, Path> }> {
  return createRoute(methods, path, handler, options);
}

export function any<
  const Path extends string,
  const Name extends string = never,
  const Domain extends string | undefined = undefined,
>(
  path: Path,
  handler: RouteHandler,
  options?: RouteOptions<Name> & { domain?: Domain },
): [Name] extends [never]
  ? Routes<{}>
  : Routes<{ [K in Name]: ExtractDomainAndPathParams<Domain, Path> }> {
  const methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"];
  return match(methods, path, handler, options);
}

// ============================================================================
// Redirect Helper
// ============================================================================

/**
 * Create a redirect controller
 *
 * @param to - The URL to redirect to
 * @param options - Redirect options
 * @param options.permanent - If true, uses permanent redirect status (default: false)
 * @param options.preserveHttpMethod - If true, preserves HTTP method (default: false)
 *
 * Status codes used:
 * - 303 See Other: Temporary, changes to GET (default)
 * - 307 Temporary Redirect: Temporary, preserves method
 * - 308 Permanent Redirect: Permanent, preserves method
 *
 * @example
 * // Basic redirect - changes to GET
 * any('/old', redirect('/new'))
 *
 * // Preserve HTTP method
 * post('/old-api', redirect('/new-api', { preserveHttpMethod: true }))
 *
 * // Permanent redirect
 * get('/moved', redirect('/here', { permanent: true }))
 *
 * // Permanent + preserve method
 * any('/api/v1', redirect('/api/v2', { permanent: true, preserveHttpMethod: true }))
 */
export function redirect(
  to: string,
  options?: { permanent?: boolean; preserveHttpMethod?: boolean },
): Controller {
  const status = getRedirectStatus(
    options?.permanent ?? false,
    options?.preserveHttpMethod ?? false,
  );

  return {
    handle() {
      return new Response(null, {
        status,
        headers: { Location: to },
      });
    },
  };
}

/**
 * Determine the appropriate HTTP redirect status code
 */
function getRedirectStatus(permanent: boolean, preserveMethod: boolean): number {
  if (permanent && preserveMethod) return 308; // Permanent Redirect (preserves method)
  if (!permanent && preserveMethod) return 307; // Temporary Redirect (preserves method)
  // For both permanent and temporary without preserveMethod, use 303
  // 303 explicitly says "change to GET" which is what we want
  return 303; // See Other (changes to GET)
}

// ============================================================================
// Route Grouping
// ============================================================================

/**
 * Helper to apply path prefix
 */
function applyPathPrefix(prefix: string | undefined, path: string): string {
  if (!prefix) return path;
  const normalizedPrefix = prefix.startsWith("/") ? prefix : `/${prefix}`;
  return path === "/" ? normalizedPrefix : `${normalizedPrefix}${path}`;
}

/**
 * Helper to apply name prefix
 */
function applyNamePrefix(prefix: string | undefined, name: string | undefined): string | undefined {
  if (!prefix || !name) return name;
  return `${prefix}${name}`;
}

/**
 * Group routes with shared options - flattens immediately
 */
export function group<
  const Children extends readonly Routes<any>[],
  const PathPrefix extends string = "",
  const NamePrefix extends string = "",
>(
  options: RouteGroupOptions<NamePrefix> & { prefix?: PathPrefix },
  children: Children | (() => Children),
): Routes<
  PrependNamePrefix<
    ExtractRouteParams<PathPrefix> extends never
      ? MergeChildren<Children>
      : AddPrefixParams<MergeChildren<Children>, ExtractRouteParams<PathPrefix>>,
    NamePrefix
  >
> {
  const childrenArray = typeof children === "function" ? children() : children;

  // Validate: prefix must start with "/" if provided
  if (options.prefix && !options.prefix.startsWith("/")) {
    throw new Error(`Group prefix "${options.prefix}" must start with "/".`);
  }

  // Validate syntax early for immediate feedback
  if (options.prefix) {
    validateRouteSyntax(options.prefix);
  }
  if (options.domain) {
    validateRouteSyntax(options.domain);
  }

  const prefix = options.prefix;
  const domain = options.domain;

  // Convert group options constraints to ParameterConstraint[]
  const groupConstraints: ParameterConstraint[] = [];
  if (options.where) {
    for (const [param, pattern] of Object.entries(options.where)) {
      groupConstraints.push({ param, pattern });
    }
  }

  const groupMiddleware = options.middleware ? arrayWrap(options.middleware) : [];
  const groupWithout = options.withoutMiddleware ? arrayWrap(options.withoutMiddleware) : [];

  // Validate that wildcard prefixes don't have non-empty child paths
  if (prefix && /\{\.\.\./.test(prefix)) {
    for (const childRoutes of childrenArray) {
      for (const route of childRoutes.routes) {
        if (route.path !== "" && route.path !== "/") {
          throw new Error(
            `Route "${route.path}" will never match because its parent group has a wildcard "${prefix}". ` +
              `All routes within a wildcard group must have empty paths.`,
          );
        }
      }
    }
  }

  // Flatten immediately - process all child routes
  const flatRoutes: RouteDefinition[] = [];

  for (const childRoutes of childrenArray) {
    for (const route of childRoutes.routes) {
      // Check for domain conflicts
      if (domain && route.domainPattern && domain !== route.domainPattern) {
        throw new Error(
          `Domain conflict: route "${route.routeName || route.path}" specifies domain "${route.domainPattern}" ` +
            `but is inside a group with domain "${domain}". Nested routes cannot override parent domain.`,
        );
      }

      // Start with group middleware
      let finalMiddleware = [...groupMiddleware];

      // Remove group's withoutMiddleware (but not if they're in group's middleware - same level wins)
      finalMiddleware = finalMiddleware.filter(
        (m) => !groupWithout.includes(m) || groupMiddleware.includes(m),
      );

      // Get route's middleware and withoutMiddleware
      const routeMiddleware = route.middleware;
      const routeWithout = route.withoutMiddleware;

      // Remove route's withoutMiddleware (but not if they're in route's middleware - same level wins)
      finalMiddleware = finalMiddleware.filter(
        (m) => !routeWithout.includes(m) || routeMiddleware.includes(m),
      );

      // Remove any middleware that's already in routeMiddleware to avoid duplicates when we add them
      finalMiddleware = finalMiddleware.filter((m) => !routeMiddleware.includes(m));

      // Add route middleware (these can re-add previously excluded middleware)
      finalMiddleware = [...finalMiddleware, ...routeMiddleware];

      flatRoutes.push({
        ...route,
        path: applyPathPrefix(prefix, route.path),
        routeName: applyNamePrefix(options.namePrefix, route.routeName),
        middleware: finalMiddleware,
        withoutMiddleware: [...groupWithout, ...routeWithout],
        constraints: [...groupConstraints, ...route.constraints],
        domainPattern: domain ?? route.domainPattern,
      });
    }
  }

  // Type assertion needed because TypeScript can't statically verify the complex conditional return type at definition time,
  // but the runtime behavior correctly produces the expected type structure
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createRoutes(flatRoutes) as any;
}

// ============================================================================
// Global Configuration
// ============================================================================

/**
 * Global parameter constraints
 */
const globalConstraints: Map<string, RouteConstraint> = new Map<string, RouteConstraint>();

export function pattern(param: string, patternValue: RouteConstraint): void {
  globalConstraints.set(param, patternValue);
}

export { globalConstraints };

// ============================================================================
// Named Exports
// ============================================================================

/**
 * Export delete_ as delete for cleaner API
 * (delete is a reserved keyword so internal implementation uses delete_)
 */
export { delete_ as delete };
