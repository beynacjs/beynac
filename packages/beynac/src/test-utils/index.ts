export { asyncGate } from "./async-gate";
import { Mock, mock } from "bun:test";
import { Controller, ControllerContext } from "../core/Controller";

export class MockController implements Controller {
  handle: Mock<Controller["handle"]>;

  constructor(response?: Response | (() => Response)) {
    this.handle = mock(() => {
      if (typeof response === "function") return response();
      return response ?? new Response();
    });
  }

  get params(): Record<string, string> {
    const { calls } = this.handle.mock;
    if (calls.length !== 1) {
      throw new Error(
        `handle(ctx) was called ${calls.length} times, mockController.params can only be used if the handler is called exactly once, use allParams instead`,
      );
    }
    return calls[0][0].params;
  }

  get allParams(): Record<string, string>[] {
    return this.handle.mock.calls.map((call) => call[0].params);
  }
}

export const controller = (response?: Response | (() => Response)): MockController =>
  new MockController(response);

export const controllerContext = (
  request: Request = new Request("https://example.com/"),
): ControllerContext => ({
  request,
  params: {},
  url: new URL(request.url),
});
