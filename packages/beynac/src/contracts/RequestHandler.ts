import type { Key } from "../keys";
import { createKey } from "../keys";

/**
 * Request handler contract for processing HTTP requests
 */
export interface RequestHandler {
  /**
   * Handle an HTTP request and return a response
   */
  handle(request: Request): Promise<Response>;
}

export const RequestHandler: Key<RequestHandler | undefined> = createKey<RequestHandler>({
  displayName: "RequestHandler",
});
