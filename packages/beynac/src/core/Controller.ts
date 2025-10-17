/**
 * Context passed to controller handlers.
 * Contains the HTTP request and route parameters.
 */
export interface ControllerContext {
  /** The incoming HTTP request */
  request: Request;
  /** Parameters extracted from the route path */
  params: Record<string, string>;

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
