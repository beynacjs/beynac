import { createTypeToken, TypeToken } from "../container/container-key";
import type { Component } from "../view/Component";
import { Controller, type ControllerContext } from "./Controller";
import type { MiddlewareReference } from "./Middleware";
import type { MiddlewareSet } from "./MiddlewareSet";
import type { ApiResourceAction, ResourceAction } from "./ResourceController";

/**
 * A collection of route definitions, returned by route creation functions like
 * get(), post(), group(), etc. This type includes type information about route
 * names and their parameters, enabling type-safe URL generation.
 *
 * The generic parameter `Params` is a map of route names to their parameter
 * names, used for type-safe URL generation with RouteUrlGenerator.url().
 *
 * @example
 * // Single route with no parameters
 * const routes = get('/dashboard', DashboardController, { name: 'dashboard' })
 * // routes is Routes<{ dashboard: never }>
 *
 * @example
 * // Single route with parameters
 * const routes = get('/users/{id}', UserController, { name: 'users.show' })
 * // routes is Routes<{ 'users.show': 'id' }>
 *
 * @example
 * // Multiple routes combined
 * const routes = group([
 *   get('/users', UsersController, { name: 'users.index' }),
 *   get('/users/{id}', UserController, { name: 'users.show' }),
 * ])
 * // routes is Routes<{ 'users.index': never, 'users.show': 'id' }>
 */
export type Routes<Params extends Record<string, string> = {}> = readonly RouteDefinition[] & {
	readonly __nameParamsMap?: Params; // Phantom type for type inference
};

export type Status = number | "4xx" | "5xx";

export type StatusPageComponent = Component<{
	status: number;
	statusText?: string | undefined;
	error?: Error | undefined;
}>;

/**
 * Base options shared by both routes and groups
 */
interface BaseRouteOptions<PathPart extends string> {
	/**
	 * A middleware class or array of classes
	 */
	middleware?: MiddlewareReference | MiddlewareReference[] | undefined;

	/**
	 * Remove middleware that was added in this or a parent group.
	 * Use "all" to remove all parent middleware.
	 */
	withoutMiddleware?: MiddlewareReference | MiddlewareReference[] | "all" | undefined;

	/**
	 * Domain pattern constraint, e.g. "api.example.com". Can contain patterns
	 * capture a parameter e.g. "{customer}.example.com"
	 */
	domain?: string | undefined;

	/**
	 * Define a required format for parameters. If the route matches but the
	 * parameter does not have the correct format, a 404 response will be sent.
	 * This uses typescript validation, you can only validate params added in the
	 * same route or group.
	 *
	 * @example
	 * get(/user/{id}, UserController, {where: {id: 'uuid'}})
	 */
	where?: Partial<Record<ExtractRouteParams<PathPart>, ParamConstraint>> | undefined;

	/**
	 * Define a required format for parameters. This is like `where`, but can
	 * apply to parameters defined anywhere.
	 *
	 * If the route matches but the parameter does not have the correct format, a
	 * 404 response will be sent. This uses typescript validation, you can only
	 * validate params added in the same route or group.
	 *
	 * @example
	 * // require that all `id` parameters in child routes are UUIDs
	 * group({where: {id: 'uuid'}}, [
	 *    ... define child routes...
	 * ])
	 */
	parameterPatterns?: Record<string, ParamConstraint> | undefined;

	/**
	 * Metadata to pass to the controller. This can be any additional data
	 * that you want to make available to the controller that isn't part of
	 * the URL parameters. In groups, meta is merged with child meta overriding
	 * parent meta.
	 *
	 * @example
	 * get('/users', UserController, { meta: { action: 'list' } })
	 */
	meta?: Record<string, unknown> | undefined;

	/**
	 * Custom error page components to render for specific HTTP status codes.
	 *
	 * Status codes can be:
	 * - Exact numbers (400-599): e.g. 404, 500
	 * - Either '4xx' or '5xx' to handle any number in that range
	 */
	statusPages?: StatusPages | undefined;
}

/**
 * Options for individual routes defined in e.g. get(), post() etc
 */
export interface RouteOptions<Name extends string, Path extends string>
	extends BaseRouteOptions<Path> {
	/**
	 * Route name for URL generation
	 *
	 * @example
	 * get('/user/{id}', UserController, {name: 'users.show'})
	 * // later
	 * app.url('users.show', {id: '123'}); // returns 'https://example.com/user/123'
	 */
	name?: Name | undefined;
}

/**
 * Options for route groups, which allow you to apply shared configuration to
 * multiple routes at once.
 */
export interface RouteGroupOptions<NamePrefix extends string = "", PathPrefix extends string = "">
	extends BaseRouteOptions<PathPrefix> {
	/**
	 * Path prefix for all routes in the group. The prefix will be prepended to
	 * all route paths.
	 *
	 * @example
	 * group({ prefix: '/api/v1' }, [
	 *   get('/users', UsersController), // matches '/api/v1/users'
	 * ])
	 */
	prefix?: PathPrefix | undefined;

	/**
	 * Name prefix for all routes in the group. The prefix will be prepended to
	 * all route names, allowing you to organize routes hierarchically.
	 *
	 * @example
	 * group({ namePrefix: 'admin.' }, [
	 *   get('/dashboard', DashboardController, { name: 'dashboard' }), // name: 'admin.dashboard'
	 *   get('/users', UsersController, { name: 'users' }), // name: 'admin.users'
	 * ])
	 */
	namePrefix?: NamePrefix | undefined;
}

export type ParamsObject<U extends string> = Prettify<Record<U, string | number>>;

export type BuiltInRouteConstraint = "numeric" | "alphanumeric" | "uuid" | "ulid";

export type ParamConstraint = BuiltInRouteConstraint | RegExp | ((value: string) => boolean);

export type ParamConstraints = Record<string, ParamConstraint | undefined>;

export type StatusPages = Partial<Record<Status, StatusPageComponent>>;

export interface RouteDefinition {
	methods: readonly string[];
	path: string;
	controller: Controller;
	routeName?: string | undefined;
	middleware: MiddlewareSet | null;
	constraints: ParamConstraints | null;
	globalConstraints: ParamConstraints | null;
	domainPattern?: string | undefined;
	meta: Record<string, unknown> | null;
	statusPages: StatusPages | null;
}

export const CurrentRouteDefinition: TypeToken<RouteDefinition> =
	createTypeToken("CurrentRouteDefinition");

/**
 * The current controller context, available during request handling.
 * Contains the Request object, params, URL, and metadata.
 */
export const CurrentControllerContext: TypeToken<ControllerContext> = createTypeToken(
	"CurrentControllerContext",
);

/**
 * A matched route with its request, URL and parameters.
 * Returned by Router.lookup() and passed to RequestHandler.handle()
 */
export interface RouteWithParams {
	route: RouteDefinition;
	request: Request;
	url: URL;
	params: Record<string, string>;
}

/**
 * Extract parameter names from a path pattern
 * "/users/{id}/{...rest}" -> "id" | "rest"
 */
export type ExtractRouteParams<T extends string> =
	T extends `${infer Before}{${infer Param}}${infer After}`
		? Param extends `...${infer WildcardParam}`
			? WildcardParam | ExtractRouteParams<`${Before}${After}`>
			: Param | ExtractRouteParams<`${Before}${After}`>
		: never;

export type ExtractDomainAndPathParams<
	Domain extends string | undefined,
	Path extends string,
> = Domain extends string
	? ExtractRouteParams<Domain> | ExtractRouteParams<Path>
	: ExtractRouteParams<Path>;

/**
 * Flatten intersection types and force IDE to display expanded form
 * { a: never } & { b: "id" } -> { a: never; b: "id" }
 */
export type Prettify<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;

/**
 * Merge an array of Routes via intersection, then prettify
 */
export type MergeChildren<Children extends readonly unknown[]> = Prettify<
	Children extends readonly [infer First, ...infer Rest]
		? ExtractMap<First> & MergeChildren<Rest>
		: {}
>;

type ExtractMap<T> = T extends Routes<infer Map> ? Map : {};

export type AddPrefixParams<Map extends Record<string, string>, PrefixParams extends string> = {
	[K in keyof Map]: Map[K] extends never ? PrefixParams : Map[K] | PrefixParams;
};

/**
 * Prepend a name prefix to all keys in a map
 * { "show": "id" } + "users." -> { "users.show": "id" }
 */
export type PrependPrefixToKeys<
	Map extends Record<string, string>,
	Prefix extends string,
> = Prettify<{
	[K in keyof Map as K extends string ? `${Prefix}${K}` : never]: Map[K];
}>;

// oxlint-disable-next-line no-explicit-any -- `any` was the only way I could get type checking to work here
export type GroupChildren = readonly Routes<any>[];

export type GroupedRoutes<
	Children extends GroupChildren,
	NamePrefix extends string = "",
	PathPrefix extends string = "",
> = Routes<
	PrependPrefixToKeys<
		ExtractRouteParams<PathPrefix> extends never
			? MergeChildren<Children>
			: AddPrefixParams<MergeChildren<Children>, ExtractRouteParams<PathPrefix>>,
		NamePrefix
	>
>;

type ReplaceAll<
	S extends string,
	From extends string,
	To extends string,
> = S extends `${infer L}${From}${infer R}` ? `${L}${To}${ReplaceAll<R, From, To>}` : S;

export type InferResourceName<Path extends string> = Path extends `/${infer Name}`
	? ReplaceAll<Name, "/", ".">
	: ReplaceAll<Path, "/", ".">;

type ApiResourceRoutes = {
	index: never;
	store: never;
	show: "resourceId";
	update: "resourceId";
	destroy: "resourceId";
};

type ResourceRoutes = {
	index: never;
	create: never;
	store: never;
	show: "resourceId";
	edit: "resourceId";
	update: "resourceId";
	destroy: "resourceId";
};

type FilterRouteMap<
	RouteMap extends Record<string, string>,
	OnlyActions extends keyof RouteMap,
	ExceptActions extends keyof RouteMap,
> = Omit<Pick<RouteMap, OnlyActions>, ExceptActions>;

// Conditional type that filters routes based on only/except options
export type FilteredResourceRouteMap<
	ResourceName extends string,
	Only extends readonly ResourceAction[] | undefined,
	Except extends readonly ResourceAction[] | undefined,
> = PrependPrefixToKeys<
	FilterRouteMap<
		ResourceRoutes,
		Only extends readonly ResourceAction[] ? Only[number] : keyof ResourceRoutes,
		Except extends readonly ResourceAction[] ? Except[number] : never
	>,
	`${ResourceName}.`
>;

// Similar filtered type for API resources
export type FilteredApiResourceRouteMap<
	ResourceName extends string,
	Only extends readonly ApiResourceAction[] | undefined,
	Except extends readonly ApiResourceAction[] | undefined,
> = PrependPrefixToKeys<
	FilterRouteMap<
		ApiResourceRoutes,
		Only extends readonly ApiResourceAction[] ? Only[number] : keyof ApiResourceRoutes,
		Except extends readonly ApiResourceAction[] ? Except[number] : never
	>,
	`${ResourceName}.`
>;
