import { beforeEach, describe, expect, expectTypeOf, mock, test } from "bun:test";
import { ContainerImpl } from "../container/ContainerImpl";
import { createTypeToken } from "../container/container-key";
import { Container } from "../contracts";
import type { Controller, ControllerContext } from "../core/Controller";
import type { Middleware } from "../core/Middleware";
import { MockController } from "../test-utils";
import {
  any,
  delete_,
  get,
  group,
  isIn,
  match,
  options,
  patch,
  post,
  put,
  redirect,
  Router,
  RouteRegistry,
  type Routes,
} from "./index";

let container: Container;
let router: Router;
let controller: MockController;

beforeEach(() => {
  container = new ContainerImpl();
  router = new Router(container);
  controller = new MockController();
});

const handle = async (url: string, method = "GET") => {
  if (url.startsWith("//")) {
    url = "https:" + url;
  } else if (url.startsWith("/")) {
    url = "https://example.com" + url;
  }
  return await router.handle(new Request(url, { method }));
};

// ============================================================================
// Basic Route Registration
// ============================================================================

test("handles basic GET route", async () => {
  router.register(get("/hello", controller));
  await handle("/hello");
  expect(controller.handle).toHaveBeenCalledTimes(1);
});

test("handles POST route", async () => {
  router.register(post("/submit", controller));
  await handle("/submit", "POST");
  expect(controller.handle).toHaveBeenCalledTimes(1);
});

test("handles PUT route", async () => {
  router.register(put("/update", controller));
  await handle("/update", "PUT");
  expect(controller.handle).toHaveBeenCalledTimes(1);
});

test("handles PATCH route", async () => {
  router.register(patch("/patch", controller));
  await handle("/patch", "PATCH");
  expect(controller.handle).toHaveBeenCalledTimes(1);
});

test("handles DELETE route", async () => {
  router.register(delete_("/delete", controller));
  await handle("/delete", "DELETE");
  expect(controller.handle).toHaveBeenCalledTimes(1);
});

test("handles OPTIONS route", async () => {
  router.register(options("/cors", controller));
  await handle("/cors", "OPTIONS");
  expect(controller.handle).toHaveBeenCalledTimes(1);
});

test("handles route parameters", async () => {
  router.register(get("/user/{id}", controller));
  await handle("/user/123");
  expect(controller.params).toEqual({ id: "123" });
});

test("handles route parameters starting with digits", async () => {
  router.register(get("/item/{0id}/detail/{1name}", controller));
  await handle("/item/abc123/detail/xyz789");
  expect(controller.params).toEqual({ "0id": "abc123", "1name": "xyz789" });
});

test("handles multiple route parameters", async () => {
  router.register(get("/posts/{postId}/comments/{commentId}", controller));
  await handle("/posts/42/comments/7");
  expect(controller.params).toEqual({ postId: "42", commentId: "7" });
});

test("returns 404 for unmatched route", async () => {
  router.register(get("/hello", controller));
  const response = await handle("/notfound");
  expect(response.status).toBe(404);
});

test("trailing slashes are ignored for matching", async () => {
  router.register(get("/users", controller));

  await handle("/users");
  expect(controller.handle).toHaveBeenCalledTimes(1);

  controller.handle.mockClear();

  await handle("/users/");
  expect(controller.handle).toHaveBeenCalledTimes(1);
});

test("route defined with trailing slash matches path without trailing slash", async () => {
  router.register(get("/posts/", controller));

  await handle("/posts/");
  expect(controller.handle).toHaveBeenCalledTimes(1);

  controller.handle.mockClear();

  await handle("/posts");
  expect(controller.handle).toHaveBeenCalledTimes(1);
});

test("handles controller class", async () => {
  class TestController implements Controller {
    handle(): Response {
      return new Response("From controller class");
    }
  }

  router.register(get("/test", TestController));

  const response = await handle("/test");
  expect(await response.text()).toBe("From controller class");
});

test("controller class can use dependency injection", async () => {
  const messageKey = createTypeToken<string>();
  container.bind(messageKey, { instance: "injected message" });

  class InjectedController implements Controller {
    constructor(private message: string = container.get(messageKey)) {}

    handle(): Response {
      return new Response(this.message);
    }
  }

  router.register(get("/hello", InjectedController));

  const response = await handle("/hello");
  expect(await response.text()).toBe("injected message");
});

test("handles async controller", async () => {
  router.register(get("/async", controller));
  await handle("/async");
  expect(controller.handle).toHaveBeenCalledTimes(1);
});

describe("middleware", () => {
  const mockMiddlewareClass = (name: string, logBeforeAfter = false) => {
    class MockMiddleware implements Middleware {
      async handle(
        ctx: ControllerContext,
        next: (ctx: ControllerContext) => Response | Promise<Response>,
      ): Promise<Response> {
        if (logBeforeAfter) {
          middlewareLog.push(`${name}:before`);
        } else {
          middlewareLog.push(name);
        }
        const result = await next(ctx);
        if (logBeforeAfter) {
          middlewareLog.push(`${name}:after`);
        }
        return result;
      }
    }
    return MockMiddleware;
  };

  let middlewareLog: string[] = [];
  beforeEach(() => {
    middlewareLog = [];
  });

  test("executes middleware with context", async () => {
    const handleMock = mock(
      (ctx: ControllerContext, next: (ctx: ControllerContext) => Response | Promise<Response>) => {
        expect(ctx.request).toBeInstanceOf(Request);
        expect(ctx.params).toEqual({ page: "foo" });
        return next(ctx);
      },
    );

    class TestMiddleware implements Middleware {
      handle(
        ctx: ControllerContext,
        next: (ctx: ControllerContext) => Response | Promise<Response>,
      ): Response | Promise<Response> {
        return handleMock(ctx, next);
      }
    }

    router.register(get("/test/{page}", controller, { name: "test", middleware: TestMiddleware }));

    await handle("/test/foo");
    expect(handleMock).toHaveBeenCalledTimes(1);
  });

  test("executes multiple middleware in correct order", async () => {
    const middleware0 = mockMiddlewareClass("m0", true);

    const middleware1 = mockMiddlewareClass("m1", true);

    const middleware2 = mockMiddlewareClass("m2", true);

    router.register(
      group({ middleware: middleware0 }, [
        get(
          "/test",
          {
            handle() {
              middlewareLog.push("handler");
              return new Response("OK");
            },
          },
          { middleware: [middleware1, middleware2] },
        ),
      ]),
    );

    await handle("/test");
    expect(middlewareLog).toEqual([
      "m0:before",
      "m1:before",
      "m2:before",
      "handler",
      "m2:after",
      "m1:after",
      "m0:after",
    ]);
  });

  test("withoutMiddleware works with classes", async () => {
    const M1 = mockMiddlewareClass("M1");
    const M2 = mockMiddlewareClass("M2");

    router.register(
      group(
        {
          middleware: [M1, M2],
        },
        [
          get("/test", controller, {
            withoutMiddleware: M1,
          }),
        ],
      ),
    );

    await handle("/test");
    expect(middlewareLog).toEqual(["M2"]);
  });

  test("withoutMiddleware works in nested groups", async () => {
    const M1 = mockMiddlewareClass("M1");
    const M2 = mockMiddlewareClass("M2");
    const M3 = mockMiddlewareClass("M3");

    const outerRoutes = group({ middleware: [M1, M2] }, [
      group({ withoutMiddleware: M1, middleware: M3 }, [get("/test", controller)]),
    ]);

    router.register(outerRoutes);
    await handle("/test");

    expect(middlewareLog).toEqual(["M2", "M3"]);
  });

  test("route middleware can re-add previously removed middleware", async () => {
    const M1 = mockMiddlewareClass("M1");
    const M2 = mockMiddlewareClass("M2");

    const innerRoutes = group({ withoutMiddleware: M1 }, [
      get("/test", controller, { middleware: M1 }),
    ]);
    const outerRoutes = group({ middleware: [M1, M2] }, [innerRoutes]);

    router.register(outerRoutes);
    await handle("/test");

    expect(middlewareLog).toEqual(["M2", "M1"]);
  });

  test("group with both middleware and withoutMiddleware for same middleware", async () => {
    const M1 = mockMiddlewareClass("M1");
    const M2 = mockMiddlewareClass("M2");

    const innerRoutes = group({ withoutMiddleware: M1, middleware: [M1, M2] }, [
      get("/test", controller),
    ]);
    const outerRoutes = group({ middleware: M1 }, [innerRoutes]);

    router.register(outerRoutes);
    await handle("/test");

    // At same level, withoutMiddleware wins - M1 is excluded
    expect(middlewareLog).toEqual(["M2"]);
  });

  test("route with both middleware and withoutMiddleware for same middleware", async () => {
    const M1 = mockMiddlewareClass("M1");
    const M2 = mockMiddlewareClass("M2");

    router.register(get("/test", controller, { middleware: [M1, M2], withoutMiddleware: M1 }));

    await handle("/test");

    // At same level, withoutMiddleware wins - M1 is excluded
    expect(middlewareLog).toEqual(["M2"]);
  });

  test("multiple withoutMiddleware at different levels", async () => {
    const M1 = mockMiddlewareClass("M1");
    const M2 = mockMiddlewareClass("M2");
    const M3 = mockMiddlewareClass("M3");
    const M4 = mockMiddlewareClass("M4");

    const innerRoutes = group({ withoutMiddleware: M1 }, [
      get("/test", controller, { withoutMiddleware: M2, middleware: M4 }),
    ]);
    const outerRoutes = group({ middleware: [M1, M2, M3] }, [innerRoutes]);

    router.register(outerRoutes);
    await handle("/test");

    expect(middlewareLog).toEqual(["M3", "M4"]);
  });

  test("withoutMiddleware with array of middleware", async () => {
    const M1 = mockMiddlewareClass("M1");
    const M2 = mockMiddlewareClass("M2");
    const M3 = mockMiddlewareClass("M3");

    const routes = group({ middleware: [M1, M2, M3] }, [
      get("/test", controller, { withoutMiddleware: [M1, M3] }),
    ]);

    router.register(routes);
    await handle("/test");

    expect(middlewareLog).toEqual(["M2"]);
  });

  test("middleware can short-circuit", async () => {
    class AuthMiddleware implements Middleware {
      handle(
        _ctx: ControllerContext,
        _next: (ctx: ControllerContext) => Response | Promise<Response>,
      ): Response {
        return new Response("Unauthorized");
      }
    }

    const route = get("/protected", controller, { middleware: AuthMiddleware });

    router.register(route);

    const response = await router.handle(new Request("http://example.com/protected"));
    expect(await response.text()).toBe("Unauthorized");
    expect(controller.handle).not.toHaveBeenCalled();
  });

  test("middleware can replace request", async () => {
    class ModifyRequestMiddleware implements Middleware {
      handle(
        ctx: ControllerContext,
        next: (ctx: ControllerContext) => Response | Promise<Response>,
      ): Response | Promise<Response> {
        const headers = new Headers(ctx.request.headers);
        headers.set("X-Custom", "Modified");
        const modifiedRequest = new Request(ctx.request.url, {
          method: ctx.request.method,
          headers,
        });
        const modifiedCtx = { ...ctx, request: modifiedRequest };
        return next(modifiedCtx);
      }
    }

    const route = get(
      "/test",
      {
        handle({ request }) {
          return new Response(request.headers.get("X-Custom") || "Not found");
        },
      },
      { middleware: ModifyRequestMiddleware },
    );

    router.register(route);

    const response = await router.handle(new Request("http://example.com/test"));
    expect(await response.text()).toBe("Modified");
  });

  test("applies middleware to all routes in group", async () => {
    const M = mockMiddlewareClass("group-middleware");

    const routes = group({ prefix: "/api", middleware: M }, [
      get("/v1", {
        handle() {
          middlewareLog.push("v1");
          return new Response("V1");
        },
      }),
      get("/v2", {
        handle() {
          middlewareLog.push("v2");
          return new Response("V2");
        },
      }),
    ]);

    router.register(routes);

    middlewareLog.length = 0;
    await router.handle(new Request("http://example.com/api/v1"));
    expect(middlewareLog).toEqual(["group-middleware", "v1"]);

    middlewareLog.length = 0;
    await router.handle(new Request("http://example.com/api/v2"));
    expect(middlewareLog).toEqual(["group-middleware", "v2"]);
  });
});

describe("route groups", () => {
  test("applies prefix to routes", async () => {
    const mc1 = new MockController();
    const mc2 = new MockController();
    const routes = group(
      {
        prefix: "/admin",
      },
      [get("/dashboard", mc1), get("/users", mc2)],
    );

    router.register(routes);

    await router.handle(new Request("http://example.com/admin/dashboard"));
    expect(mc1.handle).toHaveBeenCalledTimes(1);

    await router.handle(new Request("http://example.com/admin/users"));
    expect(mc2.handle).toHaveBeenCalledTimes(1);
  });

  test("applies domain to routes in group", async () => {
    router.register(group({ domain: "api.example.com" }, [get("/status", controller)]));

    await handle("//api.example.com/status");
    expect(controller.handle).toHaveBeenCalledTimes(1);

    const response2 = await handle("/status");
    expect(response2.status).toBe(404);
  });

  test("supports nested groups", async () => {
    const mc1 = new MockController();
    const mc2 = new MockController();
    const userRoutes = group({ prefix: "/users", namePrefix: "users." }, [
      get("/", mc1, { name: "index" }),
      get("/{id}", mc2, { name: "show" }),
    ]);

    const apiRoutes = group({ prefix: "/api", namePrefix: "api." }, [userRoutes]);

    router.register(apiRoutes);

    await router.handle(new Request("http://example.com/api/users/"));
    expect(mc1.handle).toHaveBeenCalledTimes(1);

    await router.handle(new Request("http://example.com/api/users/123"));
    expect(mc2.params).toEqual({ id: "123" });

    // Type check
    expectTypeOf(apiRoutes).toMatchTypeOf<
      Routes<{ "api.users.index": never; "api.users.show": "id" }>
    >();
  });
});

// ============================================================================
// Parameter Constraints
// ============================================================================

describe("parameter constraints", () => {
  test("constrained parameter always consumes route", async () => {
    router.register(
      group([
        get("/user/{numeric}", controller, { where: { numeric: "numeric" } }),
        get("/user/{any}", controller),
      ]),
    );

    const response = await handle("/user/abc");
    expect(response.status).toBe(404);
  });

  test("whereNumber constraint", async () => {
    router.register(get("/user/{id}", controller, { where: { id: "numeric" } }));

    await handle("/user/123");
    expect(controller.params).toEqual({ id: "123" });

    const response2 = await handle("/user/abc");
    expect(response2.status).toBe(404);
  });

  test("whereAlphaNumeric allows letters and numbers", async () => {
    router.register(get("/category/{slug}", controller, { where: { slug: "alphanumeric" } }));

    await handle("/category/news");
    expect(controller.params).toEqual({ slug: "news" });

    controller.handle.mockClear();
    await handle("/category/news123");
    expect(controller.params).toEqual({ slug: "news123" });

    const response3 = await handle("/category/news-123");
    expect(response3.status).toBe(404);
  });

  test("whereAlphaNumeric constraint", async () => {
    router.register(get("/post/{slug}", controller, { where: { slug: "alphanumeric" } }));

    await handle("/post/post123");
    expect(controller.params).toEqual({ slug: "post123" });

    const response2 = await handle("/post/post-123");
    expect(response2.status).toBe(404);
  });

  test("whereUuid constraint", async () => {
    router.register(get("/resource/{uuid}", controller, { where: { uuid: "uuid" } }));

    const validUuid = "550e8400-e29b-41d4-a716-446655440000";
    await handle(`/resource/${validUuid}`);
    expect(controller.params).toEqual({ uuid: validUuid });

    const response2 = await handle("/resource/not-a-uuid");
    expect(response2.status).toBe(404);
  });

  test("whereUlid constraint", async () => {
    router.register(get("/item/{ulid}", controller, { where: { ulid: "ulid" } }));

    const validUlid = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
    await handle(`/item/${validUlid}`);
    expect(controller.params).toEqual({ ulid: validUlid });

    const response2 = await handle("/item/not-a-ulid");
    expect(response2.status).toBe(404);
  });

  test("whereIn constraint", async () => {
    router.register(
      get("/status/{type}", controller, {
        where: { type: isIn(["active", "inactive", "pending"]) },
      }),
    );

    await handle("/status/active");
    expect(controller.params).toEqual({ type: "active" });

    const response2 = await handle("/status/deleted");
    expect(response2.status).toBe(404);
  });

  test("isIn handles regex special characters", async () => {
    router.register(
      get("/file/{ext}", controller, {
        where: { ext: isIn([".txt", ".md", "c++", "node.js", "[test]", "(group)"]) },
      }),
    );

    await handle("/file/.txt");
    expect(controller.params).toEqual({ ext: ".txt" });

    controller.handle.mockClear();
    await handle("/file/.md");
    expect(controller.params).toEqual({ ext: ".md" });

    controller.handle.mockClear();
    await handle("/file/c++");
    expect(controller.params).toEqual({ ext: "c++" });

    controller.handle.mockClear();
    await handle("/file/node.js");
    expect(controller.params).toEqual({ ext: "node.js" });

    controller.handle.mockClear();
    await handle("/file/[test]");
    expect(controller.params).toEqual({ ext: "[test]" });

    controller.handle.mockClear();
    await handle("/file/(group)");
    expect(controller.params).toEqual({ ext: "(group)" });

    // Should not match something that looks like it matches the regex pattern
    const response1 = await handle("/file/XXtxt"); // should not match .txt (. is literal)
    expect(response1.status).toBe(404);

    const response2 = await handle("/file/cXX"); // should not match c++ (+ is literal)
    expect(response2.status).toBe(404);

    const response3 = await handle("/file/test"); // should not match [test] (brackets are literal)
    expect(response3.status).toBe(404);
  });

  test("where with custom regex", async () => {
    router.register(get("/year/{year}", controller, { where: { year: /^(19|20)\d{2}$/ } }));

    await handle("/year/2024");
    expect(controller.params).toEqual({ year: "2024" });

    const response2 = await handle("/year/3024");
    expect(response2.status).toBe(404);
  });

  test("where with incorrect parameter", async () => {
    router.register(
      get("/year/{param}", controller, { where: { notParam: "alphanumeric" } as any }),
    );

    const response = await handle("/year/foo");
    expect(response.status).toBe(404);
  });

  test("multiple constraints on same route", async () => {
    router.register(
      get("/posts/{postId}/comments/{commentId}", controller, {
        where: { postId: "numeric", commentId: "numeric" },
      }),
    );

    await handle("/posts/123/comments/456");
    expect(controller.params).toEqual({ postId: "123", commentId: "456" });

    const response2 = await handle("/posts/abc/comments/456");
    expect(response2.status).toBe(404);
  });

  test("group-level constraints apply to all routes in group", async () => {
    const mc1 = new MockController();
    const mc2 = new MockController();

    router.register(
      group({ prefix: "/admin", where: { id: "numeric" } }, [
        get("/{id}", mc1),
        get("/{id}/edit", mc2),
      ]),
    );

    // First route should accept numeric id
    await handle("/admin/123");
    expect(mc1.params).toEqual({ id: "123" });

    // Second route should accept numeric id
    await handle("/admin/456/edit");
    expect(mc2.params).toEqual({ id: "456" });

    // First route should reject non-numeric id
    const response1 = await handle("/admin/abc");
    expect(response1.status).toBe(404);

    // Second route should reject non-numeric id
    const response2 = await handle("/admin/xyz/edit");
    expect(response2.status).toBe(404);
  });

  test("route-level constraints override group-level constraints", async () => {
    router.register(
      group({ where: { id: "numeric" } }, [
        get("/post/{id}", controller, { where: { id: "uuid" } }),
      ]),
    );

    // Should match uuid, not numeric (route overrides group)
    const validUuid = "550e8400-e29b-41d4-a716-446655440000";
    await handle(`/post/${validUuid}`);
    expect(controller.params).toEqual({ id: validUuid });

    // Should reject numeric (group constraint was overridden)
    const response = await handle("/post/123");
    expect(response.status).toBe(404);
  });
});

// ============================================================================
// Global Patterns
// ============================================================================

describe("global patterns", () => {
  test("globalPatterns validates matching parameters", async () => {
    const mc1 = new MockController();
    const mc2 = new MockController();

    router.register(
      group({ globalPatterns: { id: /^\d+$/ } }, [get("/user/{id}", mc1), get("/post/{id}", mc2)]),
    );

    await handle("/user/123");
    expect(mc1.params).toEqual({ id: "123" });

    const response2 = await handle("/user/abc");
    expect(response2.status).toBe(404);

    await handle("/post/456");
    expect(mc2.params).toEqual({ id: "456" });

    const response4 = await handle("/post/xyz");
    expect(response4.status).toBe(404);
  });

  test("globalPatterns ignores non-existent parameters", async () => {
    const mc1 = new MockController();
    const mc2 = new MockController();

    router.register(
      group({ globalPatterns: { id: "numeric" } }, [
        get("/user/{userId}", mc1),
        get("/post/{postId}", mc2),
      ]),
    );

    // Routes without 'id' parameter should match even with globalPatterns for 'id'
    await handle("/user/abc");
    expect(mc1.params).toEqual({ userId: "abc" });

    await handle("/post/xyz");
    expect(mc2.params).toEqual({ postId: "xyz" });
  });

  test("where and globalPatterns work together", async () => {
    router.register(
      get("/post/{postId}/comment/{commentId}", controller, {
        where: { postId: "numeric" }, // Required - must be numeric
        globalPatterns: { commentId: "numeric" }, // Optional - only checked if present
      }),
    );

    // Both numeric - success
    await handle("/post/123/comment/456");
    expect(controller.params).toEqual({ postId: "123", commentId: "456" });

    // postId not numeric - 404 (where constraint)
    const response2 = await handle("/post/abc/comment/456");
    expect(response2.status).toBe(404);

    // commentId not numeric - 404 (globalPatterns constraint)
    const response3 = await handle("/post/123/comment/xyz");
    expect(response3.status).toBe(404);
  });

  test("group-level globalPatterns apply to all child routes", async () => {
    const mc1 = new MockController();
    const mc2 = new MockController();
    const mc3 = new MockController();

    router.register(
      group({ prefix: "/admin", globalPatterns: { id: "numeric" } }, [
        get("/{id}", mc1),
        get("/{id}/edit", mc2),
        get("/users/{userId}", mc3), // Different param name - not affected
      ]),
    );

    // First route - numeric id passes
    await handle("/admin/123");
    expect(mc1.params).toEqual({ id: "123" });

    // First route - non-numeric id fails
    const response1 = await handle("/admin/abc");
    expect(response1.status).toBe(404);

    // Second route - numeric id passes
    await handle("/admin/456/edit");
    expect(mc2.params).toEqual({ id: "456" });

    // Second route - non-numeric id fails
    const response2 = await handle("/admin/xyz/edit");
    expect(response2.status).toBe(404);

    // Third route - different param name, not affected by globalPatterns for 'id'
    await handle("/admin/users/abc");
    expect(mc3.params).toEqual({ userId: "abc" });
  });

  test("globalPatterns merge through nested groups", async () => {
    const mc1 = new MockController();
    const mc2 = new MockController();

    router.register(
      group({ globalPatterns: { id: "numeric" } }, [
        group({ globalPatterns: { slug: "alphanumeric" } }, [
          get("/post/{id}", mc1),
          get("/category/{slug}", mc2),
        ]),
      ]),
    );

    // Post with numeric id - success
    await handle("/post/123");
    expect(mc1.params).toEqual({ id: "123" });

    // Post with non-numeric id - 404
    const response1 = await handle("/post/abc");
    expect(response1.status).toBe(404);

    // Category with alphanumeric slug - success
    await handle("/category/news");
    expect(mc2.params).toEqual({ slug: "news" });

    // Category with alphanumeric slug including numbers - success
    mc2.handle.mockClear();
    await handle("/category/news123");
    expect(mc2.params).toEqual({ slug: "news123" });

    // Category with non-alphanumeric slug (hyphen) - 404
    const response2 = await handle("/category/news-123");
    expect(response2.status).toBe(404);
  });

  test("globalPatterns can constrain multiple different parameters", async () => {
    const mc1 = new MockController();
    const mc2 = new MockController();
    const mc3 = new MockController();

    router.register(
      group({ globalPatterns: { id: "numeric", slug: "alphanumeric", uuid: "uuid" } }, [
        get("/user/{id}", mc1),
        get("/category/{slug}", mc2),
        get("/resource/{uuid}", mc3),
      ]),
    );

    // Valid id
    await handle("/user/123");
    expect(mc1.params).toEqual({ id: "123" });

    // Invalid id
    const response1 = await handle("/user/abc");
    expect(response1.status).toBe(404);

    // Valid slug
    await handle("/category/news");
    expect(mc2.params).toEqual({ slug: "news" });

    // Valid slug with numbers
    mc2.handle.mockClear();
    await handle("/category/news123");
    expect(mc2.params).toEqual({ slug: "news123" });

    // Invalid slug (hyphen not allowed)
    const response2 = await handle("/category/news-123");
    expect(response2.status).toBe(404);

    // Valid uuid
    const validUuid = "550e8400-e29b-41d4-a716-446655440000";
    await handle(`/resource/${validUuid}`);
    expect(mc3.params).toEqual({ uuid: validUuid });

    // Invalid uuid
    const response3 = await handle("/resource/not-a-uuid");
    expect(response3.status).toBe(404);
  });
});

// ============================================================================
// Domain Routing
// ============================================================================

describe("domain routing", () => {
  test("matches routes on specific domain", async () => {
    router.register(get("/api", controller, { domain: "api.example.com" }));

    await handle("//api.example.com/api");
    expect(controller.handle).toHaveBeenCalledTimes(1);

    const response2 = await handle("//different.com/api");
    expect(response2.status).toBe(404);
  });

  test("extracts single domain parameter", async () => {
    router.register(get("/users", controller, { domain: "{account}.example.com" }));

    await handle("//acme.example.com/users");
    expect(controller.params).toEqual({ account: "acme" });

    const response2 = await handle("//example.com/api");
    expect(response2.status).toBe(404);
  });

  test("static domain pattern takes precedence over parametric domain pattern", async () => {
    const controller1 = new MockController();
    const controller2 = new MockController();
    router.register(
      group([
        // define parametric pattern first
        get("/users", controller1, { domain: "{account}.example.com" }),
        get("/users", controller2, { domain: "www.example.com" }),
      ]),
    );

    await handle("//www.example.com/users");
    expect(controller1.handle).not.toHaveBeenCalled();
    expect(controller2.handle).toHaveBeenCalledTimes(1);
  });

  test("parametric domain pattern matches when static doesn't", async () => {
    router.register(
      group([
        get("/users", controller, { domain: "www.example.com" }),
        get("/users", controller, { domain: "{account}.example.com" }),
      ]),
    );

    await handle("//acme.example.com/users");
    expect(controller.params).toEqual({ account: "acme" });
  });

  test("extracts multiple domain parameters", async () => {
    router.register(get("/", controller, { domain: "{subdomain}.{region}.example.com" }));

    await handle("//api.us.example.com/");
    expect(controller.params).toEqual({ subdomain: "api", region: "us" });
  });

  test("handles multi-level subdomains", async () => {
    router.register(get("/", controller, { domain: "{a}.{b}.{c}.example.com" }));

    await handle("//x.y.z.example.com/");
    expect(controller.params).toEqual({ a: "x", b: "y", c: "z" });
  });

  test("combines domain and path parameters", async () => {
    router.register(get("/users/{id}", controller, { domain: "{account}.example.com" }));

    await handle("//acme.example.com/users/123");
    expect(controller.params).toEqual({ account: "acme", id: "123" });
  });

  test("domain-specific route takes precedence over domain-agnostic", async () => {
    const domainController = new MockController();
    const generalController = new MockController();

    router.register(get("/users", generalController));
    router.register(get("/users", domainController, { domain: "api.example.com" }));

    await handle("//api.example.com/users");
    expect(domainController.handle).toHaveBeenCalledTimes(1);
    expect(generalController.handle).not.toHaveBeenCalled();
  });

  test("falls back to domain-agnostic when domain doesn't match", async () => {
    const domainController = new MockController();
    const generalController = new MockController();

    router.register(get("/users", generalController));
    router.register(get("/users", domainController, { domain: "api.example.com" }));

    await handle("//other.example.com/users");
    expect(generalController.handle).toHaveBeenCalledTimes(1);
    expect(domainController.handle).not.toHaveBeenCalled();
  });

  test("applies domain to routes in group", async () => {
    const controller1 = new MockController();
    const controller2 = new MockController();

    router.register(
      group({ domain: "{tenant}.app.com" }, [
        get("/dashboard", controller1),
        get("/settings", controller2),
      ]),
    );

    await handle("//acme.app.com/dashboard");
    expect(controller1.params).toEqual({ tenant: "acme" });

    await handle("//widgets.app.com/settings");
    expect(controller2.params).toEqual({ tenant: "widgets" });
  });

  test("group domain applies to all child routes", async () => {
    const controller1 = new MockController();
    const controller2 = new MockController();

    router.register(
      group({ domain: "{tenant}.app.com" }, [
        get("/api/status", controller1),
        get("/api/health", controller2),
      ]),
    );

    await handle("//acme.app.com/api/status");
    expect(controller1.params).toEqual({ tenant: "acme" });

    await handle("//acme.app.com/api/health");
    expect(controller2.params).toEqual({ tenant: "acme" });
  });

  test("combines path prefix and domain in groups", async () => {
    router.register(
      group({ prefix: "/api", domain: "{tenant}.app.com" }, [get("/status", controller)]),
    );

    await handle("//acme.app.com/api/status");
    expect(controller.params).toEqual({ tenant: "acme" });
  });

  test("combines domain parameters and prefix parameters in groups", async () => {
    router.register(
      group({ prefix: "/users/{userId}", domain: "{tenant}.app.com" }, [
        get("/profile", controller),
      ]),
    );

    await handle("//acme.app.com/users/123/profile");
    expect(controller.params).toEqual({ tenant: "acme", userId: "123" });
  });

  test("generates correct URL for named domain route", () => {
    const route = get("/users/{id}", controller, {
      name: "users.show",
      domain: "{subdomain}.example.com",
    });

    const registry = new RouteRegistry(route);

    expect(registry.url("users.show", { subdomain: "acme", id: 123 })).toBe(
      "//acme.example.com/users/123",
    );
  });
});

// ============================================================================
// Special Routes
// ============================================================================

describe("special routes", () => {
  test("redirect returns 303 by default (changes to GET)", async () => {
    const route = any("/old", redirect("/new"));
    router.register(route);

    const response = await router.handle(new Request("http://example.com/old"));
    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("/new");
  });

  test("redirect with preserveHttpMethod returns 307", async () => {
    const route = post("/old-api", redirect("/new-api", { preserveHttpMethod: true }));
    router.register(route);

    const response = await router.handle(
      new Request("http://example.com/old-api", { method: "POST" }),
    );
    expect(response.status).toBe(307);
    expect(response.headers.get("Location")).toBe("/new-api");
  });

  test("redirect with permanent returns 301 (permanent, changes to GET)", async () => {
    const route = get("/moved", redirect("/here", { permanent: true }));
    router.register(route);

    const response = await router.handle(new Request("http://example.com/moved"));
    expect(response.status).toBe(301);
    expect(response.headers.get("Location")).toBe("/here");
  });

  test("redirect with permanent and preserveHttpMethod returns 308", async () => {
    const route = any(
      "/api/v1",
      redirect("/api/v2", { permanent: true, preserveHttpMethod: true }),
    );
    router.register(route);

    const response = await router.handle(new Request("http://example.com/api/v1"));
    expect(response.status).toBe(308);
    expect(response.headers.get("Location")).toBe("/api/v2");
  });
});

// ============================================================================
// Wildcard Routes
// ============================================================================

describe("wildcard routes", () => {
  test("named wildcard matches any subpath", async () => {
    router.register(get("/files/{...rest}", controller));

    await handle("/files/a");
    await handle("/files/a/b/c");
    await handle("/files/documents/2024/report.pdf");
    await handle("/not-files/documents/2024/report.pdf");
    expect(controller.handle).toHaveBeenCalledTimes(3);
  });

  test("named wildcard captures remaining path", async () => {
    router.register(get("/files/{...path}", controller));

    await handle("/files/document.pdf");
    expect(controller.params).toEqual({ path: "document.pdf" });

    await handle("/files/docs/2024/report.pdf");
    expect(controller.allParams[1]).toEqual({ path: "docs/2024/report.pdf" });
  });

  test("named wildcard with prefix parameters", async () => {
    router.register(get("/users/{userId}/files/{...path}", controller));

    await handle("/users/123/files/photos/vacation.jpg");
    expect(controller.params).toEqual({ userId: "123", path: "photos/vacation.jpg" });
  });

  test("wildcards in route groups", async () => {
    router.register(group({ prefix: "/api" }, [get("/{...path}", controller)]));

    await handle("/api/v1/users/list");
    expect(controller.params).toEqual({ path: "v1/users/list" });
  });
});

// ============================================================================
// Multi-Method Routes
// ============================================================================

describe("multi-method routes", () => {
  test("match() accepts multiple HTTP methods", async () => {
    router.register(match(["GET", "POST"], "/form", controller));

    const response1 = await handle("/form", "GET");
    expect(response1.status).toBe(200);

    const response2 = await handle("/form", "POST");
    expect(response2.status).toBe(200);

    const response3 = await handle("/form", "PUT");
    expect(response3.status).toBe(404);
  });

  test("match() accepts non-standard HTTP verbs", async () => {
    // Note: Bun doesn't allow custom HTTP methods in Request constructor
    // (normalizes to GET/standard methods) but we want to ensure our router
    // supports them on other runtimes that do. Use a Proxy to override the
    // method property for testing.
    const baseRequest = new Request("http://example.com/form");
    const brewRequest = new Proxy(baseRequest, {
      get(target, prop) {
        if (prop === "method") return "BREW";
        return Reflect.get(target, prop);
      },
    });

    expect(brewRequest.method).toEqual("BREW");
    router.register(match(["BREW"], "/form", controller));

    const response1 = await router.handle(brewRequest);
    expect(response1.status).toBe(200);

    const response2 = await handle("/form", "GET");
    expect(response2.status).toBe(404);
  });

  test("any() accepts all HTTP methods", async () => {
    router.register(any("/catchall", controller));

    const methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];

    for (const method of methods) {
      const response = await handle("/catchall", method);
      expect(response.status).toBe(200);
    }
  });
});
