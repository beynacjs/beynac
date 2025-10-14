import { Router } from ".";
import type { Key } from "../keys";
import { createKey } from "../keys";

export interface Configuration {
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
   * A function that registers routes
   */
  routes?: (route: Router) => void;

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
}

export const Configuration: Key<Configuration> = createKey<Configuration>({
  displayName: "Configuration",
  default: {},
});
