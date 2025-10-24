import type { JSX } from "../view/public-types";

/**
 * The return type for controllers.
 *
 * - Response: A standard HTTP response
 * - JSX.Element: A JSX element to be rendered as HTML
 * - null: empty response
 * - Promise of any of the above
 */
export type ControllerReturn =
  | Response
  | JSX.Element
  | null
  | Promise<Response | JSX.Element | null>;

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

  /**
   * Metadata associated with the route. This can contain any additional
   * data passed via the route definition's meta field.
   */
  meta: Record<string, any>; // oxlint-disable-line no-explicit-any -- deliberate choice of public api
}

/**
 * Base class for route controllers.
 */
export abstract class Controller {
  /**
   * Handle an HTTP request and return a response.
   *
   * This method is called when a route matches.
   */
  abstract handle(ctx: ControllerContext): ControllerReturn;
}
