import type { Key } from "../keys";
import { createKey } from "../keys";

/**
 * Application contract for handling HTTP requests
 */
export interface Application {
  /**
   * Handle an incoming HTTP request
   */
  handleRequest(request: Request): Promise<Response>;
}

export const Application: Key<Application | undefined> = createKey<Application>({
  displayName: "Application",
});
