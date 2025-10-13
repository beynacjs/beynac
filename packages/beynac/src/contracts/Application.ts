import { Container } from "../container";
import type { Key } from "../keys";
import { createKey } from "../keys";

/**
 * Application contract for handling HTTP requests
 */
export interface Application extends Container {
  /**
   * Handle an incoming HTTP request
   */
  handleRequest(request: Request): Promise<Response>;

  // withBeynac(context: RequestContext): Response;
}

export const Application: Key<Application | undefined> = createKey<Application>({
  displayName: "Application",
});
