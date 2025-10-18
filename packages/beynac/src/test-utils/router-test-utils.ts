import { Mock, mock } from "bun:test";
import { Controller, ControllerContext } from "../core/Controller";
import type { Middleware } from "../core/Middleware";

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

interface MockMiddlewareFunction {
  (name: string, logBeforeAfter?: boolean): new () => Middleware;
  log: string[];
  reset(): void;
}

/**
 * Create a mock middleware class for testing.
 *
 * The returned function creates middleware classes that log their name when executed.
 * Access the execution log via `mockMiddleware.log` and reset it via `mockMiddleware.reset()`.
 *
 * @example
 * const M1 = mockMiddleware("M1");
 * router.register(get("/test", controller, { middleware: M1 }));
 * await handle("/test");
 * expect(mockMiddleware.log).toEqual(["M1"]);
 *
 * @example
 * // Log before and after middleware execution
 * const M = mockMiddleware("M", true);
 * // Logs: ["M:before", "M:after"]
 */
export const mockMiddleware: MockMiddlewareFunction = Object.assign(
  (name: string, logBeforeAfter = false) => {
    class MockMiddleware implements Middleware {
      async handle(
        ctx: ControllerContext,
        next: (ctx: ControllerContext) => Response | Promise<Response>,
      ): Promise<Response> {
        if (logBeforeAfter) {
          mockMiddleware.log.push(`${name}:before`);
        } else {
          mockMiddleware.log.push(name);
        }
        const result = await next(ctx);
        if (logBeforeAfter) {
          mockMiddleware.log.push(`${name}:after`);
        }
        return result;
      }
    }
    return MockMiddleware;
  },
  {
    log: [] as string[],
    reset() {
      this.log.length = 0;
    },
  },
);
