/**
 * Context passed to controller handlers.
 * Contains the HTTP request and route parameters.
 */
export interface ControllerContext {
  /**
   * The incoming HTTP request
   */
  request: Request;

  /**
   * Parameters extracted from the route path. These are url-decoded, so
   *
   * - route: `get(/search/{...query})`
   * - request: /search/my%20query%20%2F%20request
   * - params: {query: "my query / request"}
   */
  params: Record<string, string>;

  /**
   * Parameters extracted from the route path. These are url-decoded, so
   *
   * - route: `get(/search/{...query})`
   * - request: /search/my%20query%20%2F%20request
   * - params: {query: "my%20query%20%2F%20request"}
   */
  rawParams: Record<string, string>;

  url: URL;
}

export type MiddlewareNext = (ctx: ControllerContext) => Response | Promise<Response>;

/**
 * Interface for route controllers.
 * Controllers handle HTTP requests and return responses.
 */
export interface Controller {
  /**
   * Handle an HTTP request and return a response.
   * This method is called by the framework when a route matches.
   *
   * @param ctx - Controller context containing request and route parameters
   * @returns Response object or Promise resolving to Response
   */
  handle(ctx: ControllerContext): Response | Promise<Response>;
}
