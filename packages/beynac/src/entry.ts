import { Application } from "./contracts";
import { Configuration } from "./contracts/Configuration";
import { ApplicationImpl } from "./core/ApplicationImpl";
import { setFacadeApplication } from "./core/facade";

export const createApplication = (config: Configuration = {}): Application => {
  const app = new ApplicationImpl(config);
  setFacadeApplication(app);
  app.bootstrap();
  return app;
};
