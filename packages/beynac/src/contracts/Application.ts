import type { Container } from "../container";
import type { TypeToken } from "../container/type-token";
import { createTypeToken } from "../container/type-token";
import type { Dispatcher } from "./Dispatcher";
import { RequestContext } from "./RequestContext";

/**
 * Application contract for handling HTTP requests
 */
export interface Application {
  /**
   * Public container for dependency injection
   */
  container: Container;

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

  /**
   * Accessor for the event dispatcher
   */
  readonly events: Dispatcher;
}

export const Application: TypeToken<Application> = createTypeToken<Application>("Application");
