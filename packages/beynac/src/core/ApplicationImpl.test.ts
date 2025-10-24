import { afterEach, describe, expect, test } from "bun:test";
import { Dispatcher } from "../contracts/Dispatcher";
import { RequestContext } from "../contracts/RequestContext";
import { createApplication } from "../entry";
import { Cookies, Headers } from "../facades";
import { get, group } from "../router";
import { Controller, ControllerContext } from "../router/Controller";
import { MockController, mockMiddleware, requestContext } from "../test-utils";
import { ApplicationImpl } from "./ApplicationImpl";
import { DispatcherImpl } from "./DispatcherImpl";
import { setFacadeApplication } from "./facade";

afterEach(() => {
  setFacadeApplication(null);
});

describe("ApplicationImpl", () => {
  test("events getter uses container resolution", () => {
    const app = new ApplicationImpl();
    // Bind dispatcher as singleton
    app.container.bind(Dispatcher, {
      factory: (container) => new DispatcherImpl(container),
      lifecycle: "singleton",
    });

    // Access through getter multiple times
    const events1 = app.events;
    const events2 = app.events;

    // Should be same instance (singleton)
    expect(events1).toBe(events2);
    expect(events1).toBeInstanceOf(DispatcherImpl);
  });

  test("url() generates URLs for named routes", () => {
    const routes = group({}, [
      get("/users/{id}", MockController, { name: "users.show" }),
      get("/posts/{postId}/comments/{commentId}", MockController, {
        name: "posts.comments.show",
      }),
    ]);

    const app = new ApplicationImpl({ routes });
    app.bootstrap();

    expect(app.url("users.show", { id: 123 })).toBe("/users/123");
    expect(app.url("posts.comments.show", { postId: 42, commentId: 7 })).toBe(
      "/posts/42/comments/7",
    );
  });

  test("url() is type-safe with route parameters", () => {
    const routes = group({}, [
      get("/users/{id}", MockController, { name: "users.show" }),
      get("/posts", MockController, { name: "posts.index" }),
    ]);

    const app = new ApplicationImpl({ routes });
    app.bootstrap();

    // These should compile (correct usage)
    expect(app.url("users.show", { id: 123 })).toBe("/users/123");
    expect(app.url("posts.index")).toBe("/posts");

    // Type checking tests - these should cause TypeScript errors
    // but are guarded to not run at runtime
    if (false as boolean) {
      // @ts-expect-error - Missing required parameter
      app.url("users.show");

      // @ts-expect-error - Invalid route name
      app.url("nonexistent.route");

      // @ts-expect-error - Wrong parameter name
      app.url("users.show", { userId: 123 });
    }
  });

  test("handles HTTP request through RouterV2", async () => {
    class TestController extends Controller {
      handle() {
        const testCookie = Cookies.get("c");
        const testHeader = Headers.get("h");
        return new Response(`Cookie: ${testCookie}, Header: ${testHeader}`);
      }
    }
    const routes = get("/hello", TestController);

    const app = createApplication({ routes });

    const request = new Request("http://example.com/hello");
    const context: RequestContext = {
      context: "test",
      getCookie: (name) => (name === "c" ? "cookie" : null),
      getCookieNames: () => ["c"],
      deleteCookie: null,
      setCookie: null,
      getRequestHeader: (name) => (name === "h" ? "header" : null),
      getRequestHeaderNames: () => ["h"],
    };

    const response = await app.handleRequest(request, context);
    expect(await response.text()).toBe("Cookie: cookie, Header: header");
  });

  describe("middleware priority configuration", () => {
    test("reorders middleware based on priority", async () => {
      const M1 = mockMiddleware("M1");
      const M2 = mockMiddleware("M2");

      const app = new ApplicationImpl({
        middlewarePriority: [M2, M1],
        routes: get("/test", MockController, { middleware: [M1, M2] }),
      });

      app.bootstrap();
      mockMiddleware.reset();

      await app.handleRequest(new Request("http://example.com/test"), requestContext());

      expect(mockMiddleware.log).toEqual(["M2", "M1"]);
    });
  });

  describe("router configuration", () => {
    // These tests are here to ensure that the router configuration is passed
    // through to the router instance. They are not intended to test the
    // functionality of the router itself.
    class ControllerInvalidParam extends Controller {
      handle(ctx: ControllerContext) {
        return new Response(`ctx.params.nonExistent: ${ctx.params.nonExistent}`);
      }
    }

    test("config flows from app to router - throws in development mode", async () => {
      const app = new ApplicationImpl({
        development: true,
        routes: get("/user/{id}", ControllerInvalidParam),
      });

      app.bootstrap();
      expect(async () => {
        await app.handleRequest(new Request("http://example.com/user/123"), requestContext());
      }).toThrow('Route parameter "nonExistent" does not exist');
    });

    test("config flows from app to router - doesn't throw in production mode", async () => {
      const app = new ApplicationImpl({
        development: false,
        routes: get("/user/{id}", ControllerInvalidParam),
      });

      app.bootstrap();
      const response = await app.handleRequest(
        new Request("http://example.com/user/123"),
        requestContext(),
      );

      expect(response.status).toBe(200);
      expect(await response.text()).toBe("ctx.params.nonExistent: undefined");
    });
  });
});
