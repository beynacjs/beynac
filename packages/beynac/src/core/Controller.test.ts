import { describe, expect, test } from "bun:test";
import type { Controller } from "./Controller";

describe("Controller", () => {
  test("controller interface can be implemented by classes", async () => {
    class MyController implements Controller {
      handle(_request: Request, _params: Record<string, string>): Response {
        return new Response("OK");
      }
    }

    const controller = new MyController();
    const result = controller.handle(new Request("http://test.com"), {});
    expect(await result.text()).toBe("OK");
  });

  test("controller interface can be satisfied by object literals", async () => {
    const controller: Controller = {
      handle(_request: Request, _params: Record<string, string>): Response {
        return new Response("OK");
      },
    };

    const result = await controller.handle(new Request("http://test.com"), {});
    expect(await result.text()).toBe("OK");
  });

  test("controller can return Promise<Response>", async () => {
    class AsyncController implements Controller {
      async handle(_request: Request, _params: Record<string, string>): Promise<Response> {
        await Promise.resolve();
        return new Response("Async OK");
      }
    }

    const controller = new AsyncController();
    const result = await controller.handle(new Request("http://test.com"), {});
    expect(await result.text()).toBe("Async OK");
  });

  test("controller can return synchronous Response", async () => {
    const controller: Controller = {
      handle(_request: Request, _params: Record<string, string>): Response {
        return new Response("Sync OK");
      },
    };

    const result = await controller.handle(new Request("http://test.com"), {});
    // Should work with both sync and async
    expect(await result.text()).toBe("Sync OK");
  });
});
