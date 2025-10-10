import { describe, expect, test } from "bun:test";
import { Dispatcher } from "../contracts/Dispatcher";
import { ApplicationImpl } from "./ApplicationImpl";
import { DispatcherImpl } from "./DispatcherImpl";

describe("ApplicationImpl", () => {
  test("events getter uses container resolution", () => {
    const app = new ApplicationImpl();
    // Bind dispatcher as singleton
    app.bind(Dispatcher, {
      factory: (container) => new DispatcherImpl(container),
      lifecycle: "singleton",
    });

    // Access through getter multiple times
    const events1 = app.events;
    const events2 = app.events;

    // Should be same instance (singleton)
    expect(events1).toBe(events2);
    expect(events1).toBeInstanceOf(DispatcherImpl);
  });
});
