import { Application } from "./contracts";
import { ApplicationImpl } from "./core/ApplicationImpl";
import { Configuration } from "./core/Configuration";
import { setFacadeApplication } from "./core/facade";

export const createApplication = (config: Configuration = {}): Application => {
  const app = new ApplicationImpl(config);
  setFacadeApplication(app);
  app.bootstrap();
  return app;
};
