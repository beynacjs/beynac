import { describe, expect, test } from "bun:test";
import { get, group } from "./helpers";

// ============================================================================
// Route Syntax Validation Tests
// ============================================================================

describe("route syntax validation", () => {
  test("rejects asterisk characters in paths", () => {
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

  test("rejects partial segment parameters with text before", () => {
    expect(() => {
      get("/foo/x{param}", {
        handle() {
          return new Response();
        },
      });
    }).toThrow(
      'Route path "/foo/x{param}" has invalid parameter syntax. Parameters must capture whole path segments, not partial segments. Use /{param}/ not /text{param}/.',
    );
  });

  test("rejects partial segment parameters with text after", () => {
    expect(() => {
      get("/foo/{param}x", {
        handle() {
          return new Response();
        },
      });
    }).toThrow(
      'Route path "/foo/{param}x" has invalid parameter syntax. Parameters must capture whole path segments, not partial segments. Use /{param}/ not /{param}text/.',
    );
  });

  test("rejects partial segment parameters in domains with text before", () => {
    expect(() => {
      get(
        "/users",
        {
          handle() {
            return new Response();
          },
        },
        { domain: "my-{param}.example.com" },
      );
    }).toThrow(
      'Route path "my-{param}.example.com" has invalid parameter syntax. Parameters must capture whole path segments, not partial segments. Use /{param}/ not /text{param}/.',
    );
  });

  test("rejects partial segment parameters in domains with text after", () => {
    expect(() => {
      get(
        "/users",
        {
          handle() {
            return new Response();
          },
        },
        { domain: "{param}x.example.com" },
      );
    }).toThrow(
      'Route path "{param}x.example.com" has invalid parameter syntax. Parameters must capture whole path segments, not partial segments. Use /{param}/ not /{param}text/.',
    );
  });

  test("rejects partial segment parameters mid-path", () => {
    expect(() => {
      get("/x{param}/bar", {
        handle() {
          return new Response();
        },
      });
    }).toThrow(
      'Route path "/x{param}/bar" has invalid parameter syntax. Parameters must capture whole path segments, not partial segments. Use /{param}/ not /text{param}/.',
    );
  });

  test("rejects partial segment wildcard parameters", () => {
    expect(() => {
      get("/files/prefix{...path}", {
        handle() {
          return new Response();
        },
      });
    }).toThrow(
      'Route path "/files/prefix{...path}" has invalid parameter syntax. Parameters must capture whole path segments, not partial segments. Use /{param}/ not /text{param}/.',
    );
  });
});

// ============================================================================
// Curly Brace Validation
// ============================================================================

describe("curly brace validation", () => {
  // Helper function to test that a path throws an error related to braces/parameters
  function expectPathToThrow(path: string) {
    expect(() => {
      get(path, {
        handle() {
          return new Response();
        },
      });
    }).toThrow();
  }

  // Helper function to test that a domain throws an error related to braces/parameters
  function expectDomainToThrow(domain: string) {
    expect(() => {
      get(
        "/users",
        {
          handle() {
            return new Response();
          },
        },
        { domain },
      );
    }).toThrow();
  }

  test("rejects invalid curly brace patterns", () => {
    // Opening brace without closing
    expectPathToThrow("/{param");

    // Closing brace without opening
    expectPathToThrow("/param}");

    // Wrong order braces
    expectPathToThrow("/foo/}{param}/");

    // Nested braces
    expectPathToThrow("/{{param}}");

    // Empty braces
    expectPathToThrow("/foo/{}/bar");

    // Space inside braces
    expectPathToThrow("/{ param}");

    // Trailing brace after parameters removed
    expectPathToThrow("/foo/{param}/bar/}");

    // Mismatched wildcard braces
    expectPathToThrow("/{...param");

    // Unmatched brace in domain (opening)
    expectDomainToThrow("{tenant.example.com");

    // Unmatched brace in domain (closing)
    expectDomainToThrow("tenant}.example.com");
  });

  test("allows valid parameter syntax", () => {
    expect(() => {
      get("/users/{id}", {
        handle() {
          return new Response();
        },
      });
    }).not.toThrow();

    expect(() => {
      get("/files/{...path}", {
        handle() {
          return new Response();
        },
      });
    }).not.toThrow();

    expect(() => {
      get(
        "/users",
        {
          handle() {
            return new Response();
          },
        },
        { domain: "{tenant}.example.com" },
      );
    }).not.toThrow();
  });
});
