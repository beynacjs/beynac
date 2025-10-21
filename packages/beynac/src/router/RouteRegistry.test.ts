import { describe, expect, expectTypeOf, test } from "bun:test";
import { MockController } from "../test-utils";
import { get, group, resource } from "./helpers";
import { ResourceController } from "./ResourceController";
import type { Routes } from "./router-types";
import { RouteRegistry } from "./RouteRegistry";

describe("route URL generation", () => {
  test("generates URL for named route without parameters", () => {
    const route = get("/users", MockController, { name: "users.index" });

    const registry = new RouteRegistry(route);

    expect(registry.url("users.index")).toBe("/users");
  });

  test("generates URL for named route with parameters", () => {
    const route = get("/users/{id}", MockController, { name: "users.show" });

    const registry = new RouteRegistry(route);

    expect(registry.url("users.show", { id: 123 })).toBe("/users/123");
    expect(registry.url("users.show", { id: "abc" })).toBe("/users/abc");
  });

  test("generates URL for route with multiple parameters", () => {
    const route = get("/posts/{postId}/comments/{commentId}", MockController, {
      name: "posts.comments.show",
    });

    const registry = new RouteRegistry(route);

    expect(registry.url("posts.comments.show", { postId: 42, commentId: 7 })).toBe(
      "/posts/42/comments/7",
    );
  });

  test("throws error for non-existent route name", () => {
    const route = get("/users", MockController, { name: "users.index" });

    const registry = new RouteRegistry(route);

    expect(() => registry.url("non.existent" as any)).toThrow('Route "non.existent" not found');
  });

  test("generates URLs for routes in groups with namePrefix", () => {
    const routes = group({ prefix: "/admin", namePrefix: "admin." }, [
      get("/dashboard", MockController, { name: "dashboard" }),
      get("/users/{id}", MockController, { name: "users.show" }),
    ]);

    const registry = new RouteRegistry(routes);

    expect(registry.url("admin.dashboard")).toBe("/admin/dashboard");
    expect(registry.url("admin.users.show", { id: 456 })).toBe("/admin/users/456");
  });

  test("generates URLs for routes in nested groups", () => {
    const userRoutes = group({ prefix: "/users", namePrefix: "users." }, [
      get("/", MockController, { name: "index" }),
      get("/{id}", MockController, { name: "show" }),
    ]);

    const apiRoutes = group({ prefix: "/api", namePrefix: "api." }, [userRoutes]);

    const registry = new RouteRegistry(apiRoutes);

    expect(registry.url("api.users.index")).toBe("/api/users");
    expect(registry.url("api.users.show", { id: 789 })).toBe("/api/users/789");
  });

  test("generates protocol-relative URL for routes with static domain", () => {
    const route = get("/users/{id}", MockController, {
      name: "users.show",
      domain: "api.example.com",
    });

    const registry = new RouteRegistry(route);

    expect(registry.url("users.show", { id: 123 })).toBe("//api.example.com/users/123");
  });

  test("generates protocol-relative URL with domain parameters", () => {
    const route = get("/users/{id}", MockController, {
      name: "users.show",
      domain: "{account}.example.com",
    });

    const registry = new RouteRegistry(route);

    expect(registry.url("users.show", { account: "acme", id: 123 })).toBe(
      "//acme.example.com/users/123",
    );
  });

  test("uses same param in both domain and path", () => {
    const route = get("/orgs/{org}/users", MockController, {
      name: "users.index",
      domain: "{org}.example.com",
    });

    const registry = new RouteRegistry(route);

    expect(registry.url("users.index", { org: "acme" })).toBe("//acme.example.com/orgs/acme/users");
  });

  test("wildcard URL generation", () => {
    const route = get("/files/{...path}", MockController, { name: "files.show" });

    const registry = new RouteRegistry(route);

    expect(registry.url("files.show", { path: "document.pdf" })).toBe("/files/document.pdf");
    expect(registry.url("files.show", { path: "docs/2024/report.pdf" })).toBe(
      "/files/docs%2F2024%2Freport.pdf",
    );
  });

  test("wildcard with regular params URL generation", () => {
    const route = get("/users/{userId}/files/{...path}", MockController, { name: "users.files" });

    const registry = new RouteRegistry(route);

    expect(registry.url("users.files", { userId: 123, path: "photos/pic.jpg" })).toBe(
      "/users/123/files/photos%2Fpic.jpg",
    );
  });

  test("encodes slashes in parameters", () => {
    const route = get("/foo/{param}/quux", MockController, { name: "test.route" });

    const registry = new RouteRegistry(route);

    expect(registry.url("test.route", { param: "bar/baz" })).toBe("/foo/bar%2Fbaz/quux");
  });

  test("encodes special characters in parameters", () => {
    const route = get("/posts/{postId}/comments/{commentId}", MockController, {
      name: "posts.comments.show",
    });

    const registry = new RouteRegistry(route);

    expect(
      registry.url("posts.comments.show", { postId: "hello world", commentId: "foo&bar" }),
    ).toBe("/posts/hello%20world/comments/foo%26bar");
    expect(registry.url("posts.comments.show", { postId: "test?", commentId: "foo#bar" })).toBe(
      "/posts/test%3F/comments/foo%23bar",
    );
  });

  test("encodes wildcard parameters", () => {
    const route = get("/files/{...path}", MockController, { name: "files.show" });

    const registry = new RouteRegistry(route);

    expect(registry.url("files.show", { path: "docs/2024/report.pdf" })).toBe(
      "/files/docs%2F2024%2Freport.pdf",
    );
  });

  test("encodes domain parameters", () => {
    const route = get("/users/{id}", MockController, {
      name: "user.show",
      domain: "{tenant}.example.com",
    });

    const registry = new RouteRegistry(route);

    expect(registry.url("user.show", { tenant: "hello world", id: 123 })).toBe(
      "//hello%20world.example.com/users/123",
    );
  });

  test("generates URL for mixed params with prefix", () => {
    const route = get("/npm/@{scope}/{package}", MockController, { name: "npm.package" });

    const registry = new RouteRegistry(route);

    expect(registry.url("npm.package", { scope: "vue", package: "router" })).toBe(
      "/npm/@vue/router",
    );
  });

  test("generates URL for mixed params with suffix", () => {
    const route = get("/files/{id}.txt", MockController, { name: "files.text" });

    const registry = new RouteRegistry(route);

    expect(registry.url("files.text", { id: "123" })).toBe("/files/123.txt");
  });

  test("generates URL for mixed params with multiple params in segment", () => {
    const route = get("/files/{id},name={name}.txt", MockController, { name: "files.named" });

    const registry = new RouteRegistry(route);

    expect(registry.url("files.named", { id: "123", name: "report" })).toBe(
      "/files/123,name=report.txt",
    );
  });

  test("generates URL for mixed params in domain", () => {
    const route = get("/status", MockController, {
      name: "api.status",
      domain: "api-{version}.example.com",
    });

    const registry = new RouteRegistry(route);

    expect(registry.url("api.status", { version: "v2" })).toBe("//api-v2.example.com/status");
  });

  test("encodes special characters in mixed params", () => {
    const route = get("/npm/@{scope}/{package}", MockController, { name: "npm.package" });

    const registry = new RouteRegistry(route);

    expect(registry.url("npm.package", { scope: "my scope", package: "pkg&test" })).toBe(
      "/npm/@my%20scope/pkg%26test",
    );
  });
});

// ============================================================================
// RouteRegistry Typed Method
// ============================================================================

describe("RouteRegistry typed method", () => {
  test("generates URL for route without parameters", () => {
    const routes = group({ namePrefix: "users." }, [
      get("/users", MockController, { name: "index" }),
    ]);

    const registry = new RouteRegistry(routes);

    expect(registry.url("users.index")).toBe("/users");
  });

  test("generates URL for route with single parameter", () => {
    const routes = group({ namePrefix: "users." }, [
      get("/users/{id}", MockController, { name: "show" }),
    ]);

    const registry = new RouteRegistry(routes);

    expect(registry.url("users.show", { id: 123 })).toBe("/users/123");
    expect(registry.url("users.show", { id: "abc" })).toBe("/users/abc");
  });

  test("generates URL for route with multiple parameters", () => {
    const routes = group({ namePrefix: "posts." }, [
      get("/posts/{postId}/comments/{commentId}", MockController, { name: "comments" }),
    ]);

    const registry = new RouteRegistry(routes);

    expect(registry.url("posts.comments", { postId: 42, commentId: 7 })).toBe(
      "/posts/42/comments/7",
    );
  });

  test("works with nested groups", () => {
    const userRoutes = group({ prefix: "/users", namePrefix: "users." }, [
      get("/", MockController, { name: "index" }),
      get("/{id}", MockController, { name: "show" }),
    ]);

    const apiRoutes = group({ prefix: "/api", namePrefix: "api." }, [userRoutes]);

    const registry = new RouteRegistry(apiRoutes);

    expect(registry.url("api.users.index")).toBe("/api/users");
    expect(registry.url("api.users.show", { id: 789 })).toBe("/api/users/789");
  });

  test("throws error for non-existent route name", () => {
    const routes = group({ namePrefix: "users." }, [
      get("/users", MockController, { name: "index" }),
    ]);

    const registry = new RouteRegistry(routes);

    expect(() => registry.url("users.nonexistent" as any)).toThrow(
      'Route "users.nonexistent" not found',
    );
  });

  // ============================================================================
  // Type Safety Tests
  // ============================================================================

  test("type inference: route without parameters", () => {
    const routes = group({ namePrefix: "users." }, [
      get("/users", MockController, { name: "index" }),
    ]);

    // Should infer never for no params
    expectTypeOf(routes).toMatchTypeOf<Routes<{ "users.index": never }>>();

    // This should compile
    const registry = new RouteRegistry(routes);
    registry.url("users.index");
  });

  test("type inference: route with single parameter", () => {
    const routes = group({ namePrefix: "users." }, [
      get("/users/{id}", MockController, { name: "show" }),
    ]);

    // Should infer "id" param name
    expectTypeOf(routes).toMatchTypeOf<Routes<{ "users.show": "id" }>>();

    // These should compile
    const registry = new RouteRegistry(routes);
    registry.url("users.show", { id: "123" });
    registry.url("users.show", { id: 456 });
  });

  test("type inference: route with multiple parameters", () => {
    const routes = group({ namePrefix: "posts." }, [
      get("/posts/{postId}/comments/{commentId}", MockController, { name: "comments" }),
    ]);

    // Should infer both param names as union
    expectTypeOf(routes).toMatchTypeOf<Routes<{ "posts.comments": "postId" | "commentId" }>>();

    // This should compile
    const registry = new RouteRegistry(routes);
    registry.url("posts.comments", { postId: "1", commentId: "2" });
  });

  test("type inference: multiple routes with different params", () => {
    const routes = group({ namePrefix: "users." }, [
      get("/users", MockController, { name: "index" }),
      get("/users/{id}", MockController, { name: "show" }),
      get("/users/{id}/posts/{postId}", MockController, { name: "posts" }),
    ]);

    // Should infer all route names and their param unions
    expectTypeOf(routes).toMatchTypeOf<
      Routes<{
        "users.index": never;
        "users.show": "id";
        "users.posts": "id" | "postId";
      }>
    >();

    // All these should compile
    const registry = new RouteRegistry(routes);
    registry.url("users.index");
    registry.url("users.show", { id: "123" });
    registry.url("users.posts", { id: "1", postId: "2" });
  });

  test("type inference: nested groups propagate name prefix", () => {
    const userRoutes = group({ prefix: "/users", namePrefix: "users." }, [
      get("/", MockController, { name: "index" }),
      get("/{id}", MockController, { name: "show" }),
    ]);

    const apiRoutes = group({ prefix: "/api", namePrefix: "api." }, [userRoutes]);

    // Should infer prefixed names and params
    expectTypeOf(apiRoutes).toMatchTypeOf<
      Routes<{
        "api.users.index": never;
        "api.users.show": "id";
      }>
    >();

    // These should compile
    const registry = new RouteRegistry(apiRoutes);
    registry.url("api.users.index");
    registry.url("api.users.show", { id: "789" });
  });

  test("type inference: mixed groups and routes", () => {
    const postRoutes = group({ namePrefix: "posts." }, [
      get("/posts", MockController, { name: "index" }),
      get("/posts/{id}", MockController, { name: "show" }),
    ]);

    const routes = group({ namePrefix: "admin." }, [
      get("/dashboard", MockController, { name: "dashboard" }),
      postRoutes,
    ]);

    // Should merge both direct routes and nested group routes
    expectTypeOf(routes).toMatchTypeOf<
      Routes<{
        "admin.dashboard": never;
        "admin.posts.index": never;
        "admin.posts.show": "id";
      }>
    >();

    // All these should compile
    const registry = new RouteRegistry(routes);
    registry.url("admin.dashboard");
    registry.url("admin.posts.index");
    registry.url("admin.posts.show", { id: "123" });
  });

  test("resource routes with slash-to-dot conversion", () => {
    class TestController extends ResourceController {}

    const routes = resource("/admin/photos", TestController);

    // Runtime URL generation should work
    const registry = new RouteRegistry(routes);
    expect(registry.url("admin.photos.index")).toBe("/admin/photos");
    expect(registry.url("admin.photos.show", { resourceId: "123" })).toBe("/admin/photos/123");
  });

  test("resource routes with multiple slashes convert to dots", () => {
    class TestController extends ResourceController {}

    const routes = resource("/api/v1/users", TestController);

    const registry = new RouteRegistry(routes);
    expect(registry.url("api.v1.users.index")).toBe("/api/v1/users");
    expect(registry.url("api.v1.users.show", { resourceId: "42" })).toBe("/api/v1/users/42");
  });

  test("domain routing URL generation", () => {
    const route = get("/users/{id}", MockController, {
      name: "users.show",
      domain: "{subdomain}.example.com",
    });

    const registry = new RouteRegistry(route);

    expect(registry.url("users.show", { subdomain: "acme", id: 123 })).toBe(
      "//acme.example.com/users/123",
    );
  });

  test("generates URL with both domain and path params", () => {
    const route = get("/users/{id}", MockController, {
      name: "users.show",
      domain: "{subdomain}.example.com",
    });

    const registry = new RouteRegistry(route);

    expect(registry.url("users.show", { subdomain: "widgets", id: 456 })).toBe(
      "//widgets.example.com/users/456",
    );
  });
});
