import { Application } from "./contracts";
import { Configuration } from "./contracts/Configuration";
import { ApplicationImpl } from "./core/ApplicationImpl";
import { setFacadeApplication } from "./core/facade";

export const createApplication = <RouteParams extends Record<string, string> = {}>(
  config: Configuration<RouteParams> = {},
): Application<RouteParams> => {
  const app = new ApplicationImpl<RouteParams>(config);
  setFacadeApplication(app);
  app.bootstrap();
  return app;
};
