import { describe, expect, mock, spyOn, test } from "bun:test";
import type { DevModeAutoRefreshMiddleware } from "./DevModeAutoRefreshMiddleware";
import { DevModeWatchService } from "./DevModeWatchService";

describe(DevModeWatchService, () => {
  test("singleton replacement destroys old instance", () => {
    // Clean up any existing global instance
    if (globalThis.__beynacWatchService) {
      globalThis.__beynacWatchService.destroy();
    }

    const config = {
      development: true,
    };

    // Create mock middleware
    const mockMiddleware = {
      triggerReload: mock(() => {}),
      destroy: mock(() => {}),
    } as unknown as DevModeAutoRefreshMiddleware;

    // Create first instance
    const firstInstance = new DevModeWatchService(config, mockMiddleware);
    const destroySpy = spyOn(firstInstance, "destroy");

    // Create second instance
    const secondInstance = new DevModeWatchService(config, mockMiddleware);

    // Verify old instance was destroyed
    expect(destroySpy).toHaveBeenCalledTimes(1);

    // Verify new instance is the global one
    expect(globalThis.__beynacWatchService).toBe(secondInstance);

    // Clean up
    secondInstance.destroy();
  });
});
