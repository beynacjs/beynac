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

  onlyCallArg(method: string): ControllerContext {
    const { calls } = this.handle.mock;
    if (calls.length !== 1) {
      throw new Error(
        `handle(ctx) was called ${calls.length} times, ${method} can only be used if the handler is called exactly once`,
      );
    }
    return this.handle.mock.calls[0][0];
  }

  get params(): Record<string, string> {
    return this.onlyCallArg("params").params;
  }

  get request(): Record<string, string> {
    return this.onlyCallArg("request").params;
  }
}

export const controller = (response?: Response | (() => Response)): MockController =>
  new MockController(response);
