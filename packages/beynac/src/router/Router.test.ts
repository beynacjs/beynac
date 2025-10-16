import { describe, expect, expectTypeOf, test } from "bun:test";
import { ContainerImpl } from "../container/ContainerImpl";
import { createTypeToken } from "../container/container-key";
import type { Controller } from "../core/Controller";
import type { Middleware } from "../core/Middleware";
import {
  any,
  delete_,
  get,
  group,
  isAlpha,
  isAlphaNumeric,
  isIn,
  isNumber,
  isUlid,
  isUuid,
  match,
  options,
  patch,
  pattern,
  post,
  put,
  redirect,
  Router,
  RouteRegistry,
  type Routes,
} from "./index";

function createRouter() {
  const container = new ContainerImpl();
  const router = new Router(container);
  return { router, container };
}

// ============================================================================
// Basic Route Registration
// ============================================================================

describe(Router, () => {
  test("handles basic GET route", async () => {
    const { router } = createRouter();

    const route = get("/hello", {
      handle() {
        return new Response("Hello World");
      },
    });

    router.register(route);

    const response = await router.handle(new Request("http://example.com/hello"));
    expect(await response.text()).toBe("Hello World");
  });

  test("handles POST route", async () => {
    const { router } = createRouter();

    const route = post("/submit", {
      handle() {
        return new Response("Submitted");
      },
    });

    router.register(route);

    const response = await router.handle(
      new Request("http://example.com/submit", { method: "POST" }),
    );
    expect(await response.text()).toBe("Submitted");
  });

  test("handles PUT route", async () => {
    const { router } = createRouter();

    const route = put("/update", {
      handle() {
        return new Response("Updated");
      },
    });

    router.register(route);

    const response = await router.handle(
      new Request("http://example.com/update", { method: "PUT" }),
    );
    expect(await response.text()).toBe("Updated");
  });

  test("handles PATCH route", async () => {
    const { router } = createRouter();

    const route = patch("/patch", {
      handle() {
        return new Response("Patched");
      },
    });

    router.register(route);

    const response = await router.handle(
      new Request("http://example.com/patch", { method: "PATCH" }),
    );
    expect(await response.text()).toBe("Patched");
  });

  test("handles DELETE route", async () => {
    const { router } = createRouter();

    const route = delete_("/delete", {
      handle() {
        return new Response("Deleted");
      },
    });

    router.register(route);

    const response = await router.handle(
      new Request("http://example.com/delete", { method: "DELETE" }),
    );
    expect(await response.text()).toBe("Deleted");
  });

  test("handles OPTIONS route", async () => {
    const { router } = createRouter();

    const route = options("/cors", {
      handle() {
        return new Response(null, { status: 204 });
      },
    });

    router.register(route);

    const response = await router.handle(
      new Request("http://example.com/cors", { method: "OPTIONS" }),
    );
    expect(response.status).toBe(204);
  });

  test("handles route parameters", async () => {
    const { router } = createRouter();

    const route = get("/user/{id}", {
      handle(_req, params) {
        return new Response(`User ID: ${params.id}`);
      },
    });

    router.register(route);

    const response = await router.handle(new Request("http://example.com/user/123"));
    expect(await response.text()).toBe("User ID: 123");
  });

  test("handles multiple route parameters", async () => {
    const { router } = createRouter();

    const route = get("/posts/{postId}/comments/{commentId}", {
      handle(_req, params) {
        return new Response(`Post: ${params.postId}, Comment: ${params.commentId}`);
      },
    });

    router.register(route);

    const response = await router.handle(new Request("http://example.com/posts/42/comments/7"));
    expect(await response.text()).toBe("Post: 42, Comment: 7");
  });

  test("returns 404 for unmatched route", async () => {
    const { router } = createRouter();

    const route = get("/hello", {
      handle() {
        return new Response("Hello");
      },
    });

    router.register(route);

    const response = await router.handle(new Request("http://example.com/notfound"));
    expect(response.status).toBe(404);
  });

  test("handles controller class", async () => {
    class TestController implements Controller {
      handle(_request: Request, _params: Record<string, string>): Response {
        return new Response("From controller class");
      }
    }

    const { router } = createRouter();

    const route = get("/test", TestController);
    router.register(route);

    const response = await router.handle(new Request("http://example.com/test"));
    expect(await response.text()).toBe("From controller class");
  });

  test("controller class can use dependency injection", async () => {
    const { router, container } = createRouter();

    // Create a type token for dependency
    const messageKey = createTypeToken<string>();
    container.bind(messageKey, { instance: "injected message" });

    class InjectedController implements Controller {
      constructor(private message: string = container.get(messageKey)) {}

      handle(): Response {
        return new Response(this.message);
      }
    }

    const route = get("/hello", InjectedController);
    router.register(route);

    const response = await router.handle(new Request("http://example.com/hello"));
    expect(await response.text()).toBe("injected message");
  });

  test("handles async controller", async () => {
    const { router } = createRouter();

    const route = get("/async", {
      async handle() {
        await Promise.resolve();
        return new Response("Async response");
      },
    });

    router.register(route);

    const response = await router.handle(new Request("http://example.com/async"));
    expect(await response.text()).toBe("Async response");
  });
});

// ============================================================================
// Named Routes
// ============================================================================

describe("named routes", () => {
  test("can name route with options parameter", async () => {
    const { router } = createRouter();

    const route = get(
      "/users/{id}",
      {
        handle(_req, params) {
          return new Response(`User ${params.id}`);
        },
      },
      { name: "users.show" },
    );

    router.register(route);

    const response = await router.handle(new Request("http://example.com/users/123"));
    expect(await response.text()).toBe("User 123");
  });
});

// ============================================================================
// Middleware
// ============================================================================

describe("middleware", () => {
  test("executes middleware with options parameter", async () => {
    const { router } = createRouter();
    const log: string[] = [];

    const middleware: Middleware = {
      handle(request, next) {
        log.push("middleware");
        return next(request);
      },
    };

    const route = get(
      "/test",
      {
        handle() {
          log.push("handler");
          return new Response("OK");
        },
      },
      { name: "test", middleware },
    );

    router.register(route);

    await router.handle(new Request("http://example.com/test"));
    expect(log).toEqual(["middleware", "handler"]);
  });

  test("executes multiple middleware in correct order", async () => {
    const { router } = createRouter();
    const log: string[] = [];

    const middleware0: Middleware = {
      handle(request, next) {
        log.push("m0:before");
        const response = next(request);
        log.push("m0:after");
        return response;
      },
    };

    const middleware1: Middleware = {
      handle(request, next) {
        log.push("m1:before");
        const response = next(request);
        log.push("m1:after");
        return response;
      },
    };

    const middleware2: Middleware = {
      handle(request, next) {
        log.push("m2:before");
        const response = next(request);
        log.push("m2:after");
        return response;
      },
    };

    const routes = group({ middleware: middleware0 }, [
      get(
        "/test",
        {
          handle() {
            log.push("handler");
            return new Response("OK");
          },
        },
        { middleware: [middleware1, middleware2] },
      ),
    ]);

    router.register(routes);

    await router.handle(new Request("http://example.com/test"));
    expect(log).toEqual([
      "m0:before",
      "m1:before",
      "m2:before",
      "handler",
      "m2:after",
      "m1:after",
      "m0:after",
    ]);
  });

  test("withoutMiddleware removes parent group middleware", async () => {
    const { router } = createRouter();
    const log: string[] = [];

    const middleware1: Middleware = {
      handle(request, next) {
        log.push("m1");
        return next(request);
      },
    };

    const middleware2: Middleware = {
      handle(request, next) {
        log.push("m2");
        return next(request);
      },
    };

    const routes = group({ middleware: [middleware1, middleware2] }, [
      get(
        "/test",
        {
          handle() {
            log.push("handler");
            return new Response("OK");
          },
        },
        { withoutMiddleware: middleware1 },
      ),
    ]);

    router.register(routes);

    await router.handle(new Request("http://example.com/test"));
    expect(log).toEqual(["m2", "handler"]);
  });

  test("withoutMiddleware works in nested groups", async () => {
    const { router } = createRouter();
    const log: string[] = [];

    const middleware1: Middleware = {
      handle(request, next) {
        log.push("m1");
        return next(request);
      },
    };

    const middleware2: Middleware = {
      handle(request, next) {
        log.push("m2");
        return next(request);
      },
    };

    const middleware3: Middleware = {
      handle(request, next) {
        log.push("m3");
        return next(request);
      },
    };

    const innerRoutes = group({ withoutMiddleware: middleware1, middleware: middleware3 }, [
      get("/test", {
        handle() {
          log.push("handler");
          return new Response("OK");
        },
      }),
    ]);

    const outerRoutes = group({ middleware: [middleware1, middleware2] }, [innerRoutes]);

    router.register(outerRoutes);

    await router.handle(new Request("http://example.com/test"));
    expect(log).toEqual(["m2", "m3", "handler"]);
  });

  test("route middleware can re-add previously removed middleware", async () => {
    const { router } = createRouter();
    const log: string[] = [];

    const middleware1: Middleware = {
      handle(request, next) {
        log.push("m1");
        return next(request);
      },
    };

    const middleware2: Middleware = {
      handle(request, next) {
        log.push("m2");
        return next(request);
      },
    };

    const innerRoutes = group({ withoutMiddleware: middleware1 }, [
      get(
        "/test",
        {
          handle() {
            log.push("handler");
            return new Response("OK");
          },
        },
        { middleware: middleware1 },
      ),
    ]);

    const outerRoutes = group({ middleware: [middleware1, middleware2] }, [innerRoutes]);

    router.register(outerRoutes);

    await router.handle(new Request("http://example.com/test"));
    expect(log).toEqual(["m2", "m1", "handler"]);
  });

  test("group with both middleware and withoutMiddleware for same middleware", async () => {
    const { router } = createRouter();
    const log: string[] = [];

    const middleware1: Middleware = {
      handle(request, next) {
        log.push("m1");
        return next(request);
      },
    };

    const middleware2: Middleware = {
      handle(request, next) {
        log.push("m2");
        return next(request);
      },
    };

    const innerRoutes = group(
      { withoutMiddleware: middleware1, middleware: [middleware1, middleware2] },
      [
        get("/test", {
          handle() {
            log.push("handler");
            return new Response("OK");
          },
        }),
      ],
    );

    const outerRoutes = group({ middleware: middleware1 }, [innerRoutes]);

    router.register(outerRoutes);

    await router.handle(new Request("http://example.com/test"));
    expect(log).toEqual(["m1", "m2", "handler"]);
  });

  test("multiple withoutMiddleware at different levels", async () => {
    const { router } = createRouter();
    const log: string[] = [];

    const middleware1: Middleware = {
      handle(request, next) {
        log.push("m1");
        return next(request);
      },
    };

    const middleware2: Middleware = {
      handle(request, next) {
        log.push("m2");
        return next(request);
      },
    };

    const middleware3: Middleware = {
      handle(request, next) {
        log.push("m3");
        return next(request);
      },
    };

    const middleware4: Middleware = {
      handle(request, next) {
        log.push("m4");
        return next(request);
      },
    };

    const innerRoutes = group({ withoutMiddleware: middleware1 }, [
      get(
        "/test",
        {
          handle() {
            log.push("handler");
            return new Response("OK");
          },
        },
        { withoutMiddleware: middleware2, middleware: middleware4 },
      ),
    ]);

    const outerRoutes = group({ middleware: [middleware1, middleware2, middleware3] }, [
      innerRoutes,
    ]);

    router.register(outerRoutes);

    await router.handle(new Request("http://example.com/test"));
    expect(log).toEqual(["m3", "m4", "handler"]);
  });

  test("withoutMiddleware with array of middleware", async () => {
    const { router } = createRouter();
    const log: string[] = [];

    const middleware1: Middleware = {
      handle(request, next) {
        log.push("m1");
        return next(request);
      },
    };

    const middleware2: Middleware = {
      handle(request, next) {
        log.push("m2");
        return next(request);
      },
    };

    const middleware3: Middleware = {
      handle(request, next) {
        log.push("m3");
        return next(request);
      },
    };

    const routes = group({ middleware: [middleware1, middleware2, middleware3] }, [
      get(
        "/test",
        {
          handle() {
            log.push("handler");
            return new Response("OK");
          },
        },
        { withoutMiddleware: [middleware1, middleware3] },
      ),
    ]);

    router.register(routes);

    await router.handle(new Request("http://example.com/test"));
    expect(log).toEqual(["m2", "handler"]);
  });

  test("middleware can short-circuit", async () => {
    const { router } = createRouter();

    const authMiddleware: Middleware = {
      handle(_request, _next) {
        return new Response("Unauthorized", { status: 401 });
      },
    };

    const route = get(
      "/protected",
      {
        handle() {
          return new Response("Should not be called");
        },
      },
      { middleware: authMiddleware },
    );

    router.register(route);

    const response = await router.handle(new Request("http://example.com/protected"));
    expect(response.status).toBe(401);
    expect(await response.text()).toBe("Unauthorized");
  });

  test("middleware can modify request", async () => {
    const { router } = createRouter();

    const middleware: Middleware = {
      handle(request, next) {
        const headers = new Headers(request.headers);
        headers.set("X-Custom", "Modified");
        const modifiedRequest = new Request(request.url, {
          method: request.method,
          headers,
        });
        return next(modifiedRequest);
      },
    };

    const route = get(
      "/test",
      {
        handle(req) {
          return new Response(req.headers.get("X-Custom") || "Not found");
        },
      },
      { middleware },
    );

    router.register(route);

    const response = await router.handle(new Request("http://example.com/test"));
    expect(await response.text()).toBe("Modified");
  });
});

// ============================================================================
// Route Groups
// ============================================================================

describe("route groups", () => {
  test("applies prefix to routes", async () => {
    const { router } = createRouter();

    const routes = group({ prefix: "/admin" }, [
      get("/dashboard", {
        handle() {
          return new Response("Dashboard");
        },
      }),
      get("/users", {
        handle() {
          return new Response("Users");
        },
      }),
    ]);

    router.register(routes);

    const response1 = await router.handle(new Request("http://example.com/admin/dashboard"));
    expect(await response1.text()).toBe("Dashboard");

    const response2 = await router.handle(new Request("http://example.com/admin/users"));
    expect(await response2.text()).toBe("Users");
  });

  test("applies middleware to all routes in group", async () => {
    const { router } = createRouter();
    const log: string[] = [];

    const middleware: Middleware = {
      handle(request, next) {
        log.push("group-middleware");
        return next(request);
      },
    };

    const routes = group({ prefix: "/api", middleware }, [
      get("/v1", {
        handle() {
          log.push("v1");
          return new Response("V1");
        },
      }),
      get("/v2", {
        handle() {
          log.push("v2");
          return new Response("V2");
        },
      }),
    ]);

    router.register(routes);

    log.length = 0;
    await router.handle(new Request("http://example.com/api/v1"));
    expect(log).toEqual(["group-middleware", "v1"]);

    log.length = 0;
    await router.handle(new Request("http://example.com/api/v2"));
    expect(log).toEqual(["group-middleware", "v2"]);
  });

  test("applies domain to all routes in group", async () => {
    const { router } = createRouter();

    const routes = group({ domain: "api.example.com" }, [
      get("/status", {
        handle() {
          return new Response("API Status");
        },
      }),
    ]);

    router.register(routes);

    const response1 = await router.handle(new Request("http://api.example.com/status"));
    expect(await response1.text()).toBe("API Status");

    const response2 = await router.handle(new Request("http://example.com/status"));
    expect(response2.status).toBe(404);
  });

  test("supports nested groups", async () => {
    const { router } = createRouter();

    const userRoutes = group({ prefix: "/users", namePrefix: "users." }, [
      get(
        "/",
        {
          handle() {
            return new Response("Users Index");
          },
        },
        { name: "index" },
      ),
      get(
        "/{id}",
        {
          handle(_req, params) {
            return new Response(`User ${params.id}`);
          },
        },
        { name: "show" },
      ),
    ]);

    const apiRoutes = group({ prefix: "/api", namePrefix: "api." }, [userRoutes]);

    router.register(apiRoutes);

    const response1 = await router.handle(new Request("http://example.com/api/users/"));
    expect(await response1.text()).toBe("Users Index");

    const response2 = await router.handle(new Request("http://example.com/api/users/123"));
    expect(await response2.text()).toBe("User 123");

    // Type check
    expectTypeOf(apiRoutes).toMatchTypeOf<
      Routes<{ "api.users.index": never; "api.users.show": "id" }>
    >();
  });

  test("group with callback function", async () => {
    const { router } = createRouter();

    const routes = group({ prefix: "/admin" }, () => [
      get("/dashboard", {
        handle() {
          return new Response("Dashboard");
        },
      }),
    ]);

    router.register(routes);

    const response = await router.handle(new Request("http://example.com/admin/dashboard"));
    expect(await response.text()).toBe("Dashboard");
  });
});

// ============================================================================
// Parameter Constraints
// ============================================================================

describe("parameter constraints", () => {
  test("whereNumber constraint", async () => {
    const { router } = createRouter();

    const route = get(
      "/user/{id}",
      {
        handle(_req, params) {
          return new Response(`User ${params.id}`);
        },
      },
      { where: { id: isNumber } },
    );

    router.register(route);

    const response1 = await router.handle(new Request("http://example.com/user/123"));
    expect(await response1.text()).toBe("User 123");

    const response2 = await router.handle(new Request("http://example.com/user/abc"));
    expect(response2.status).toBe(404);
  });

  test("whereAlpha constraint", async () => {
    const { router } = createRouter();

    const route = get(
      "/category/{slug}",
      {
        handle(_req, params) {
          return new Response(`Category ${params.slug}`);
        },
      },
      { where: { slug: isAlpha } },
    );

    router.register(route);

    const response1 = await router.handle(new Request("http://example.com/category/news"));
    expect(await response1.text()).toBe("Category news");

    const response2 = await router.handle(new Request("http://example.com/category/news123"));
    expect(response2.status).toBe(404);
  });

  test("whereAlphaNumeric constraint", async () => {
    const { router } = createRouter();

    const route = get(
      "/post/{slug}",
      {
        handle(_req, params) {
          return new Response(`Post ${params.slug}`);
        },
      },
      { where: { slug: isAlphaNumeric } },
    );

    router.register(route);

    const response1 = await router.handle(new Request("http://example.com/post/post123"));
    expect(await response1.text()).toBe("Post post123");

    const response2 = await router.handle(new Request("http://example.com/post/post-123"));
    expect(response2.status).toBe(404);
  });

  test("whereUuid constraint", async () => {
    const { router } = createRouter();

    const route = get(
      "/resource/{uuid}",
      {
        handle(_req, params) {
          return new Response(`Resource ${params.uuid}`);
        },
      },
      { where: { uuid: isUuid } },
    );

    router.register(route);

    const validUuid = "550e8400-e29b-41d4-a716-446655440000";
    const response1 = await router.handle(new Request(`http://example.com/resource/${validUuid}`));
    expect(await response1.text()).toBe(`Resource ${validUuid}`);

    const response2 = await router.handle(new Request("http://example.com/resource/not-a-uuid"));
    expect(response2.status).toBe(404);
  });

  test("whereUlid constraint", async () => {
    const { router } = createRouter();

    const route = get(
      "/item/{ulid}",
      {
        handle(_req, params) {
          return new Response(`Item ${params.ulid}`);
        },
      },
      { where: { ulid: isUlid } },
    );

    router.register(route);

    const validUlid = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
    const response1 = await router.handle(new Request(`http://example.com/item/${validUlid}`));
    expect(await response1.text()).toBe(`Item ${validUlid}`);

    const response2 = await router.handle(new Request("http://example.com/item/not-a-ulid"));
    expect(response2.status).toBe(404);
  });

  test("whereIn constraint", async () => {
    const { router } = createRouter();

    const route = get(
      "/status/{type}",
      {
        handle(_req, params) {
          return new Response(`Status ${params.type}`);
        },
      },
      { where: { type: isIn(["active", "inactive", "pending"]) } },
    );

    router.register(route);

    const response1 = await router.handle(new Request("http://example.com/status/active"));
    expect(await response1.text()).toBe("Status active");

    const response2 = await router.handle(new Request("http://example.com/status/deleted"));
    expect(response2.status).toBe(404);
  });

  test("where with custom regex", async () => {
    const { router } = createRouter();

    const route = get(
      "/year/{year}",
      {
        handle(_req, params) {
          return new Response(`Year ${params.year}`);
        },
      },
      { where: { year: /^(19|20)\d{2}$/ } },
    );

    router.register(route);

    const response1 = await router.handle(new Request("http://example.com/year/2024"));
    expect(await response1.text()).toBe("Year 2024");

    const response2 = await router.handle(new Request("http://example.com/year/3024"));
    expect(response2.status).toBe(404);
  });

  test("multiple constraints on same route", async () => {
    const { router } = createRouter();

    const route = get(
      "/posts/{postId}/comments/{commentId}",
      {
        handle(_req, params) {
          return new Response(`Post ${params.postId}, Comment ${params.commentId}`);
        },
      },
      { where: { postId: isNumber, commentId: isNumber } },
    );

    router.register(route);

    const response1 = await router.handle(new Request("http://example.com/posts/123/comments/456"));
    expect(await response1.text()).toBe("Post 123, Comment 456");

    const response2 = await router.handle(new Request("http://example.com/posts/abc/comments/456"));
    expect(response2.status).toBe(404);
  });
});

// ============================================================================
// Global Patterns
// ============================================================================

describe("global patterns", () => {
  test("applies global pattern to all matching parameters", async () => {
    pattern("id", /^\d+$/);

    const { router } = createRouter();

    const route1 = get("/user/{id}", {
      handle(_req, params) {
        return new Response(`User ${params.id}`);
      },
    });

    const route2 = get("/post/{id}", {
      handle(_req, params) {
        return new Response(`Post ${params.id}`);
      },
    });

    router.register(group({}, [route1, route2]));

    const response1 = await router.handle(new Request("http://example.com/user/123"));
    expect(await response1.text()).toBe("User 123");

    const response2 = await router.handle(new Request("http://example.com/user/abc"));
    expect(response2.status).toBe(404);

    const response3 = await router.handle(new Request("http://example.com/post/456"));
    expect(await response3.text()).toBe("Post 456");

    const response4 = await router.handle(new Request("http://example.com/post/xyz"));
    expect(response4.status).toBe(404);
  });
});

// ============================================================================
// Domain Routing
// ============================================================================

describe("domain routing", () => {
  test("matches routes on specific domain", async () => {
    const { router } = createRouter();

    const route = get(
      "/api",
      {
        handle() {
          return new Response("API");
        },
      },
      { domain: "api.example.com" },
    );

    router.register(route);

    const response1 = await router.handle(new Request("http://api.example.com/api"));
    expect(await response1.text()).toBe("API");

    const response2 = await router.handle(new Request("http://example.com/api"));
    expect(response2.status).toBe(404);
  });

  test("supports subdomain parameters", async () => {
    const { router } = createRouter();

    const route = get(
      "/dashboard",
      {
        handle(_req, params) {
          return new Response(`Tenant: ${params.tenant}`);
        },
      },
      { domain: "{tenant}.example.com" },
    );

    router.register(route);

    const response1 = await router.handle(new Request("http://acme.example.com/dashboard"));
    expect(await response1.text()).toBe("Tenant: acme");

    const response2 = await router.handle(new Request("http://widgets.example.com/dashboard"));
    expect(await response2.text()).toBe("Tenant: widgets");

    const response3 = await router.handle(new Request("http://example.com/dashboard"));
    expect(response3.status).toBe(404);
  });

  test("extracts single domain parameter", async () => {
    const { router } = createRouter();

    const route = get(
      "/users",
      {
        handle(_req, params) {
          return new Response(`Account: ${params.account}`);
        },
      },
      { domain: "{account}.example.com" },
    );

    router.register(route);

    const response = await router.handle(new Request("http://acme.example.com/users"));
    expect(await response.text()).toBe("Account: acme");
  });

  test("extracts multiple domain parameters", async () => {
    const { router } = createRouter();

    const route = get(
      "/",
      {
        handle(_req, params) {
          return new Response(`Sub: ${params.subdomain}, Region: ${params.region}`);
        },
      },
      { domain: "{subdomain}.{region}.example.com" },
    );

    router.register(route);

    const response = await router.handle(new Request("http://api.us.example.com/"));
    expect(await response.text()).toBe("Sub: api, Region: us");
  });

  test("domain params don't interfere with path params", async () => {
    const { router } = createRouter();

    const route = get(
      "/users/{id}",
      {
        handle(_req, params) {
          return new Response(`Account: ${params.account}, User: ${params.id}`);
        },
      },
      { domain: "{account}.example.com" },
    );

    router.register(route);

    const response = await router.handle(new Request("http://acme.example.com/users/123"));
    expect(await response.text()).toBe("Account: acme, User: 123");
  });

  test("domain-specific route takes precedence over domain-agnostic", async () => {
    const { router } = createRouter();
    let domainCalled = false;
    let generalCalled = false;

    router.register(
      get("/users", {
        handle() {
          generalCalled = true;
          return new Response("general");
        },
      }),
    );

    router.register(
      get(
        "/users",
        {
          handle() {
            domainCalled = true;
            return new Response("domain");
          },
        },
        { domain: "api.example.com" },
      ),
    );

    await router.handle(new Request("http://api.example.com/users"));

    expect(domainCalled).toBe(true);
    expect(generalCalled).toBe(false);
  });

  test("falls back to domain-agnostic when domain doesn't match", async () => {
    const { router } = createRouter();
    let domainCalled = false;
    let generalCalled = false;

    router.register(
      get("/users", {
        handle() {
          generalCalled = true;
          return new Response("general");
        },
      }),
    );

    router.register(
      get(
        "/users",
        {
          handle() {
            domainCalled = true;
            return new Response("domain");
          },
        },
        { domain: "api.example.com" },
      ),
    );

    await router.handle(new Request("http://other.example.com/users"));

    expect(generalCalled).toBe(true);
    expect(domainCalled).toBe(false);
  });
});

// ============================================================================
// Special Routes
// ============================================================================

describe("special routes", () => {
  test("redirect returns 303 by default (changes to GET)", async () => {
    const { router } = createRouter();

    const route = any("/old", redirect("/new"));
    router.register(route);

    const response = await router.handle(new Request("http://example.com/old"));
    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("/new");
  });

  test("redirect with preserveHttpMethod returns 307", async () => {
    const { router } = createRouter();

    const route = post("/old-api", redirect("/new-api", { preserveHttpMethod: true }));
    router.register(route);

    const response = await router.handle(
      new Request("http://example.com/old-api", { method: "POST" }),
    );
    expect(response.status).toBe(307);
    expect(response.headers.get("Location")).toBe("/new-api");
  });

  test("redirect with permanent returns 303 (permanent but changes to GET)", async () => {
    const { router } = createRouter();

    const route = get("/moved", redirect("/here", { permanent: true }));
    router.register(route);

    const response = await router.handle(new Request("http://example.com/moved"));
    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe("/here");
  });

  test("redirect with permanent and preserveHttpMethod returns 308", async () => {
    const { router } = createRouter();

    const route = any(
      "/api/v1",
      redirect("/api/v2", { permanent: true, preserveHttpMethod: true }),
    );
    router.register(route);

    const response = await router.handle(new Request("http://example.com/api/v1"));
    expect(response.status).toBe(308);
    expect(response.headers.get("Location")).toBe("/api/v2");
  });

  test("catch-all wildcard route captures unmatched requests", async () => {
    const { router } = createRouter();

    const mainRoute = get("/home", {
      handle() {
        return new Response("Home");
      },
    });

    const catchAllRoute = get("/fallback/{...rest}", {
      handle(_req, params) {
        return new Response(`Catch-all: ${params.rest}`, { status: 404 });
      },
    });

    router.register(mainRoute);
    router.register(catchAllRoute);

    const response1 = await router.handle(new Request("http://example.com/home"));
    expect(await response1.text()).toBe("Home");

    const response2 = await router.handle(
      new Request("http://example.com/fallback/notfound/deep/path"),
    );
    expect(response2.status).toBe(404);
    expect(await response2.text()).toBe("Catch-all: notfound/deep/path");
  });
});

// ============================================================================
// Wildcard Routes
// ============================================================================

describe("wildcard routes", () => {
  test("named wildcard matches any subpath", async () => {
    const { router } = createRouter();

    const route = get("/files/{...rest}", {
      handle() {
        return new Response("File handler");
      },
    });

    router.register(route);

    const response1 = await router.handle(new Request("http://example.com/files/a"));
    expect(await response1.text()).toBe("File handler");

    const response2 = await router.handle(new Request("http://example.com/files/a/b/c"));
    expect(await response2.text()).toBe("File handler");

    const response3 = await router.handle(
      new Request("http://example.com/files/documents/2024/report.pdf"),
    );
    expect(await response3.text()).toBe("File handler");
  });

  test("named wildcard captures remaining path", async () => {
    const { router } = createRouter();

    const route = get("/files/{...path}", {
      handle(_req, params) {
        return new Response(`Path: ${params.path}`);
      },
    });

    router.register(route);

    const response1 = await router.handle(new Request("http://example.com/files/document.pdf"));
    expect(await response1.text()).toBe("Path: document.pdf");

    const response2 = await router.handle(
      new Request("http://example.com/files/docs/2024/report.pdf"),
    );
    expect(await response2.text()).toBe("Path: docs/2024/report.pdf");
  });

  test("named wildcard with prefix parameters", async () => {
    const { router } = createRouter();

    const route = get("/users/{userId}/files/{...path}", {
      handle(_req, params) {
        return new Response(`User: ${params.userId}, Path: ${params.path}`);
      },
    });

    router.register(route);

    const response = await router.handle(
      new Request("http://example.com/users/123/files/photos/vacation.jpg"),
    );
    expect(await response.text()).toBe("User: 123, Path: photos/vacation.jpg");
  });

  test("wildcards in route groups", async () => {
    const { router } = createRouter();

    const routes = group({ prefix: "/api" }, [
      get("/{...path}", {
        handle(_req, params) {
          return new Response(`API Path: ${params.path}`);
        },
      }),
    ]);

    router.register(routes);

    const response = await router.handle(new Request("http://example.com/api/v1/users/list"));
    expect(await response.text()).toBe("API Path: v1/users/list");
  });

  test("wildcard in group prefix allows empty child paths", async () => {
    const { router } = createRouter();

    // This is allowed - empty path means the route is exactly the prefix
    const routes = group({ prefix: "/files/{...path}" }, [
      get("", {
        handle(_req, params) {
          return new Response(`GET: ${params.path}`);
        },
      }),
      post("", {
        handle(_req, params) {
          return new Response(`POST: ${params.path}`);
        },
      }),
    ]);

    router.register(routes);

    const response1 = await router.handle(new Request("http://example.com/files/doc/file.txt"));
    expect(await response1.text()).toBe("GET: doc/file.txt");

    const response2 = await router.handle(
      new Request("http://example.com/files/a/b/c", { method: "POST" }),
    );
    expect(await response2.text()).toBe("POST: a/b/c");
  });
});

// ============================================================================
// Multi-Method Routes
// ============================================================================

describe("multi-method routes", () => {
  test("match() accepts multiple HTTP methods", async () => {
    const { router } = createRouter();

    const route = match(["GET", "POST"], "/form", {
      handle(req) {
        return new Response(`Method: ${req.method}`);
      },
    });

    router.register(route);

    const response1 = await router.handle(
      new Request("http://example.com/form", { method: "GET" }),
    );
    expect(await response1.text()).toBe("Method: GET");

    const response2 = await router.handle(
      new Request("http://example.com/form", { method: "POST" }),
    );
    expect(await response2.text()).toBe("Method: POST");

    const response3 = await router.handle(
      new Request("http://example.com/form", { method: "PUT" }),
    );
    expect(response3.status).toBe(404);
  });

  test("any() accepts all HTTP methods", async () => {
    const { router } = createRouter();

    const route = any("/catchall", {
      handle(req) {
        return new Response(`Method: ${req.method}`);
      },
    });

    router.register(route);

    const methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];

    for (const method of methods) {
      const response = await router.handle(new Request("http://example.com/catchall", { method }));
      expect(await response.text()).toBe(`Method: ${method}`);
    }
  });
});

// ============================================================================
// Domain Routing with Domain-as-Path Encoding
// ============================================================================

describe("domain routing with domain-as-path encoding", () => {
  test("matches domain route with single parameter", async () => {
    const { router } = createRouter();

    const route = get(
      "/users",
      {
        handle(_req, params) {
          return new Response(`Subdomain: ${params.subdomain}`);
        },
      },
      { domain: "{subdomain}.example.com" },
    );

    router.register(route);

    const response = await router.handle(new Request("http://acme.example.com/users"));
    expect(await response.text()).toBe("Subdomain: acme");
  });

  test("matches domain route with multiple parameters", async () => {
    const { router } = createRouter();

    const route = get(
      "/",
      {
        handle(_req, params) {
          return new Response(`Tenant: ${params.tenant}, Region: ${params.region}`);
        },
      },
      { domain: "{tenant}.{region}.example.com" },
    );

    router.register(route);

    const response = await router.handle(new Request("http://acme.us.example.com/"));
    expect(await response.text()).toBe("Tenant: acme, Region: us");
  });

  test("extracts both domain and path parameters", async () => {
    const { router } = createRouter();

    const route = get(
      "/users/{id}",
      {
        handle(_req, params) {
          return new Response(`Subdomain: ${params.subdomain}, User: ${params.id}`);
        },
      },
      { domain: "{subdomain}.example.com" },
    );

    router.register(route);

    const response = await router.handle(new Request("http://acme.example.com/users/123"));
    expect(await response.text()).toBe("Subdomain: acme, User: 123");
  });

  test("prioritizes domain-specific route over domain-agnostic", async () => {
    const { router } = createRouter();

    router.register(
      get("/users", {
        handle() {
          return new Response("general");
        },
      }),
    );

    router.register(
      get(
        "/users",
        {
          handle() {
            return new Response("domain-specific");
          },
        },
        { domain: "api.example.com" },
      ),
    );

    const response = await router.handle(new Request("http://api.example.com/users"));
    expect(await response.text()).toBe("domain-specific");
  });

  test("falls back to domain-agnostic when hostname doesn't match", async () => {
    const { router } = createRouter();

    router.register(
      get("/users", {
        handle() {
          return new Response("general");
        },
      }),
    );

    router.register(
      get(
        "/users",
        {
          handle() {
            return new Response("domain-specific");
          },
        },
        { domain: "api.example.com" },
      ),
    );

    const response = await router.handle(new Request("http://other.example.com/users"));
    expect(await response.text()).toBe("general");
  });

  test("generates correct URL for domain route with name", () => {
    const route = get(
      "/users/{id}",
      {
        handle() {
          return new Response();
        },
      },
      {
        name: "users.show",
        domain: "{subdomain}.example.com",
      },
    );

    const registry = new RouteRegistry(route);

    expect(registry.url("users.show", { subdomain: "acme", id: 123 })).toBe(
      "//acme.example.com/users/123",
    );
  });

  test("domain routing works within groups", async () => {
    const { router } = createRouter();

    const routes = group({ domain: "{tenant}.app.com" }, [
      get("/dashboard", {
        handle(_req, params) {
          return new Response(`Dashboard for ${params.tenant}`);
        },
      }),
      get("/settings", {
        handle(_req, params) {
          return new Response(`Settings for ${params.tenant}`);
        },
      }),
    ]);

    router.register(routes);

    const response1 = await router.handle(new Request("http://acme.app.com/dashboard"));
    expect(await response1.text()).toBe("Dashboard for acme");

    const response2 = await router.handle(new Request("http://widgets.app.com/settings"));
    expect(await response2.text()).toBe("Settings for widgets");
  });

  test("group domain applies to all children", async () => {
    const { router } = createRouter();

    const routes = group({ domain: "{tenant}.app.com" }, [
      get("/api/status", {
        handle(_req, params) {
          return new Response(`Status for ${params.tenant}`);
        },
      }),
      get("/api/health", {
        handle(_req, params) {
          return new Response(`Health for ${params.tenant}`);
        },
      }),
    ]);

    router.register(routes);

    const response1 = await router.handle(new Request("http://acme.app.com/api/status"));
    expect(await response1.text()).toBe("Status for acme");

    const response2 = await router.handle(new Request("http://acme.app.com/api/health"));
    expect(await response2.text()).toBe("Health for acme");
  });

  test("path prefix and domain work together in groups", async () => {
    const { router } = createRouter();

    const routes = group({ prefix: "/api", domain: "{tenant}.app.com" }, [
      get("/status", {
        handle(_req, params) {
          return new Response(`API status for ${params.tenant}`);
        },
      }),
    ]);

    router.register(routes);

    const response = await router.handle(new Request("http://acme.app.com/api/status"));
    expect(await response.text()).toBe("API status for acme");
  });

  test("domain parameters combine with prefix parameters in groups", async () => {
    const { router } = createRouter();

    const routes = group({ prefix: "/users/{userId}", domain: "{tenant}.app.com" }, [
      get("/profile", {
        handle(_req, params) {
          return new Response(`Tenant: ${params.tenant}, User: ${params.userId}`);
        },
      }),
    ]);

    router.register(routes);

    const response = await router.handle(new Request("http://acme.app.com/users/123/profile"));
    expect(await response.text()).toBe("Tenant: acme, User: 123");
  });

  test("handles multi-level subdomains correctly", async () => {
    const { router } = createRouter();

    const route = get(
      "/",
      {
        handle(_req, params) {
          return new Response(`A: ${params.a}, B: ${params.b}, C: ${params.c}`);
        },
      },
      { domain: "{a}.{b}.{c}.example.com" },
    );

    router.register(route);

    const response = await router.handle(new Request("http://x.y.z.example.com/"));
    expect(await response.text()).toBe("A: x, B: y, C: z");
  });
});
