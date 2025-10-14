import { Router } from "../contracts";

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
}
