import { describe, expect, spyOn, test } from "bun:test";
import { DevModeAutoRefreshMiddleware } from "./DevModeAutoRefreshMiddleware";
import { DevModeWatchService } from "./DevModeWatchService";

describe(DevModeWatchService, () => {
  test("singleton replacement destroys old instance", () => {
    const config = {
      development: true,
    };

    const middleware = new DevModeAutoRefreshMiddleware(config);

    const firstInstance = new DevModeWatchService(config, middleware);
    firstInstance.start();
    const destroySpy = spyOn(firstInstance, "destroy");

    const secondInstance = new DevModeWatchService(config, middleware);
    secondInstance.start();

    expect(destroySpy).toHaveBeenCalledTimes(1);

    expect(globalThis.__beynacWatchService).toBe(secondInstance);

    secondInstance.destroy();
  });
});
