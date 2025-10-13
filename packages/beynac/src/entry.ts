import { Application } from "./contracts";
import { ApplicationImpl } from "./core/ApplicationImpl";
import { setFacadeApplication } from "./core/facade";

export const createApplication = (_config: Configuration = {}): Application => {
  const app = new ApplicationImpl();
  setFacadeApplication(app);
  return app;
};

interface Configuration {
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
}
