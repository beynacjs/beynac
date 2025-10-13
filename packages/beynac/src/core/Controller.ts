/**
 * Interface for route controllers.
 * Controllers handle HTTP requests and return responses.
 */
export interface Controller<Params extends Record<string, string> = Record<string, string>> {
  /**
   * Handle an HTTP request and return a response.
   * This method is called by the framework when a route matches.
   *
   * @param request - The incoming HTTP request
   * @param routeParams - Parameters extracted from the route path
   * @returns Response object or Promise resolving to Response
   */
  handle(request: Request, routeParams: Params): Response | Promise<Response>;
}
