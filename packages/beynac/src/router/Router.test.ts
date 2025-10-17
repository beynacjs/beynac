import { beforeEach, describe, expect, expectTypeOf, test } from "bun:test";
import { ContainerImpl } from "../container/ContainerImpl";
import { createTypeToken } from "../container/container-key";
import { Container } from "../contracts";
import type { Controller } from "../core/Controller";
import type { Middleware } from "../core/Middleware";
import { MockController } from "../test-utils";
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
  await router.handle(new Request(url, { method }));
};

// ============================================================================
// Basic Route Registration
// ============================================================================

describe(Router, () => {
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

  test("handles multiple route parameters", async () => {
    router.register(get("/posts/{postId}/comments/{commentId}", controller));
    await handle("/posts/42/comments/7");
    expect(controller.params).toEqual({ postId: "42", commentId: "7" });
  });

  test("returns 404 for unmatched route", async () => {
    router.register(get("/hello", controller));
    const response = await router.handle(new Request("https://example.com/notfound"));
    expect(response.status).toBe(404);
  });

  test("handles controller class", async () => {
    class TestController implements Controller {
      handle(): Response {
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
    router.register(get("/async", controller));
    await handle("/async");
    expect(controller.handle).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================
// Named Routes
// ============================================================================

describe("named routes", () => {
  test("can name route with options parameter", async () => {
    router.register(get("/users/{id}", controller, { name: "users.show" }));
    await handle("/users/123");
    expect(controller.params).toEqual({ id: "123" });
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
        handle({ request }) {
          return new Response(request.headers.get("X-Custom") || "Not found");
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

    const mc1 = new MockController();
    const mc2 = new MockController();
    const routes = group({ prefix: "/admin" }, [get("/dashboard", mc1), get("/users", mc2)]);

    router.register(routes);

    await router.handle(new Request("http://example.com/admin/dashboard"));
    expect(mc1.handle).toHaveBeenCalledTimes(1);

    await router.handle(new Request("http://example.com/admin/users"));
    expect(mc2.handle).toHaveBeenCalledTimes(1);
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
    router.register(group({ domain: "api.example.com" }, [get("/status", controller)]));

    await handle("//api.example.com/status");
    expect(controller.handle).toHaveBeenCalledTimes(1);

    const response2 = await router.handle(new Request("https://example.com/status"));
    expect(response2.status).toBe(404);
  });

  test("supports nested groups", async () => {
    const { router } = createRouter();

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
  test("whereNumber constraint", async () => {
    router.register(get("/user/{id}", controller, { where: { id: isNumber } }));

    await handle("/user/123");
    expect(controller.params).toEqual({ id: "123" });

    const response2 = await router.handle(new Request("https://example.com/user/abc"));
    expect(response2.status).toBe(404);
  });

  test("whereAlpha constraint", async () => {
    router.register(get("/category/{slug}", controller, { where: { slug: isAlpha } }));

    await handle("/category/news");
    expect(controller.params).toEqual({ slug: "news" });

    const response2 = await router.handle(new Request("https://example.com/category/news123"));
    expect(response2.status).toBe(404);
  });

  test("whereAlphaNumeric constraint", async () => {
    router.register(get("/post/{slug}", controller, { where: { slug: isAlphaNumeric } }));

    await handle("/post/post123");
    expect(controller.params).toEqual({ slug: "post123" });

    const response2 = await router.handle(new Request("https://example.com/post/post-123"));
    expect(response2.status).toBe(404);
  });

  test("whereUuid constraint", async () => {
    router.register(get("/resource/{uuid}", controller, { where: { uuid: isUuid } }));

    const validUuid = "550e8400-e29b-41d4-a716-446655440000";
    await handle(`/resource/${validUuid}`);
    expect(controller.params).toEqual({ uuid: validUuid });

    const response2 = await router.handle(new Request("https://example.com/resource/not-a-uuid"));
    expect(response2.status).toBe(404);
  });

  test("whereUlid constraint", async () => {
    router.register(get("/item/{ulid}", controller, { where: { ulid: isUlid } }));

    const validUlid = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
    await handle(`/item/${validUlid}`);
    expect(controller.params).toEqual({ ulid: validUlid });

    const response2 = await router.handle(new Request("https://example.com/item/not-a-ulid"));
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

    const response2 = await router.handle(new Request("https://example.com/status/deleted"));
    expect(response2.status).toBe(404);
  });

  test("where with custom regex", async () => {
    router.register(get("/year/{year}", controller, { where: { year: /^(19|20)\d{2}$/ } }));

    await handle("/year/2024");
    expect(controller.params).toEqual({ year: "2024" });

    const response2 = await router.handle(new Request("https://example.com/year/3024"));
    expect(response2.status).toBe(404);
  });

  test("multiple constraints on same route", async () => {
    router.register(
      get("/posts/{postId}/comments/{commentId}", controller, {
        where: { postId: isNumber, commentId: isNumber },
      }),
    );

    await handle("/posts/123/comments/456");
    expect(controller.params).toEqual({ postId: "123", commentId: "456" });

    const response2 = await router.handle(
      new Request("https://example.com/posts/abc/comments/456"),
    );
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

    const mc1 = new MockController();
    const mc2 = new MockController();
    const route1 = get("/user/{id}", mc1);
    const route2 = get("/post/{id}", mc2);

    router.register(group({}, [route1, route2]));

    await router.handle(new Request("http://example.com/user/123"));
    expect(mc1.params).toEqual({ id: "123" });

    const response2 = await router.handle(new Request("http://example.com/user/abc"));
    expect(response2.status).toBe(404);

    await router.handle(new Request("http://example.com/post/456"));
    expect(mc2.params).toEqual({ id: "456" });

    const response4 = await router.handle(new Request("http://example.com/post/xyz"));
    expect(response4.status).toBe(404);
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

    const response2 = await router.handle(new Request("https://example.com/api"));
    expect(response2.status).toBe(404);
  });

  test("supports subdomain parameters", async () => {
    router.register(get("/dashboard", controller, { domain: "{tenant}.example.com" }));

    await handle("//acme.example.com/dashboard");
    expect(controller.params).toEqual({ tenant: "acme" });

    const response3 = await router.handle(new Request("https://example.com/dashboard"));
    expect(response3.status).toBe(404);
  });

  test("extracts single domain parameter", async () => {
    router.register(get("/users", controller, { domain: "{account}.example.com" }));

    await handle("//acme.example.com/users");
    expect(controller.params).toEqual({ account: "acme" });
  });

  test("extracts multiple domain parameters", async () => {
    router.register(get("/", controller, { domain: "{subdomain}.{region}.example.com" }));

    await handle("//api.us.example.com/");
    expect(controller.params).toEqual({ subdomain: "api", region: "us" });
  });

  test("domain params don't interfere with path params", async () => {
    const { router } = createRouter();

    const route = get(
      "/users/{id}",
      {
        handle({ params }) {
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

    const mc1 = new MockController();
    const mc2 = new MockController(new Response(null, { status: 404 }));
    const mainRoute = get("/home", mc1);
    const catchAllRoute = get("/fallback/{...rest}", mc2);

    router.register(mainRoute);
    router.register(catchAllRoute);

    await router.handle(new Request("http://example.com/home"));
    expect(mc1.handle).toHaveBeenCalledTimes(1);

    const response2 = await router.handle(
      new Request("http://example.com/fallback/notfound/deep/path"),
    );
    expect(response2.status).toBe(404);
    expect(mc2.params).toEqual({ rest: "notfound/deep/path" });
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
    expect(controller.handle).toHaveBeenCalledTimes(3);
  });

  test("named wildcard captures remaining path", async () => {
    const { router } = createRouter();

    const route = get("/files/{...path}", {
      handle({ params }) {
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
      handle({ params }) {
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
        handle({ params }) {
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
        handle({ params }) {
          return new Response(`GET: ${params.path}`);
        },
      }),
      post("", {
        handle({ params }) {
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
      handle({ request }) {
        return new Response(`Method: ${request.method}`);
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
      handle({ request }) {
        return new Response(`Method: ${request.method}`);
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
        handle({ params }) {
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
        handle({ params }) {
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
        handle({ params }) {
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
        handle({ params }) {
          return new Response(`Dashboard for ${params.tenant}`);
        },
      }),
      get("/settings", {
        handle({ params }) {
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
        handle({ params }) {
          return new Response(`Status for ${params.tenant}`);
        },
      }),
      get("/api/health", {
        handle({ params }) {
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
        handle({ params }) {
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
        handle({ params }) {
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
        handle({ params }) {
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
