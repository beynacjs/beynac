import { describe, expect, test } from "bun:test";
import { Dispatcher } from "../contracts/Dispatcher";
import { RequestContext } from "../contracts/RequestContext";
import { ApplicationImpl } from "./ApplicationImpl";
import { DispatcherImpl } from "./DispatcherImpl";
import { get, group } from "./RouterV2";

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
      get(
        "/users/{id}",
        {
          handle() {
            return new Response();
          },
        },
        { name: "users.show" },
      ),
      get(
        "/posts/{postId}/comments/{commentId}",
        {
          handle() {
            return new Response();
          },
        },
        { name: "posts.comments.show" },
      ),
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
      get(
        "/users/{id}",
        {
          handle() {
            return new Response();
          },
        },
        { name: "users.show" },
      ),
      get(
        "/posts",
        {
          handle() {
            return new Response();
          },
        },
        { name: "posts.index" },
      ),
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

  test("url() throws when no routes configured", () => {
    const app = new ApplicationImpl({});
    app.bootstrap();

    expect(() => app.url("any.route" as never)).toThrow("No routes configured");
  });

  test("handles HTTP request through RouterV2", async () => {
    const routes = get("/hello", {
      handle() {
        return new Response("Hello World");
      },
    });

    const app = new ApplicationImpl({ routes });
    app.bootstrap();

    const request = new Request("http://example.com/hello");
    const context: RequestContext = {
      context: "test",
      getCookie: () => null,
      getCookieNames: () => [],
      deleteCookie: null,
      setCookie: null,
      getRequestHeader: () => null,
      getRequestHeaderNames: () => [][Symbol.iterator](),
    };

    const response = await app.handleRequest(request, context);
    expect(await response.text()).toBe("Hello World");
    expect(response.status).toBe(200);
  });

  test("returns 404 for unmatched routes", async () => {
    const routes = get("/hello", {
      handle() {
        return new Response("Hello");
      },
    });

    const app = new ApplicationImpl({ routes });
    app.bootstrap();

    const request = new Request("http://example.com/notfound");
    const context: RequestContext = {
      context: "test",
      getCookie: () => null,
      getCookieNames: () => [],
      deleteCookie: null,
      setCookie: null,
      getRequestHeader: () => null,
      getRequestHeaderNames: () => [][Symbol.iterator](),
    };

    const response = await app.handleRequest(request, context);
    expect(response.status).toBe(404);
  });
});
