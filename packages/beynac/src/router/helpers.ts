import type { Controller } from "../core/Controller";
import type { NoArgConstructor } from "../utils";
import { arrayWrapOptional } from "../utils";
import { MiddlewareSet } from "./MiddlewareSet";
import type { ResourceAction } from "./ResourceController";
import { ResourceController } from "./ResourceController";
import type {
  ApiResourceRouteMap,
  ExtractDomainAndPathParams,
  GroupChildren,
  GroupedRoutes,
  InferResourceName,
  ParamConstraint,
  ParamConstraints,
  ResourceRouteMap,
  RouteDefinition,
  RouteGroupOptions,
  RouteHandler,
  RouteOptions,
  Routes,
} from "./router-types";
import { validateDomainSyntax, validateGroupPathSyntax, validateRoutePathSyntax } from "./syntax";

/**
 * Create a constraint that matches one of the given values
 *
 * @example
 * get('/status/{type}', controller, {
 *   where: { type: isIn(['active', 'inactive', 'pending']) }
 * })
 */
export function isIn(values: readonly string[]): ParamConstraint {
  // Escape special regex characters manually since RegExp.escape is not widely available
  const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^(${values.map((v) => escapeRegex(v)).join("|")})$`);
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
    parameterPatterns,
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
  validateDomainSyntax(domain);

  const route: RouteDefinition = {
    methods,
    path,
    handler,
    routeName: name,
    middleware: MiddlewareSet.createIfRequired(middlewareOption, withoutMiddleware),
    constraints: where || null,
    globalConstraints: parameterPatterns || null,
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

  let { domain, parameterPatterns, middleware, withoutMiddleware, namePrefix, prefix, where } =
    optionsOrChildren as RouteGroupOptions<string, string>;
  const children = maybeChildren as Children;

  validateGroupPathSyntax(prefix);
  validateDomainSyntax(domain);

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
        globalConstraints: mergeConstraints(parameterPatterns, route.globalConstraints),
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

/**
 * Options for resource route registration
 */
export interface ResourceOptions<ResourceName extends string, Path extends string>
  extends Omit<RouteOptions<never, Path>, "name"> {
  /**
   * Override the base name for route naming. If not provided, derived from path.
   * @example
   * resource('/photos', PhotoController, { name: 'pics' })
   * // Creates routes: pics.index, pics.show, etc.
   */
  name?: ResourceName;

  /**
   * Only register these specific actions
   * @example
   * resource('/photos', PhotoController, { only: ['index', 'show'] })
   */
  only?: readonly ResourceAction[];

  /**
   * Register all actions except these
   * @example
   * resource('/photos', PhotoController, { except: ['destroy'] })
   */
  except?: readonly ResourceAction[];
}

/**
 * Register RESTful resource routes for a controller.
 *
 * Creates routes for the seven standard resource actions:
 * - GET /resource -> index
 * - GET /resource/create -> create
 * - POST /resource -> store
 * - GET /resource/{id} -> show
 * - GET /resource/{id}/edit -> edit
 * - PUT/PATCH /resource/{id} -> update
 * - DELETE /resource/{id} -> destroy
 *
 * Route names are derived from the path by removing the leading slash
 * and converting remaining slashes to dots.
 *
 * @param path - The resource path (e.g., '/photos')
 * @param controller - A ResourceController subclass
 * @param options - Options for filtering and configuring routes
 *
 * @example
 * class PhotoController extends ResourceController {
 *   index() { return new Response('List photos'); }
 *   show() { return new Response('Show photo'); }
 * }
 *
 * resource('/photos', PhotoController)
 * // Creates all 7 resource routes with names: photos.index, photos.show, etc.
 *
 * @example
 * // Nested paths convert slashes to dots in route names
 * resource('/admin/photos', PhotoController)
 * // Route names: admin.photos.index, admin.photos.show, etc.
 * // URL paths: /admin/photos, /admin/photos/{id}, etc.
 *
 * @example
 * // Deep nesting
 * resource('/api/v1/users', UserController)
 * // Route names: api.v1.users.index, api.v1.users.show, etc.
 *
 * @example
 * // Only register specific actions
 * resource('/photos', PhotoController, { only: ['index', 'show'] })
 *
 * @example
 * // Exclude specific actions
 * resource('/photos', PhotoController, { except: ['destroy'] })
 *
 * @example
 * // Custom resource name
 * resource('/photos', PhotoController, { name: 'pics' })
 * // Creates routes: pics.index, pics.show, etc.
 */
export function resource<
  const Path extends string,
  const ResourceName extends string = InferResourceName<Path>,
>(
  path: Path,
  controller: NoArgConstructor<ResourceController>,
  options?: ResourceOptions<ResourceName, Path>,
): Routes<ResourceRouteMap<ResourceName>> {
  const { name: customName, only, except, ...routeOptions } = options ?? {};

  // Derive resource name from path: '/photos' -> 'photos', '/admin/photos' -> 'admin.photos'
  const resourceName = (customName ?? path.replace(/^\//, "").replace(/\//g, ".")) as ResourceName;

  // Define all 7 actions with their HTTP methods and paths
  interface ActionDefinition {
    action: ResourceAction;
    method: string | readonly string[];
    path: string;
  }

  const allActions: ActionDefinition[] = [
    { action: "index", method: "GET", path },
    { action: "create", method: "GET", path: `${path}/create` },
    { action: "store", method: "POST", path },
    { action: "show", method: "GET", path: `${path}/{id}` },
    { action: "edit", method: "GET", path: `${path}/{id}/edit` },
    { action: "update", method: ["PUT", "PATCH"], path: `${path}/{id}` },
    { action: "destroy", method: "DELETE", path: `${path}/{id}` },
  ];

  // Filter actions based on only/except
  const actions = filterResourceActions(allActions, only, except);

  // Create routes for each action - collect as Routes<> for group()
  const routesList: Routes<Record<string, string>>[] = actions.map(
    ({ action, method, path: routePath }) => {
      const routeName = `${resourceName}.${action}` as const;
      return createRoute(method, routePath as Path, controller, {
        ...routeOptions,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic route names require type workaround
        name: routeName as any,
      });
    },
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic resource routes require type assertion
  return group(routesList) as any as Routes<ResourceRouteMap<ResourceName>>;
}

/**
 * Register API resource routes (excludes create and edit actions).
 *
 * Creates routes for API-focused resource actions:
 * - GET /resource -> index
 * - POST /resource -> store
 * - GET /resource/{id} -> show
 * - PUT/PATCH /resource/{id} -> update
 * - DELETE /resource/{id} -> destroy
 *
 * @param path - The resource path (e.g., '/api/photos')
 * @param controller - A ResourceController subclass
 * @param options - Options for filtering and configuring routes
 *
 * @example
 * apiResource('/api/photos', PhotoApiController)
 * // Creates only API routes (no create/edit forms)
 */
export function apiResource<
  const Path extends string,
  const ResourceName extends string = InferResourceName<Path>,
>(
  path: Path,
  controller: NoArgConstructor<ResourceController>,
  options?: ResourceOptions<ResourceName, Path>,
): Routes<ApiResourceRouteMap<ResourceName>> {
  const apiActions: readonly ResourceAction[] = ["index", "store", "show", "update", "destroy"];

  return resource(path, controller, {
    ...options,
    only: options?.only ?? apiActions,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- API resource routes require type assertion
  }) as any as Routes<ApiResourceRouteMap<ResourceName>>;
}

/**
 * Filter resource actions based on only/except options.
 * If only is specified, subtract except from only.
 */
function filterResourceActions<T extends { action: ResourceAction }>(
  actions: readonly T[],
  only?: readonly ResourceAction[],
  except?: readonly ResourceAction[],
): T[] {
  let filtered = [...actions];

  if (only) {
    // If only is specified, start with only those actions
    const onlySet = new Set(only);
    filtered = filtered.filter((a) => onlySet.has(a.action));
  }

  if (except) {
    // Remove actions in except list
    const exceptSet = new Set(except);
    filtered = filtered.filter((a) => !exceptSet.has(a.action));
  }

  return filtered;
}
