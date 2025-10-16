import { describe, expect, expectTypeOf, test } from "bun:test";
import { get, group, type Routes } from "./index";

// ============================================================================
// Named Routes
// ============================================================================

describe("named routes", () => {
  test("type inference for named routes", () => {
    // Type inference only works when name is set at creation time
    const route2 = get(
      "/posts",
      {
        handle() {
          return new Response();
        },
      },
      { name: "posts.index" },
    );

    expectTypeOf(route2).toEqualTypeOf<Routes<{ "posts.index": never }>>();
  });
});

// ============================================================================
// Route Groups
// ============================================================================

describe("route groups", () => {
  test("applies namePrefix to route names", () => {
    const routes = group({ namePrefix: "admin." }, [
      get(
        "/dashboard",
        {
          handle() {
            return new Response();
          },
        },
        { name: "dashboard" },
      ),
      get(
        "/users",
        {
          handle() {
            return new Response();
          },
        },
        { name: "users" },
      ),
    ]);

    expectTypeOf(routes).toEqualTypeOf<
      Routes<{ "admin.dashboard": never; "admin.users": never }>
    >();
  });

  test("throws error when child route has different domain than parent group", () => {
    expect(() => {
      group({ domain: "api.example.com" }, [
        get(
          "/users",
          {
            handle() {
              return new Response();
            },
          },
          { domain: "admin.example.com" },
        ),
      ]);
    }).toThrow(/Domain conflict/);
  });

  test("allows same domain on parent group and child route", () => {
    expect(() => {
      group({ domain: "api.example.com" }, [
        get(
          "/users",
          {
            handle() {
              return new Response();
            },
          },
          { domain: "api.example.com" },
        ),
      ]);
    }).not.toThrow();
  });

  test("allows child without domain when parent has domain", () => {
    expect(() => {
      group({ domain: "api.example.com" }, [
        get("/users", {
          handle() {
            return new Response();
          },
        }),
      ]);
    }).not.toThrow();
  });
});

// ============================================================================
// Wildcard Routes
// ============================================================================

describe("wildcard routes", () => {
  test("type inference for named wildcards", () => {
    const route = get(
      "/files/{...path}",
      {
        handle() {
          return new Response();
        },
      },
      { name: "files" },
    );

    // Should infer "path" param name
    expectTypeOf(route).toEqualTypeOf<Routes<{ files: "path" }>>();
  });

  test("type inference for wildcard with regular params", () => {
    const route = get(
      "/users/{userId}/files/{...path}",
      {
        handle() {
          return new Response();
        },
      },
      { name: "users.files" },
    );

    // Should infer both param names
    expectTypeOf(route).toEqualTypeOf<Routes<{ "users.files": "userId" | "path" }>>();
  });

  test("wildcard in group prefix throws error for non-empty child paths", () => {
    expect(() => {
      group({ prefix: "/files/{...path}" }, [
        get("/view", {
          handle() {
            return new Response();
          },
        }),
      ]);
    }).toThrow(
      'Route "/view" will never match because its parent group has a wildcard "/files/{...path}". All routes within a wildcard group must have empty paths.',
    );

    expect(() => {
      group({ prefix: "/api/**" }, [
        get("/action", {
          handle() {
            return new Response();
          },
        }),
      ]);
    }).toThrow(
      'Route path "/api/**" contains asterisk characters. Use {...param} for wildcard routes instead of ** or *.',
    );
  });
});
