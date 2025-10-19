import { Mock, mock } from "bun:test";
import type { RequestContext } from "../contracts/RequestContext";
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

  get url(): URL | undefined {
    const { calls } = this.handle.mock;
    if (calls.length !== 1) {
      throw new Error(
        `handle(ctx) was called ${calls.length} times, mockController.url can only be used if the handler is called exactly once`,
      );
    }
    return calls[0][0].url;
  }

  get rawParams(): Record<string, string> {
    const { calls } = this.handle.mock;
    if (calls.length !== 1) {
      throw new Error(
        `handle(ctx) was called ${calls.length} times, mockController.rawParams can only be used if the handler is called exactly once`,
      );
    }
    return calls[0][0].rawParams;
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
  rawParams: {},
  url: new URL(request.url),
});

export const requestContext = (): RequestContext => ({
  context: "test",
  getCookie: () => null,
  getCookieNames: () => [],
  deleteCookie: null,
  setCookie: null,
  getRequestHeader: () => null,
  getRequestHeaderNames: () => [][Symbol.iterator](),
});

interface MockMiddlewareFunction {
  (name: string): new () => Middleware;
  log: string[];
  beforeAfterLog: string[];
  reset(): void;
}

/**
 * Create a mock middleware class for testing.
 *
 * The returned function creates middleware classes that log their name when executed.
 * Access the execution log via `mockMiddleware.log` or `mockMiddleware.beforeAfterLog`
 * and reset both via `mockMiddleware.reset()`.
 *
 * @example
 * const M1 = mockMiddleware("M1");
 * router.register(get("/test", controller, { middleware: M1 }));
 * await handle("/test");
 * expect(mockMiddleware.log).toEqual(["M1"]);
 *
 * @example
 * // Access before/after logs
 * const M = mockMiddleware("M");
 * // beforeAfterLog contains: ["M:before", "M:after"]
 * // log contains: ["M"]
 */
export const mockMiddleware: MockMiddlewareFunction = Object.assign(
  (name: string) => {
    // Validate that the name is a valid JavaScript identifier
    if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name)) {
      throw new Error(`mockMiddleware name must be a valid JavaScript identifier, got: ${name}`);
    }

    // Create a function that returns a class with the dynamic name.
    // eslint-disable-next-line @typescript-eslint/no-implied-eval -- Function constructor needed for dynamic class names
    const createClass = new Function(`
      return class ${name} {}
    `);

    // Call the function to get the class
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call -- Function constructor returns untyped value
    const ClassConstructor = createClass();

    // Add the handle method to the prototype
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- ClassConstructor type is unknown from Function constructor
    ClassConstructor.prototype.handle = async function (
      ctx: ControllerContext,
      next: (ctx: ControllerContext) => Response | Promise<Response>,
    ): Promise<Response> {
      mockMiddleware.log.push(name);
      mockMiddleware.beforeAfterLog.push(`${name}:before`);
      const result = await next(ctx);
      mockMiddleware.beforeAfterLog.push(`${name}:after`);
      return result;
    };

    return ClassConstructor as new () => Middleware;
  },
  {
    log: [] as string[],
    beforeAfterLog: [] as string[],
    reset() {
      this.log.length = 0;
      this.beforeAfterLog.length = 0;
    },
  },
);
