import { expect, expectTypeOf, test } from "bun:test";
import { inject } from "../container";
import { Router } from "../contracts/Router";
import { createKey } from "../keys";
import { ApplicationImpl } from "./ApplicationImpl";
import { Controller } from "./Controller";
import { RouterImpl } from "./RouterImpl";

function createRouter() {
  const app = new ApplicationImpl();
  const router = new RouterImpl(app, {});
  return { router, app };
}

test("handles controller instance routes", async () => {
  const { router } = createRouter();
  router.get("/hello", {
    handle() {
      return new Response("Hello from controller");
    },
  });

  const request = new Request("http://example.com/hello");
  const response = await router.handle(request);

  expect(await response.text()).toBe("Hello from controller");
});

test("passes route params to handler", async () => {
  const { router } = createRouter();

  router.get("/user/:id", {
    handle(_req, params) {
      return new Response(`User ID: ${params.id}`);
    },
  });

  const request = new Request("http://example.com/user/123");
  const response = await router.handle(request);

  expect(await response.text()).toBe("User ID: 123");
});

test("type inference works for route params", () => {
  const { router } = createRouter();

  // Route with no params - params should be empty
  router.get("/hello", {
    handle(_req, params): Response {
      expectTypeOf(params).toEqualTypeOf<{}>();
      return new Response();
    },
  });

  // Route with single param - params should have that param
  router.get("/user/:id", {
    handle(_req, params): Response {
      expectTypeOf(params).toEqualTypeOf<{ id: string }>();
      return new Response();
    },
  });

  // Route with multiple params - params should have all params
  router.get("/posts/:postId/comments/:commentId", {
    handle(_req, params): Response {
      expectTypeOf(params).toEqualTypeOf<{ postId: string; commentId: string }>();
      return new Response();
    },
  });
});

test("handles controller class routes", async () => {
  class TestController implements Controller {
    handle(_request: Request, _params: Record<string, string>): Response {
      return new Response("Hello from controller class");
    }
  }

  const { router } = createRouter();

  router.get("/hello", TestController);

  const request = new Request("http://example.com/hello");
  const response = await router.handle(request);

  expect(await response.text()).toBe("Hello from controller class");
});

test("class controller can use dependency injection", async () => {
  const { router, app } = createRouter();

  const messageKey = createKey<string>();

  class InjectedController implements Controller {
    constructor(private message = inject(messageKey)) {}

    handle(): Response {
      return new Response(this.message);
    }
  }

  app.bind(messageKey, { instance: "injected" });
  router.get("/hello", InjectedController);

  const response = await router.handle(new Request("http://example.com/hello"));

  expect(await response.text()).toBe("injected");
});

test("supports all HTTP methods", async () => {
  const { router } = createRouter();
  const methods = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"] as const;

  router
    .get("/test", {
      handle() {
        return new Response("GET");
      },
    })
    .post("/test", {
      handle() {
        return new Response("POST");
      },
    })
    .put("/test", {
      handle() {
        return new Response("PUT");
      },
    })
    .delete("/test", {
      handle() {
        return new Response("DELETE");
      },
    })
    .patch("/test", {
      handle() {
        return new Response("PATCH");
      },
    })
    .options("/test", {
      handle() {
        return new Response("OPTIONS");
      },
    });

  for (const method of methods) {
    const request = new Request("http://example.com/test", { method });
    const response = await router.handle(request);
    expect(await response.text()).toBe(method);
  }
});

test("returns 404 for unmatched route", async () => {
  const { router } = createRouter();

  router.get("/hello", {
    handle() {
      return new Response("Hello");
    },
  });

  const request = new Request("http://example.com/goodbye");
  const response = await router.handle(request);

  expect(response.status).toBe(404);
});

test("executes inline middleware", async () => {
  const { router } = createRouter();
  const log: string[] = [];

  router.middleware(
    {
      handle(request, next) {
        log.push("middleware:before");
        const response = next(request);
        log.push("middleware:after");
        return response;
      },
    },
    (router) => {
      router.get("/test", {
        handle() {
          log.push("handler");
          return new Response("OK");
        },
      });
    },
  );

  const request = new Request("http://example.com/test");
  const response = await router.handle(request);

  expect(await response.text()).toBe("OK");
  expect(log).toEqual(["middleware:before", "handler", "middleware:after"]);
});

test("executes nested middleware in correct order", async () => {
  const { router, app } = createRouter();
  const log: string[] = [];

  router.middleware(
    {
      handle(request, next) {
        log.push("outer:before");
        const response = next(request);
        log.push("outer:after");
        return response;
      },
    },
    (router) => {
      router.middleware(
        {
          handle(request, next) {
            log.push("inner:before");
            const response = next(request);
            log.push("inner:after");
            return response;
          },
        },
        (router) => {
          router.get("/test", {
            handle() {
              log.push("handler");
              return new Response("OK");
            },
          });
        },
      );
    },
  );

  app.bind(Router, { factory: () => router, lifecycle: "singleton" });

  await router.handle(new Request("http://example.com/test"));

  expect(log).toEqual(["outer:before", "inner:before", "handler", "inner:after", "outer:after"]);
});

test("middleware can short-circuit by not calling next", async () => {
  const { router, app } = createRouter();

  router.middleware(
    {
      handle(_request, _next) {
        return Promise.resolve(new Response("Blocked", { status: 403 }));
      },
    },
    (router) => {
      router.get("/test", {
        handle() {
          return new Response("Should not be called");
        },
      });
    },
  );

  app.bind(Router, { factory: () => router, lifecycle: "singleton" });

  const request = new Request("http://example.com/test");
  const response = await router.handle(request);

  expect(response.status).toBe(403);
  expect(await response.text()).toBe("Blocked");
});

test("middleware can modify request", async () => {
  const { router, app } = createRouter();

  router.middleware(
    {
      async handle(request, next) {
        // Create modified request with added header
        const headers = new Headers(request.headers);
        headers.set("X-Custom", "Modified");

        const modifiedRequest = new Request(request.url, {
          method: request.method,
          headers,
        });
        return next(modifiedRequest);
      },
    },
    (router) => {
      router.get("/test", {
        handle(req) {
          const customHeader = req.headers.get("X-Custom");
          return new Response(customHeader || "Not found");
        },
      });
    },
  );

  app.bind(Router, { factory: () => router, lifecycle: "singleton" });

  const request = new Request("http://example.com/test");
  const response = await router.handle(request);

  expect(await response.text()).toBe("Modified");
});

test("handles async controller", async () => {
  class AsyncController implements Controller {
    async handle(_request: Request, _params: Record<string, string>): Promise<Response> {
      await Promise.resolve();
      return new Response("Async response");
    }
  }

  const { router, app } = createRouter();

  router.get("/async", AsyncController);

  app.bind(Router, { factory: () => router, lifecycle: "singleton" });

  const request = new Request("http://example.com/async");
  const response = await router.handle(request);

  expect(await response.text()).toBe("Async response");
});

test("handles synchronous middleware", async () => {
  const { router, app } = createRouter();
  const log: string[] = [];

  router.middleware(
    {
      handle(request, next) {
        log.push("sync-middleware:before");
        const response = next(request);
        log.push("sync-middleware:after");
        return response;
      },
    },
    (router) => {
      router.get("/test", {
        handle() {
          log.push("handler");
          return new Response("OK");
        },
      });
    },
  );

  app.bind(Router, { factory: () => router, lifecycle: "singleton" });

  const request = new Request("http://example.com/test");
  const response = await router.handle(request);

  expect(await response.text()).toBe("OK");
  expect(log).toEqual(["sync-middleware:before", "handler", "sync-middleware:after"]);
});
