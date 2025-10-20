import { beforeEach, describe, expect, test } from "bun:test";
import { ContainerImpl } from "../container/ContainerImpl";
import type { Container } from "../contracts";
import type { ControllerContext } from "../core/Controller";
import { mockMiddleware } from "../test-utils";
import { apiResource, resource } from "./helpers";
import { group } from "./index";
import { ResourceController } from "./ResourceController";
import { Router } from "./Router";
import { RouteRegistry } from "./RouteRegistry";

let container: Container;
let router: Router;

beforeEach(() => {
  container = new ContainerImpl();
  router = new Router(container);
  mockMiddleware.reset();
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
// ResourceController Action Delegation Tests
// ============================================================================

describe("ResourceController", () => {
  test("action determination - GET / calls index()", async () => {
    router.register(resource("/photos", TestController));

    const response = await handle("/photos", "GET");
    expect(await response.text()).toBe("index");
  });

  test("action determination - GET /create calls create()", async () => {
    router.register(resource("/photos", TestController));

    const response = await handle("/photos/create", "GET");
    expect(await response.text()).toBe("create");
  });

  test("action determination - POST / calls store()", async () => {
    router.register(resource("/photos", TestController));

    const response = await handle("/photos", "POST");
    expect(await response.text()).toBe("store");
  });

  test("action determination - GET /{id} calls show()", async () => {
    router.register(resource("/photos", TestController));

    const response = await handle("/photos/123", "GET");
    expect(await response.text()).toBe("show");
  });

  test("action determination - GET /{id}/edit calls edit()", async () => {
    router.register(resource("/photos", TestController));

    const response = await handle("/photos/123/edit", "GET");
    expect(await response.text()).toBe("edit");
  });

  test("action determination - PUT /{id} calls update()", async () => {
    router.register(resource("/photos", TestController));

    const response = await handle("/photos/123", "PUT");
    expect(await response.text()).toBe("update");
  });

  test("action determination - PATCH /{id} calls update()", async () => {
    router.register(resource("/photos", TestController));

    const response = await handle("/photos/123", "PATCH");
    expect(await response.text()).toBe("update");
  });

  test("action determination - DELETE /{id} calls destroy()", async () => {
    router.register(resource("/photos", TestController));

    const response = await handle("/photos/123", "DELETE");
    expect(await response.text()).toBe("destroy");
  });

  test("default implementations return 404", async () => {
    class EmptyController extends ResourceController {}

    router.register(resource("/empty", EmptyController));

    const indexResponse = await handle("/empty", "GET");
    expect(indexResponse.status).toBe(404);
    expect(await indexResponse.text()).toBe("Not Found");

    const showResponse = await handle("/empty/123", "GET");
    expect(showResponse.status).toBe(404);
  });

  test("overridden methods work correctly, others return 404", async () => {
    class PartialController extends ResourceController {
      override index() {
        return new Response("Custom index", { status: 200 });
      }
    }

    router.register(resource("/partial", PartialController));

    const indexResponse = await handle("/partial", "GET");
    expect(indexResponse.status).toBe(200);
    expect(await indexResponse.text()).toBe("Custom index");

    const createResponse = await handle("/partial/create", "GET");
    expect(createResponse.status).toBe(404);
  });

  test("controller receives correct params", async () => {
    class ParamController extends ResourceController {
      override show(ctx: ControllerContext) {
        return new Response(`ID: ${ctx.params.id}`);
      }
    }

    router.register(resource("/items", ParamController));

    const response = await handle("/items/abc123", "GET");
    expect(await response.text()).toBe("ID: abc123");
  });
});

// ============================================================================
// resource() Helper Tests
// ============================================================================

describe(resource, () => {
  test("creates all 7 resource routes", () => {
    const routes = resource("/photos", TestController);

    // Should have 7 routes (update has both PUT and PATCH)
    expect(routes).toHaveLength(7);

    const methods = routes.map((r) => r.methods).flat();
    expect(methods).toContain("GET");
    expect(methods).toContain("POST");
    expect(methods).toContain("PUT");
    expect(methods).toContain("PATCH");
    expect(methods).toContain("DELETE");
  });

  test("route names use resource name prefix", () => {
    const routes = resource("/photos", TestController);

    const routeNames = routes.map((r) => r.routeName).filter(Boolean);
    expect(routeNames).toContain("photos.index");
    expect(routeNames).toContain("photos.create");
    expect(routeNames).toContain("photos.store");
    expect(routeNames).toContain("photos.show");
    expect(routeNames).toContain("photos.edit");
    expect(routeNames).toContain("photos.update");
    expect(routeNames).toContain("photos.destroy");
  });

  test("custom name override works", () => {
    const routes = resource("/photos", TestController, { name: "pics" });

    const routeNames = routes.map((r) => r.routeName).filter(Boolean);
    expect(routeNames).toContain("pics.index");
    expect(routeNames).toContain("pics.show");
    expect(routeNames).not.toContain("photos.index");
  });

  test("only option filters actions", async () => {
    router.register(resource("/photos", TestController, { only: ["index", "show"] }));

    // Should work for allowed actions
    const indexResponse = await handle("/photos", "GET");
    expect(indexResponse.status).toBe(200);

    const showResponse = await handle("/photos/123", "GET");
    expect(showResponse.status).toBe(200);

    // Should 404 for excluded actions
    const storeResponse = await handle("/photos", "POST");
    expect(storeResponse.status).toBe(404);
  });

  test("except option excludes actions", () => {
    const routes = resource("/photos", TestController, { except: ["destroy"] });

    const routeNames = routes.map((r) => r.routeName).filter(Boolean);
    expect(routeNames).toHaveLength(6);
    expect(routeNames).not.toContain("photos.destroy");
    expect(routeNames).toContain("photos.index");
  });

  test("only and except together - except subtracts from only", () => {
    const routes = resource("/photos", TestController, {
      only: ["index", "show", "destroy"],
      except: ["show"],
    });

    const routeNames = routes.map((r) => r.routeName).filter(Boolean);
    expect(routeNames).toEqual(["photos.index", "photos.destroy"]);
  });

  test("middleware option applies to all routes", async () => {
    const M1 = mockMiddleware("M1");
    router.register(resource("/photos", TestController, { middleware: M1 }));

    await handle("/photos", "GET");
    expect(mockMiddleware.log).toContain("M1");

    mockMiddleware.reset();

    await handle("/photos/123", "GET");
    expect(mockMiddleware.log).toContain("M1");
  });

  test("where constraints apply to {id} parameter", async () => {
    router.register(
      resource("/photos", TestController, {
        where: { id: /^\d+$/ },
      }),
    );

    // Numeric ID should work
    const numericResponse = await handle("/photos/123", "GET");
    expect(numericResponse.status).toBe(200);

    // Non-numeric ID should 404
    const alphaResponse = await handle("/photos/abc", "GET");
    expect(alphaResponse.status).toBe(404);
  });

  test("works inside route groups with name prefix", () => {
    const routes = group({ namePrefix: "admin." }, [resource("/photos", TestController)]);

    const routeNames = routes.map((r) => r.routeName).filter(Boolean);
    expect(routeNames).toContain("admin.photos.index");
    expect(routeNames).toContain("admin.photos.show");
  });

  test("works inside route groups with path prefix", async () => {
    router.register(group({ prefix: "/admin" }, [resource("/photos", TestController)]));

    const response = await handle("/admin/photos", "GET");
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("index");
  });

  test("route paths are correct", () => {
    const routes = resource("/photos", TestController);

    const paths = routes.map((r) => ({ path: r.path, methods: r.methods }));

    expect(paths).toContainEqual({ path: "/photos", methods: ["GET"] });
    expect(paths).toContainEqual({ path: "/photos/create", methods: ["GET"] });
    expect(paths).toContainEqual({ path: "/photos", methods: ["POST"] });
    expect(paths).toContainEqual({ path: "/photos/{id}", methods: ["GET"] });
    expect(paths).toContainEqual({ path: "/photos/{id}/edit", methods: ["GET"] });
    expect(paths).toContainEqual({ path: "/photos/{id}", methods: ["PUT", "PATCH"] });
    expect(paths).toContainEqual({ path: "/photos/{id}", methods: ["DELETE"] });
  });

  test("slashes in path convert to dots in route names", () => {
    const routes = resource("/admin/photos", TestController);

    const routeNames = routes.map((r) => r.routeName).filter(Boolean);
    expect(routeNames).toContain("admin.photos.index");
    expect(routeNames).toContain("admin.photos.show");
    expect(routeNames).toContain("admin.photos.create");
    expect(routeNames).not.toContain("admin/photos.index"); // Should NOT have slashes
  });

  test("multiple slashes convert to multiple dots", () => {
    const routes = resource("/api/v1/users", TestController);

    const routeNames = routes.map((r) => r.routeName).filter(Boolean);
    expect(routeNames).toContain("api.v1.users.index");
    expect(routeNames).toContain("api.v1.users.show");
    expect(routeNames).not.toContain("api/v1/users.index");
  });
});

// ============================================================================
// apiResource() Helper Tests
// ============================================================================

describe(apiResource, () => {
  test("creates only 5 routes (excludes create and edit)", () => {
    const routes = apiResource("/photos", TestController);

    const routeNames = routes.map((r) => r.routeName).filter(Boolean);
    expect(routeNames).toHaveLength(5);
    expect(routeNames).not.toContain("photos.create");
    expect(routeNames).not.toContain("photos.edit");
    expect(routeNames).toContain("photos.index");
    expect(routeNames).toContain("photos.store");
    expect(routeNames).toContain("photos.show");
    expect(routeNames).toContain("photos.update");
    expect(routeNames).toContain("photos.destroy");
  });

  test("apiResource respects only option", () => {
    const routes = apiResource("/photos", TestController, { only: ["index"] });

    const routeNames = routes.map((r) => r.routeName).filter(Boolean);
    expect(routeNames).toHaveLength(1);
    expect(routeNames).toContain("photos.index");
  });

  test("/create matches /{id} with id='create' when using apiResource", async () => {
    router.register(apiResource("/photos", TestController));

    // Since /create route is not registered, /photos/create matches /photos/{id}
    const response = await handle("/photos/create", "GET");
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("show"); // Calls show() with id='create'
  });

  test("/{id}/edit matches /{id} with apiResource (no dedicated edit route)", async () => {
    router.register(apiResource("/photos", TestController));

    // Since /photos/{id}/edit is not registered with apiResource,
    // /photos/123/edit will match /photos/{id} with id='123'
    // and the path won't match the show pattern, so it returns show
    const response = await handle("/photos/123/edit", "GET");
    expect(response.status).toBe(404); // No route matches this pattern in apiResource
  });
});

// ============================================================================
// Type Tests
// ============================================================================

describe("resource type inference", () => {
  test("routes work with RouteRegistry", () => {
    const registry = new RouteRegistry(resource("/photos", TestController));

    // These should compile and work at runtime:
    const url1 = registry.url("photos.index");
    const url2 = registry.url("photos.show", { id: "123" });

    expect(url1).toContain("/photos");
    expect(url2).toContain("/photos/123");
  });

  test("custom name works with RouteRegistry", () => {
    const registry = new RouteRegistry(resource("/photos", TestController, { name: "pics" }));

    // Should be able to use custom route names:
    const url = registry.url("pics.index");
    expect(url).toContain("/photos");
  });

  test("apiResource works with RouteRegistry", () => {
    const registry = new RouteRegistry(apiResource("/photos", TestController));

    // These should compile and work:
    const url1 = registry.url("photos.index");
    const url2 = registry.url("photos.show", { id: "123" });

    expect(url1).toContain("/photos");
    expect(url2).toContain("/photos/123");
  });
});

class TestController extends ResourceController {
  override index() {
    return new Response("index");
  }
  override create() {
    return new Response("create");
  }
  override store() {
    return new Response("store");
  }
  override show() {
    return new Response("show");
  }
  override edit() {
    return new Response("edit");
  }
  override update() {
    return new Response("update");
  }
  override destroy() {
    return new Response("destroy");
  }
}
