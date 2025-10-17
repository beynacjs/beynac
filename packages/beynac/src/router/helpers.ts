import type { Controller } from "../core/Controller";
import { arrayWrap } from "../utils";
import type {
  ExtractDomainAndPathParams,
  GroupChildren,
  GroupedRoutes,
  RouteConstraint,
  RouteDefinition,
  RouteGroupOptions,
  RouteHandler,
  RouteOptions,
  Routes,
} from "./router-types";
import { validateRouteSyntax } from "./syntax";

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

  validateRouteSyntax(path);
  if (options?.domain) {
    validateRouteSyntax(options.domain);
  }

  const constraints: Record<string, RouteConstraint> = options?.where
    ? (options.where as Record<string, RouteConstraint>)
    : {};

  // Get globalPatterns as object
  const globalConstraints: Record<string, RouteConstraint> = options?.globalPatterns || {};

  const withoutMiddleware = options?.withoutMiddleware ? arrayWrap(options.withoutMiddleware) : [];
  const middleware = (options?.middleware ? arrayWrap(options.middleware) : []).filter(
    (m) => !withoutMiddleware.includes(m),
  );

  const route: RouteDefinition = {
    methods,
    path, // Store user syntax: {param} and {...wildcard}
    handler,
    routeName: options?.name,
    middleware,
    withoutMiddleware,
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

  // Get group options constraints as object
  const constraints: Record<string, RouteConstraint> = options?.where
    ? (options.where as Record<string, RouteConstraint>)
    : {};

  // Get group options globalPatterns as object
  const groupGlobalConstraints: Record<string, RouteConstraint> = options?.globalPatterns || {};

  const groupWithout = options.withoutMiddleware ? arrayWrap(options.withoutMiddleware) : [];
  const groupMiddleware = (options.middleware ? arrayWrap(options.middleware) : []).filter(
    (m) => !groupWithout.includes(m),
  );

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

      // Merge group and route middleware
      // - Include group middleware not excluded by route's withoutMiddleware
      // - Append route middleware (may re-add previously excluded middleware)
      // - Remove duplicates
      const combined = [
        ...groupMiddleware.filter((m) => !route.withoutMiddleware.includes(m)),
        ...route.middleware,
      ];
      const finalMiddleware = combined.filter((m, index, arr) => arr.indexOf(m) === index);

      flatRoutes.push({
        ...route,
        path: applyPathPrefix(prefix, route.path),
        routeName: applyNamePrefix(options.namePrefix, route.routeName),
        middleware: finalMiddleware,
        withoutMiddleware: [...groupWithout, ...route.withoutMiddleware],
        constraints: { ...constraints, ...route.constraints },
        globalConstraints: { ...groupGlobalConstraints, ...route.globalConstraints },
        domainPattern: options?.domain ?? route.domainPattern,
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
