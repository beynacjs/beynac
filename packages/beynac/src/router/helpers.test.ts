import { describe, expect, expectTypeOf, test } from "bun:test";
import { controller } from "../test-utils";
import { get, group, type Routes } from "./index";

test("type inference for named routes", () => {
  // Type inference only works when name is set at creation time
  const route2 = get("/posts", controller(), { name: "posts.index" });

  expectTypeOf(route2).toEqualTypeOf<Routes<{ "posts.index": never }>>();
});

test("applies namePrefix to route names", () => {
  const routes = group({ namePrefix: "admin." }, [
    get("/dashboard", controller(), { name: "dashboard" }),
    get("/users", controller(), { name: "users" }),
  ]);

  expectTypeOf(routes).toEqualTypeOf<Routes<{ "admin.dashboard": never; "admin.users": never }>>();
});

test("throws error when child route has different domain than parent group", () => {
  expect(() => {
    group({ domain: "api.example.com" }, [
      get("/users", controller(), { domain: "admin.example.com" }),
    ]);
  }).toThrow(/Domain conflict/);
});

test("allows same domain on parent group and child route", () => {
  expect(() => {
    group({ domain: "api.example.com" }, [
      get("/users", controller(), { domain: "api.example.com" }),
    ]);
  }).not.toThrow();
});

test("allows child without domain when parent has domain", () => {
  expect(() => {
    group({ domain: "api.example.com" }, [get("/users", controller())]);
  }).not.toThrow();
});

test("group without options parameter", () => {
  const routes = group([
    get(
      "/dashboard/{page}",
      {
        handle() {
          return new Response();
        },
      },
      { name: "dashboard" },
    ),
  ]);

  // Verify it creates a valid Routes object
  expect(routes).toHaveLength(1);
  expect(routes[0].path).toBe("/dashboard/{page}");
  expect(routes[0].routeName).toBe("dashboard");

  // Type inference should work
  expectTypeOf(routes).toEqualTypeOf<Routes<{ dashboard: "page" }>>();
});

test("strips trailing slash from group prefix", () => {
  const routes = group({ prefix: "/api/" }, [get("/users", controller())]);
  expect(routes[0].path).toBe("/api/users");
});

describe("wildcard routes", () => {
  test("type inference for named wildcards", () => {
    const route = get("/files/{...path}", controller(), { name: "files" });

    // Should infer "path" param name
    expectTypeOf(route).toEqualTypeOf<Routes<{ files: "path" }>>();
  });

  test("type inference for wildcard with regular params", () => {
    const route = get("/users/{userId}/files/{...path}", controller(), {
      name: "users.files",
    });

    // Should infer both param names
    expectTypeOf(route).toEqualTypeOf<Routes<{ "users.files": "userId" | "path" }>>();
  });
});

describe("validation", () => {
  function expectPathToThrow(path: string, messageContains?: string) {
    const fn = () => get(path, controller());
    expect(fn).toThrow(messageContains);
  }

  function expectDomainToThrow(domain: string, messageContains?: string) {
    const fn = () => get("/users", controller(), { domain });
    expect(fn).toThrow(messageContains);
  }

  test("rejects asterisk characters in paths", () => {
    expectPathToThrow(
      "/api/**",
      'Route path "/api/**" contains asterisk characters. Use {...param} for wildcard routes instead of ** or *.',
    );
  });

  test("rejects partial segment parameters with text before", () => {
    expectPathToThrow(
      "/foo/x{param}",
      'Route path "/foo/x{param}" has invalid parameter syntax. Parameters must capture whole path segments',
    );
  });

  test("rejects partial segment parameters with text after", () => {
    expectPathToThrow(
      "/foo/{param}x",
      'Route path "/foo/{param}x" has invalid parameter syntax. Parameters must capture whole path segments',
    );
  });

  test("rejects partial segment parameters in domains with text before", () => {
    expectDomainToThrow(
      "my-{param}.example.com",
      'Route path "my-{param}.example.com" has invalid parameter syntax. Parameters must capture whole path segments',
    );
  });

  test("rejects partial segment parameters in domains with text after", () => {
    expectDomainToThrow(
      "{param}x.example.com",
      'Route path "{param}x.example.com" has invalid parameter syntax. Parameters must capture whole path segments',
    );
  });

  test("rejects partial segment parameters mid-path", () => {
    expectPathToThrow(
      "/x{param}/bar",
      'Route path "/x{param}/bar" has invalid parameter syntax. Parameters must capture whole path segments',
    );
  });

  test("rejects partial segment wildcard parameters", () => {
    expectPathToThrow(
      "/files/prefix{...path}",
      'Route path "/files/prefix{...path}" has invalid parameter syntax. Parameters must capture whole path segments',
    );
  });

  test("rejects invalid curly brace patterns", () => {
    expectPathToThrow("/{param", 'Route path "/{param" contains invalid curly braces');

    expectPathToThrow("/param}", 'Route path "/param}" contains invalid curly braces');

    expectPathToThrow("/foo/}{param}/", 'Route path "/foo/}{param}/" has invalid parameter syntax');

    expectPathToThrow(
      "/{{param}}",
      'Route path "/{{param}}" has invalid parameter syntax. Parameters must capture whole path segments',
    );

    expectPathToThrow("/foo/{}/bar", 'Route path "/foo/{}/bar" contains invalid curly braces');

    expectPathToThrow("/{ param}", 'Route path "/{ param}" contains invalid curly braces');

    expectPathToThrow(
      "/foo/{param}/bar/}",
      'Route path "/foo/{param}/bar/}" contains invalid curly braces',
    );

    expectPathToThrow("/{...param", 'Route path "/{...param" contains invalid curly braces');

    expectDomainToThrow(
      "{tenant.example.com",
      'Route path "{tenant.example.com" contains invalid curly braces',
    );

    expectDomainToThrow(
      "tenant}.example.com",
      'Route path "tenant}.example.com" contains invalid curly braces',
    );
  });

  test("rejects route paths not starting with slash", () => {
    expectPathToThrow("foo", 'Route path "foo" must start with "/"');
  });

  test("rejects group prefix not starting with slash", () => {
    expect(() => {
      group({ prefix: "api" }, [get("/users", controller())]);
    }).toThrow('Group prefix "api" must start with "/".');
  });

  test("rejects wildcard in middle of path", () => {
    expectPathToThrow(
      "/foo/{...params}/bar",
      'Route path "/foo/{...params}/bar" has wildcard parameter in non-terminal position',
    );
  });

  test("rejects wildcard before parameter", () => {
    expectPathToThrow(
      "/foo/{...params}/{id}",
      'Route path "/foo/{...params}/{id}" has wildcard parameter in non-terminal position',
    );
  });

  test("rejects wildcard in group prefix", () => {
    expect(() => {
      group({ prefix: "/files/{...path}" }, [get("/", controller())]);
    }).toThrow(
      'Group prefix "/files/{...path}" contains a wildcard parameter. Wildcards are not allowed in group prefixes',
    );
  });

  test("rejects wildcard at start of domain", () => {
    expectDomainToThrow(
      "{...tenant}.example.com",
      'Domain "{...tenant}.example.com" contains a wildcard parameter. Wildcards are not allowed in domains',
    );
  });

  test("rejects wildcard in middle of domain", () => {
    expectDomainToThrow(
      "{tenant}.{...path}.example.com",
      'Domain "{tenant}.{...path}.example.com" contains a wildcard parameter. Wildcards are not allowed in domains',
    );
  });

  test("rejects wildcard at end of domain", () => {
    expectDomainToThrow(
      "example.{...path}",
      'Domain "example.{...path}" contains a wildcard parameter. Wildcards are not allowed in domains',
    );
  });

  test("rejects wildcard in group domain", () => {
    expect(() => {
      group({ domain: "{...tenant}.example.com" }, [get("/users", controller())]);
    }).toThrow(
      'Domain "{...tenant}.example.com" contains a wildcard parameter. Wildcards are not allowed in domains',
    );
  });

  test("allows valid parameter syntax", () => {
    expect(() => {
      get("/users/{id}", controller());
    }).not.toThrow();

    expect(() => {
      get("/files/{...path}", controller());
    }).not.toThrow();

    expect(() => {
      get("/users", controller(), { domain: "{tenant}.example.com" });
    }).not.toThrow();
  });
});
