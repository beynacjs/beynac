import { describe, expect, test } from "bun:test";
import type { Controller } from "./Controller";

describe("Controller", () => {
  test("controller interface can be implemented by classes", async () => {
    class MyController implements Controller {
      handle({ request }: { request: Request; params: Record<string, string> }): Response {
        return new Response(`URL: ${request.url}`);
      }
    }

    const controller = new MyController();
    const result = controller.handle({ request: new Request("http://test.com"), params: {} });
    expect(await result.text()).toBe("URL: http://test.com/");
  });

  test("controller interface can be satisfied by object literals", async () => {
    const controller: Controller = {
      handle({ params }: { request: Request; params: Record<string, string> }): Response {
        return new Response(`Params: ${JSON.stringify(params)}`);
      },
    };

    const result = await controller.handle({
      request: new Request("http://test.com"),
      params: { id: "123" },
    });
    expect(await result.text()).toBe('Params: {"id":"123"}');
  });

  test("controller can return Promise<Response>", async () => {
    class AsyncController implements Controller {
      async handle({
        request,
      }: {
        request: Request;
        params: Record<string, string>;
      }): Promise<Response> {
        await Promise.resolve();
        return new Response(`Async: ${request.url}`);
      }
    }

    const controller = new AsyncController();
    const result = await controller.handle({ request: new Request("http://test.com"), params: {} });
    expect(await result.text()).toBe("Async: http://test.com/");
  });

  test("controller can return synchronous Response", async () => {
    const controller: Controller = {
      handle({ request, params }: { request: Request; params: Record<string, string> }): Response {
        return new Response(`Sync: ${request.url} ${JSON.stringify(params)}`);
      },
    };

    const result = await controller.handle({ request: new Request("http://test.com"), params: {} });
    // Should work with both sync and async
    expect(await result.text()).toBe("Sync: http://test.com/ {}");
  });
});
