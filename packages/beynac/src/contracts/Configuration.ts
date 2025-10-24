import type { TypeToken } from "../container/container-key";
import { createTypeToken } from "../container/container-key";
import type { Routes } from "../router";
import type { MiddlewareReference } from "../router/Middleware";
import type { MiddlewarePriorityBuilder } from "../router/MiddlewarePriorityBuilder";

export interface Configuration<RouteParams extends Record<string, string> = {}> {
  /**
   * Enable development mode.
   *
   * WARNING! This is insecure, reveals sensitive information, is slower, and
   * leaks memory. Never enable it in production. Among the effects are:
   * disabling secure cookies and required HTTPS, providing detailed error
   * messages in the browser that may contain sensitive information, and
   * retaining log messages in memory.
   *
   * @default false
   */
  development?: boolean | undefined;

  /**
   * Route definitions for the application
   */
  routes?: Routes<RouteParams>;

  /**
   * Configure middleware execution priority.
   *
   * Middleware in the priority list will be moved to the front of the
   * middleware list and execute in the specified order, regardless of the order
   * they're assigned to routes.
   *
   * Can be:
   * - An array of middleware classes (replaces default priority)
   * - A function that receives a builder to modify the default priority
   *
   * @example
   * // Replace default priority
   * middlewarePriority: [Auth, RateLimit, Logger]
   *
   * @example
   * // Modify default priority
   * middlewarePriority: (builder) => {
   *   builder.addBefore(SetupTenant, Auth);
   *   builder.addAfter(CustomLogger, Session);
   *   builder.remove(DefaultRateLimit);
   * }
   */
  middlewarePriority?: MiddlewareReference[] | ((builder: MiddlewarePriorityBuilder) => void);

  /**
   * Development mode options
   */
  devMode?: {
    /**
     * Suppress automatic page refresh in development mode
     */
    suppressAutoRefresh?: boolean;

    /**
     * List of absolute file paths to folders to watch for changes. If undefined, `process.cwd()` will be used
     */
    autoRefreshPaths?: string[];

    /**
     * Regular expression to match against the full paths of any changed files
     * in `autoRefreshPaths`
     *
     * @default /\bbeynac\b/i
     */
    autoRefreshPathPattern?: RegExp;

    /**
     * To avoid reloading while files are still being written, auto-refresh will
     * wait until this number of milliseconds before reloading the page.
     *
     * @default 300
     */
    autoRefreshDebounceMs?: number;

    /**
     * How often to send heartbeat messages over the SSE connection to keep it alive
     * through proxies and load balancers
     *
     * @default 15000 (15 seconds)
     */
    autoRefreshHeartbeatMs?: number;
  };

  /**
   * Control when to throw errors on accessing non-existent route parameters.
   *
   * - 'always': Always throw when accessing invalid parameters
   * - 'never': Never throw, return undefined (production-like behavior)
   * - 'development': Throw only when development mode is enabled
   *
   * @default 'development'
   */
  throwOnInvalidParamAccess?: "always" | "never" | "development" | undefined;
}

export const Configuration: TypeToken<Configuration> =
  createTypeToken<Configuration>("Configuration");
