import { Container } from "../container";
import type { Key } from "../keys";
import { createKey } from "../keys";
import { RequestContext } from "./RequestContext";

/**
 * Application contract for handling HTTP requests
 */
export interface Application extends Container {
  /**
   * Handle an incoming HTTP request. The request will be routed to the
   * appropriate handler and will go through the middleware pipeline.
   */
  handleRequest(request: Request, context: RequestContext): Promise<Response>;

  /**
   * Execute a callback in a context where request data is available.
   *
   * This enables Beynac features that require request data, like the `Cookies`
   * and `Headers` facades, and higher-level features like authentication that
   * require access to headers and cookies.
   */
  withRequestContext<R>(context: RequestContext, callback: () => R): R;
}

export const Application: Key<Application | undefined> = createKey<Application>({
  displayName: "Application",
});
