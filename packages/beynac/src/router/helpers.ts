import type { Controller } from "../core/Controller";
import { arrayWrapOptional } from "../utils";
import { MiddlewareSet } from "./MiddlewareSet";
import type {
  ExtractDomainAndPathParams,
  GroupChildren,
  GroupedRoutes,
  ParamConstraint,
  ParamConstraints,
  RouteDefinition,
  RouteGroupOptions,
  RouteHandler,
  RouteOptions,
  Routes,
} from "./router-types";
import { validateGroupPathSyntax, validateRoutePathSyntax } from "./syntax";

/**
 * Create a constraint that matches one of the given values
 *
 * @example
 * get('/status/{type}', controller, {
 *   where: { type: isIn(['active', 'inactive', 'pending']) }
 * })
 */
export function isIn(values: readonly string[]): ParamConstraint {
  return new RegExp(`^(${values.map((v) => RegExp.escape(v)).join("|")})$`);
}

function mergeConstraints(
  parent: ParamConstraints | undefined,
  child: ParamConstraints | null,
): ParamConstraints | null {
  if (!parent) return child;
  if (!child) return parent;
  return { ...parent, ...child };
}

function createRoute<
  const Path extends string,
  const Name extends string = never,
  const Domain extends string | undefined = undefined,
>(
  method: string | readonly string[],
  path: Path,
  handler: RouteHandler,
  {
    domain,
    globalPatterns,
    middleware: middlewareOption,
    name,
    where,
    withoutMiddleware,
  }: RouteOptions<Name, Path> & { domain?: Domain } = {},
): RouteMethodReturn<Path, Name, Domain> {
  const methods = typeof method === "string" ? [method] : method;

  // Validate: path must start with "/" or be empty string
  if (!path.startsWith("/")) {
    throw new Error(`Route path "${path}" must start with "/"`);
  }

  validateRoutePathSyntax(path);
  validateRoutePathSyntax(domain);

  const route: RouteDefinition = {
    methods,
    path,
    handler,
    routeName: name,
    middleware: MiddlewareSet.createIfRequired(middlewareOption, withoutMiddleware),
    constraints: where || null,
    globalConstraints: globalPatterns || null,
    domainPattern: domain,
  };

  return [route] as RouteMethodReturn<Path, Name, Domain>;
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

/**
 * Register a route that responds to GET requests
 *
 * @example
 * get('/users', UsersController)
 * get('/users/{id}', UserController, { name: 'users.show' })
 */
export const get: RouteMethodFunction = (path, handler, options) =>
  createRoute("GET", path, handler, options);

/**
 * Register a route that responds to POST requests
 *
 * @example
 * post('/users', CreateUserController)
 */
export const post: RouteMethodFunction = (path, handler, options) =>
  createRoute("POST", path, handler, options);

/**
 * Register a route that responds to PUT requests
 *
 * @example
 * put('/users/{id}', UpdateUserController)
 */
export const put: RouteMethodFunction = (path, handler, options) =>
  createRoute("PUT", path, handler, options);

/**
 * Register a route that responds to PATCH requests
 *
 * @example
 * patch('/users/{id}', PatchUserController)
 */
export const patch: RouteMethodFunction = (path, handler, options) =>
  createRoute("PATCH", path, handler, options);

/**
 * Register a route that responds to DELETE requests
 *
 * @example
 * delete('/users/{id}', DeleteUserController)
 */
export const delete_: RouteMethodFunction = (path, handler, options) =>
  createRoute("DELETE", path, handler, options);

export { delete_ as delete };

/**
 * Register a route that responds to OPTIONS requests
 *
 * @example
 * options('/users', OptionsController)
 */
export const options: RouteMethodFunction = (path, handler, options) =>
  createRoute("OPTIONS", path, handler, options);

/**
 * Register a route that responds to specific HTTP methods
 *
 * @example
 * match(['GET', 'POST'], '/contact', ContactController)
 */
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

/**
 * Register a route that responds to any HTTP method
 *
 * @example
 * any('/webhook', WebhookController)
 */
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
  if (Array.isArray(optionsOrChildren)) {
    return group({}, optionsOrChildren as Children);
  }

  let { domain, globalPatterns, middleware, withoutMiddleware, namePrefix, prefix, where } =
    optionsOrChildren as RouteGroupOptions<string, string>;
  const children = maybeChildren as Children;

  validateGroupPathSyntax(prefix);
  validateRoutePathSyntax(domain);

  // strip "/" suffix from the prefix to prevent double slash since all routes start with a slash
  prefix = prefix?.replace(/\/$/, "");

  const groupWithout = arrayWrapOptional(withoutMiddleware);
  const groupMiddleware = arrayWrapOptional(middleware).filter((m) => !groupWithout.includes(m));

  const mergedChildren: RouteDefinition[] = [];
  const mergedSets = new Set<MiddlewareSet>();

  const groupMiddlewareSet = MiddlewareSet.createIfRequired(middleware, withoutMiddleware);

  for (const childRoutes of children) {
    for (const route of childRoutes) {
      if (domain && route.domainPattern && domain !== route.domainPattern) {
        throw new Error(
          `Domain conflict: route "${route.routeName || route.path}" specifies domain "${route.domainPattern}" ` +
            `but is inside a group with domain "${domain}". Nested routes cannot override parent domain.`,
        );
      }

      // Middleware merging logic
      let middleware = route.middleware;
      if (middleware) {
        // merge the groups's middleware into the route, and only do this once
        // per middleware object because they can be shared among many routes
        if (!mergedSets.has(middleware)) {
          middleware.mergeWithGroup(groupMiddleware, groupWithout);
          mergedSets.add(middleware);
        }
      } else {
        // all routes with no middleware can share the groups' middleware
        middleware = groupMiddlewareSet;
      }

      mergedChildren.push({
        ...route,
        path: applyPathPrefix(prefix, route.path),
        routeName: applyNamePrefix(namePrefix, route.routeName),
        middleware,
        constraints: mergeConstraints(where, route.constraints),
        globalConstraints: mergeConstraints(globalPatterns, route.globalConstraints),
        domainPattern: domain ?? route.domainPattern,
      });
    }
  }
  return mergedChildren;
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
