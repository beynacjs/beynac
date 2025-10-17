import type { Controller } from "../core/Controller";
import { arrayWrap } from "../utils";
import type {
  ExtractDomainAndPathParams,
  GroupChildren,
  GroupedRoutes,
  ParameterConstraint,
  RouteConstraint,
  RouteDefinition,
  RouteGroupOptions,
  RouteHandler,
  RouteOptions,
  Routes,
} from "./router-types";

function validateRouteSyntax(path: string): void {
  const originalPath = path;

  if (path.includes("*")) {
    throw new Error(
      `Route path "${path}" contains asterisk characters. Use {...param} for wildcard routes instead of ** or *.`,
    );
  }

  if (path.includes(":")) {
    throw new Error(
      `Route path "${path}" contains colon characters. Use {param} syntax instead of :param.`,
    );
  }

  if (/\{[^}]+\.\.\.\}/.test(path)) {
    throw new Error(
      `Route path "${path}" has incorrect wildcard syntax. Use {...param} not {param...}.`,
    );
  }

  if (/\{\.\.\.([a-zA-Z_][a-zA-Z0-9_]*)\}./.test(path)) {
    throw new Error(
      `Route path "${path}" has wildcard parameter in non-terminal position. ` +
        `Wildcards can only appear at the end of a path, like /files/{...path}, not /files/{...path}/something.`,
    );
  }

  if (/[^/.]\{/.test(path) || /\}[^/.]/.test(path)) {
    throw new Error(
      `Route path "${path}" has invalid parameter syntax. Parameters must capture whole path segments, not partial segments. Use /{param}/ not /text{param}/ or /{param}text/.`,
    );
  }

  // Any remaining curly braces after extracting valid params are invalid
  const pathWithoutValidPlaceholders = path.replaceAll(/\{(\.\.\.)?\w+\}/g, "");
  if (pathWithoutValidPlaceholders.includes("{") || pathWithoutValidPlaceholders.includes("}")) {
    throw new Error(
      `Route path "${originalPath}" contains invalid curly braces. ` +
        `Curly braces can only be used for parameters like {param} or {...wildcard}.`,
    );
  }
}

/**
 * Create a constraint that matches one of the given values
 *
 * @example
 * get('/status/{type}', controller, {
 *   where: { type: isIn(['active', 'inactive', 'pending']) }
 * })
 */
export function isIn(values: readonly string[]): RouteConstraint {
  return new RegExp(`^(${values.map((v) => RegExp.escape(v)).join("|")})$`);
}

function createRoute<
  const Path extends string,
  const Name extends string = never,
  const Domain extends string | undefined = undefined,
>(
  method: string | readonly string[],
  path: Path,
  handler: RouteHandler,
  options?: RouteOptions<Name, Path> & { domain?: Domain },
): RouteMethodReturn<Path, Name, Domain> {
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
    for (const [param, constraint] of Object.entries(options.where)) {
      if (constraint) {
        constraints.push({ param, constraint: constraint as RouteConstraint });
      }
    }
  }

  // Convert globalPatterns to ParameterConstraint[]
  const globalConstraints: ParameterConstraint[] = [];
  if (options?.globalPatterns) {
    for (const [param, constraint] of Object.entries(options.globalPatterns)) {
      if (constraint) {
        globalConstraints.push({ param, constraint });
      }
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
    globalConstraints,
    domainPattern: options?.domain, // Store user syntax
  };

  return { routes: [route] } as RouteMethodReturn<Path, Name, Domain>;
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
  options?: RouteOptions<Name, Path> & { domain?: Domain },
) => RouteMethodReturn<Path, Name, Domain>;

type RouteMethodReturn<
  Path extends string,
  Name extends string = never,
  Domain extends string | undefined = undefined,
> = [Name] extends [never]
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

export { delete_ as delete };

export const options: RouteMethodFunction = (path, handler, options) =>
  createRoute("OPTIONS", path, handler, options);

export function match<
  const Path extends string,
  const Name extends string = never,
  const Domain extends string | undefined = undefined,
>(
  methods: readonly string[],
  path: Path,
  handler: RouteHandler,
  options?: RouteOptions<Name, Path> & { domain?: Domain },
): RouteMethodReturn<Path, Name, Domain> {
  return createRoute(methods, path, handler, options);
}

export function any<
  const Path extends string,
  const Name extends string = never,
  const Domain extends string | undefined = undefined,
>(
  path: Path,
  handler: RouteHandler,
  options?: RouteOptions<Name, Path> & { domain?: Domain },
): RouteMethodReturn<Path, Name, Domain> {
  const methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"];
  return match(methods, path, handler, options);
}

/**
 * Create a redirect controller.
 *
 * This results in the appropriate HTTP status code being sent, 303,
 *
 * @param to - The URL to redirect to
 * @param options.permanent - If true, Make a permanent redirect that instructs search engines to update their index to the new URL (default: false)
 * @param options.preserveHttpMethod - If true, preserves HTTP method so POST requests will result in a POST request to the new URL (default: false)
 *
 * Status codes used:
 * - 303 See Other: Temporary, changes to GET (default)
 * - 307 Temporary Redirect: Temporary, preserves method
 * - 301 Moved Permanently: Permanent, changes to GET
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
  let status: number;

  if (options?.permanent) {
    status = options?.preserveHttpMethod ? 308 : 301;
  } else {
    status = options?.preserveHttpMethod ? 307 : 303;
  }

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
 * Define a group of routes without any shared options
 *
 * @example
 * // Grouping routes together
 * group([
 *   get('/dashboard', DashboardController),
 *   get('/users', UsersController),
 * ])
 */
export function group<const Children extends GroupChildren>(
  children: Children,
): GroupedRoutes<Children>;

/**
 * Define a group of routes with shared options
 *
 * @example
 * // Apply a prefix and middleware to a group of routes
 * group({ prefix: '/admin', middleware: AuthMiddleware }, [
 *   get('/dashboard', DashboardController),
 *   get('/users', UsersController),
 * ])
 */
export function group<
  const Children extends GroupChildren,
  const NamePrefix extends string = "",
  const PathPrefix extends string = "",
>(
  options: RouteGroupOptions<NamePrefix, PathPrefix>,
  children: Children,
): GroupedRoutes<Children, NamePrefix, PathPrefix>;

export function group<
  const Children extends GroupChildren,
  const NamePrefix extends string = "",
  const PathPrefix extends string = "",
>(
  optionsOrChildren: RouteGroupOptions<NamePrefix, PathPrefix> | Children,
  maybeChildren?: Children,
): GroupedRoutes<Children, NamePrefix, PathPrefix> {
  // handle single argument overload
  if (Array.isArray(optionsOrChildren)) {
    return group({}, optionsOrChildren as Children);
  }

  const options = optionsOrChildren as RouteGroupOptions<NamePrefix, PathPrefix>;
  const children = maybeChildren as Children;

  if (options.prefix && !options.prefix.startsWith("/")) {
    throw new Error(`Group prefix "${options.prefix}" must start with "/".`);
  }

  if (options.prefix) {
    validateRouteSyntax(options.prefix);
  }
  if (options.domain) {
    validateRouteSyntax(options.domain);
  }

  // strip "/" suffix to prevent double slash since all routes start with a slash
  const prefix = options.prefix?.replace(/\/$/, "");

  (!here) in review!;

  // Convert group options constraints to ParameterConstraint[]
  const groupConstraints: ParameterConstraint[] = [];
  if (options.where) {
    for (const [param, constraint] of Object.entries(options.where)) {
      if (constraint) {
        groupConstraints.push({ param, constraint: constraint as RouteConstraint });
      }
    }
  }

  // Convert group options globalPatterns to ParameterConstraint[]
  const groupGlobalConstraints: ParameterConstraint[] = [];
  if (options.globalPatterns) {
    for (const [param, constraint] of Object.entries(options.globalPatterns)) {
      if (constraint) {
        groupGlobalConstraints.push({ param, constraint });
      }
    }
  }

  const groupMiddleware = options.middleware ? arrayWrap(options.middleware) : [];
  const groupWithout = options.withoutMiddleware ? arrayWrap(options.withoutMiddleware) : [];

  // Validate: no wildcards in group prefixes
  if (prefix && /\{\.\.\./.test(prefix)) {
    throw new Error(
      `Group prefix "${prefix}" contains a wildcard parameter. ` +
        `Wildcards are not allowed in group prefixes. Use them in route paths instead.`,
    );
  }

  // Flatten immediately - process all child routes
  const flatRoutes: RouteDefinition[] = [];

  for (const childRoutes of children) {
    for (const route of childRoutes.routes) {
      if (options.domain && route.domainPattern && options.domain !== route.domainPattern) {
        throw new Error(
          `Domain conflict: route "${route.routeName || route.path}" specifies domain "${route.domainPattern}" ` +
            `but is inside a group with domain "${options.domain}". Nested routes cannot override parent domain.`,
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
        globalConstraints: [...groupGlobalConstraints, ...route.globalConstraints],
        domainPattern: domain ?? route.domainPattern,
      });
    }
  }

  // Type assertion needed because TypeScript can't statically verify the complex conditional return type at definition time,
  // but the runtime behavior correctly produces the expected type structure
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return -- Type assertion safe: runtime correctly produces GroupedRoutes type
  return { routes: flatRoutes } as any;
}

function applyPathPrefix(prefix: string | undefined, path: string): string {
  if (!prefix) return path;
  const normalizedPrefix = prefix.startsWith("/") ? prefix : `/${prefix}`;
  return path === "/" ? normalizedPrefix : `${normalizedPrefix}${path}`;
}

function applyNamePrefix(prefix: string | undefined, name: string | undefined): string | undefined {
  if (!prefix || !name) return name;
  return `${prefix}${name}`;
}
