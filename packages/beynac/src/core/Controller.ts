/**
 * Interface for route controllers.
 * Controllers handle HTTP requests and return responses.
 *
 * @template Params - Union of parameter names (e.g., "id" | "postId"), defaults to string for any params
 */
export interface Controller<Params extends string = string> {
  /**
   * Handle an HTTP request and return a response.
   * This method is called by the framework when a route matches.
   *
   * @param request - The incoming HTTP request
   * @param routeParams - Parameters extracted from the route path as a record
   * @returns Response object or Promise resolving to Response
   */
  handle(request: Request, routeParams: Record<Params, string>): Response | Promise<Response>;
}
