import type { Controller } from "../core/Controller";
import type { MiddlewareReference } from "../core/Middleware";
import type { Key } from "../keys";
import { createKey } from "../keys";
import type { NoArgConstructor } from "../utils";

/**
 * Extract parameter names from a route path
 * @example "/user/:id" -> "id"
 * @example "/posts/:postId/comments/:commentId" -> "postId" | "commentId"
 */
export type ExtractRouteParams<T extends string> =
  T extends `${infer _Start}:${infer Param}/${infer Rest}`
    ? Param | ExtractRouteParams<`/${Rest}`>
    : T extends `${infer _Start}:${infer Param}`
      ? Param
      : never;

/**
 * Convert extracted param names to a record type
 * @example "id" -> { id: string }
 * @example "postId" | "commentId" -> { postId: string; commentId: string }
 */
export type RouteParams<T extends string> =
  ExtractRouteParams<T> extends never
    ? Record<string, never>
    : Record<ExtractRouteParams<T>, string>;

/**
 * A route handler can be:
 * - A controller instance
 * - A controller class constructor
 *
 * @template Params - Union of parameter names (e.g., "id" | "postId"), defaults to string for any params
 */
export type RouteHandler<Params extends string = string> =
  | Controller<Params>
  | NoArgConstructor<Controller<Params>>;

/**
 * Handles registration and execution of routes
 */
export interface Router {
  /**
   * Register a GET request handler
   */
  get<Path extends string>(uri: Path, handler: RouteHandler<ExtractRouteParams<Path>>): Router;

  /**
   * Register a POST request handler
   */
  post<Path extends string>(uri: Path, handler: RouteHandler<ExtractRouteParams<Path>>): Router;

  /**
   * Register a PUT request handler
   */
  put<Path extends string>(uri: Path, handler: RouteHandler<ExtractRouteParams<Path>>): Router;

  /**
   * Register a DELETE request handler
   */
  delete<Path extends string>(uri: Path, handler: RouteHandler<ExtractRouteParams<Path>>): Router;

  /**
   * Register a PATCH request handler
   */
  patch<Path extends string>(uri: Path, handler: RouteHandler<ExtractRouteParams<Path>>): Router;

  /**
   * Register routes with middleware.
   *
   * The middleware will be applied to all routes registered within the
   * callback.
   *
   * Calls to middleware() can be nested.
   *
   * @param middleware - An object implementing the Middleware interface, a
   *                     class constructor that can produce such objects, or an
   *                     array of either of the above.
   *
   * @example
   * Route.middleware(MyMiddlewareClass, () => {
   *     Route.get("/path", MyControllerClass);
   * })
   */
  middleware(
    middleware: MiddlewareReference | MiddlewareReference[],
    callback: (router: Router) => void,
  ): void;

  /**
   * Handle an HTTP request by routing it to the appropriate handler.
   * Executes middleware pipeline and returns the response.
   *
   * @param request - The HTTP request to handle
   * @returns Promise resolving to the HTTP response
   */
  handle(request: Request): Promise<Response>;
}

export const Router: Key<Router | undefined> = createKey<Router>({
  displayName: "Router",
});
