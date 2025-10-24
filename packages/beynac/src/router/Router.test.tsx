/** @jsxImportSource ../view */
import { beforeEach, describe, expect, expectTypeOf, mock, spyOn, test } from "bun:test";
import { ContainerImpl } from "../container/ContainerImpl";
import { createTypeToken } from "../container/container-key";
import { Container } from "../contracts";
import { MockController, mockController, mockMiddleware } from "../test-utils";
import { NoArgConstructor } from "../utils";
import { Controller, type ControllerContext, ControllerReturn } from "./Controller";
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
	RouteRegistry,
	Router,
	type Routes,
	redirect,
} from "./index";
import type { Middleware } from "./Middleware";
import { MiddlewareSet } from "./MiddlewareSet";

let container: Container;
let router: Router;
let controller: MockController;

beforeEach(() => {
	container = new ContainerImpl();
	router = new Router(container);
	controller = new MockController();
	// Bind the controller instance so routes using MockController class get this instance
	container.bind(MockController, { instance: controller });
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
// Basic Route Registration
// ============================================================================

test("handles basic GET route", async () => {
	router.register(get("/hello", MockController));
	await handle("/hello");
	expect(controller.handle).toHaveBeenCalledTimes(1);
});

test("handles POST route", async () => {
	router.register(post("/submit", MockController));
	await handle("/submit", "POST");
	expect(controller.handle).toHaveBeenCalledTimes(1);
});

test("handles PUT route", async () => {
	router.register(put("/update", MockController));
	await handle("/update", "PUT");
	expect(controller.handle).toHaveBeenCalledTimes(1);
});

test("handles PATCH route", async () => {
	router.register(patch("/patch", MockController));
	await handle("/patch", "PATCH");
	expect(controller.handle).toHaveBeenCalledTimes(1);
});

test("handles DELETE route", async () => {
	router.register(delete_("/delete", MockController));
	await handle("/delete", "DELETE");
	expect(controller.handle).toHaveBeenCalledTimes(1);
});

test("handles OPTIONS route", async () => {
	router.register(options("/cors", MockController));
	await handle("/cors", "OPTIONS");
	expect(controller.handle).toHaveBeenCalledTimes(1);
});

test("handles route parameters", async () => {
	router.register(get("/user/{id}", MockController));
	await handle("/user/123");
	expect(controller.params).toEqual({ id: "123" });
});

test("handles route parameters starting with digits", async () => {
	router.register(get("/item/{0id}/detail/{1name}", MockController));
	await handle("/item/abc123/detail/xyz789");
	expect(controller.params).toEqual({ "0id": "abc123", "1name": "xyz789" });
});

test("handles multiple route parameters", async () => {
	router.register(get("/posts/{postId}/comments/{commentId}", MockController));
	await handle("/posts/42/comments/7");
	expect(controller.params).toEqual({ postId: "42", commentId: "7" });
});

test("returns 404 for unmatched route", async () => {
	router.register(get("/hello", MockController));
	const response = await handle("/notfound");
	expect(response.status).toBe(404);
});

test("trailing slashes are ignored for matching", async () => {
	router.register(get("/users", MockController));

	await handle("/users");
	expect(controller.handle).toHaveBeenCalledTimes(1);

	controller.handle.mockClear();

	await handle("/users/");
	expect(controller.handle).toHaveBeenCalledTimes(1);
});

test("route defined with trailing slash matches path without trailing slash", async () => {
	router.register(get("/posts/", MockController));

	await handle("/posts/");
	expect(controller.handle).toHaveBeenCalledTimes(1);

	controller.handle.mockClear();

	await handle("/posts");
	expect(controller.handle).toHaveBeenCalledTimes(1);
});

test("handles controller class", async () => {
	class TestController extends Controller {
		handle(): Response {
			return new Response("From controller class");
		}
	}

	router.register(get("/test", TestController));

	const response = await handle("/test");
	expect(await response.text()).toBe("From controller class");
});

test("controller can return JSX", async () => {
	const jsxController = (ctx: ControllerContext) => {
		return <div>Hello from JSX, id: {ctx.params.id}</div>;
	};

	router.register(get("/jsx/{id}", jsxController));

	const response = await handle("/jsx/123");
	expect(await response.text()).toBe("<div>Hello from JSX, id: 123</div>");
});

test("controller class can use dependency injection", async () => {
	const messageKey = createTypeToken<string>();
	container.bind(messageKey, { instance: "injected message" });

	class InjectedController extends Controller {
		constructor(private message: string = container.get(messageKey)) {
			super();
		}

		handle(): Response {
			return new Response(this.message);
		}
	}

	router.register(get("/hello", InjectedController));

	const response = await handle("/hello");
	expect(await response.text()).toBe("injected message");
});

test("handles async controller", async () => {
	router.register(get("/async", MockController));
	await handle("/async");
	expect(controller.handle).toHaveBeenCalledTimes(1);
});

describe("middleware", () => {
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

		router.register(
			get("/test/{page}", MockController, {
				name: "test",
				middleware: TestMiddleware,
			}),
		);

		await handle("/test/foo");
		expect(handleMock).toHaveBeenCalledTimes(1);
	});

	test("executes multiple middleware in correct order", async () => {
		const middleware0 = mockMiddleware("m0");

		const middleware1 = mockMiddleware("m1");

		const middleware2 = mockMiddleware("m2");

		router.register(
			group({ middleware: middleware0 }, [
				get(
					"/test",
					() => {
						mockMiddleware.beforeAfterLog.push("handler");
						return new Response("OK");
					},
					{ middleware: [middleware1, middleware2] },
				),
			]),
		);

		await handle("/test");
		expect(mockMiddleware.beforeAfterLog).toEqual([
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
		const M1 = mockMiddleware("M1");
		const M2 = mockMiddleware("M2");

		router.register(
			group(
				{
					middleware: [M1, M2],
				},
				[
					get("/test", MockController, {
						withoutMiddleware: M1,
					}),
				],
			),
		);

		await handle("/test");
		expect(mockMiddleware.log).toEqual(["M2"]);
	});

	test("withoutMiddleware works in nested groups", async () => {
		const M1 = mockMiddleware("M1");
		const M2 = mockMiddleware("M2");
		const M3 = mockMiddleware("M3");

		const outerRoutes = group({ middleware: [M1, M2] }, [
			group({ withoutMiddleware: M1, middleware: M3 }, [get("/test", MockController)]),
		]);

		router.register(outerRoutes);
		await handle("/test");

		expect(mockMiddleware.log).toEqual(["M2", "M3"]);
	});

	test("route middleware can re-add previously removed middleware", async () => {
		const M1 = mockMiddleware("M1");
		const M2 = mockMiddleware("M2");

		const innerRoutes = group({ withoutMiddleware: M1 }, [
			get("/test", MockController, { middleware: M1 }),
		]);
		const outerRoutes = group({ middleware: [M1, M2] }, [innerRoutes]);

		router.register(outerRoutes);
		await handle("/test");

		expect(mockMiddleware.log).toEqual(["M2", "M1"]);
	});

	test("group with both middleware and withoutMiddleware for same middleware", async () => {
		const M1 = mockMiddleware("M1");
		const M2 = mockMiddleware("M2");

		const innerRoutes = group({ withoutMiddleware: M1, middleware: [M1, M2] }, [
			get("/test", MockController),
		]);
		const outerRoutes = group({ middleware: M1 }, [innerRoutes]);

		router.register(outerRoutes);
		await handle("/test");

		// At same level, withoutMiddleware wins - M1 is excluded
		expect(mockMiddleware.log).toEqual(["M2"]);
	});

	test("route with both middleware and withoutMiddleware for same middleware", async () => {
		const M1 = mockMiddleware("M1");
		const M2 = mockMiddleware("M2");

		router.register(
			get("/test", MockController, {
				middleware: [M1, M2],
				withoutMiddleware: M1,
			}),
		);

		await handle("/test");

		// At same level, withoutMiddleware wins - M1 is excluded
		expect(mockMiddleware.log).toEqual(["M2"]);
	});

	test("multiple withoutMiddleware at different levels", async () => {
		const M1 = mockMiddleware("M1");
		const M2 = mockMiddleware("M2");
		const M3 = mockMiddleware("M3");
		const M4 = mockMiddleware("M4");

		const innerRoutes = group({ withoutMiddleware: M1 }, [
			get("/test", MockController, { withoutMiddleware: M2, middleware: M4 }),
		]);
		const outerRoutes = group({ middleware: [M1, M2, M3] }, [innerRoutes]);

		router.register(outerRoutes);
		await handle("/test");

		expect(mockMiddleware.log).toEqual(["M3", "M4"]);
	});

	test("withoutMiddleware with array of middleware", async () => {
		const M1 = mockMiddleware("M1");
		const M2 = mockMiddleware("M2");
		const M3 = mockMiddleware("M3");

		const routes = group({ middleware: [M1, M2, M3] }, [
			get("/test", MockController, { withoutMiddleware: [M1, M3] }),
		]);

		router.register(routes);
		await handle("/test");

		expect(mockMiddleware.log).toEqual(["M2"]);
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

		const route = get("/protected", MockController, {
			middleware: AuthMiddleware,
		});

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
			({ request }) => {
				return new Response(request.headers.get("X-Custom") || "Not found");
			},
			{ middleware: ModifyRequestMiddleware },
		);

		router.register(route);

		const response = await router.handle(new Request("http://example.com/test"));
		expect(await response.text()).toBe("Modified");
	});

	test("applies middleware to all routes in group", async () => {
		const M = mockMiddleware("GroupMiddleware");

		const routes = group({ prefix: "/api", middleware: M }, [
			get("/v1", () => {
				mockMiddleware.log.push("v1");
				return new Response("V1");
			}),
			get("/v2", () => {
				mockMiddleware.log.push("v2");
				return new Response("V2");
			}),
		]);

		router.register(routes);

		mockMiddleware.reset();
		await router.handle(new Request("http://example.com/api/v1"));
		expect(mockMiddleware.log).toEqual(["GroupMiddleware", "v1"]);

		mockMiddleware.reset();
		await router.handle(new Request("http://example.com/api/v2"));
		expect(mockMiddleware.log).toEqual(["GroupMiddleware", "v2"]);
	});
});

describe("middleware priority", () => {
	test("sorts middleware according to priority list", async () => {
		const Auth = mockMiddleware("Auth");
		const RateLimit = mockMiddleware("RateLimit");
		const Logger = mockMiddleware("Logger");
		const CORS = mockMiddleware("CORS");

		container = new ContainerImpl();
		router = new Router(container, {
			middlewarePriority: [Auth, RateLimit, Logger],
		});

		router.register(
			get(
				"/test",
				() => {
					mockMiddleware.beforeAfterLog.push("handler");
					return new Response("OK");
				},
				{
					middleware: [CORS, Logger, Auth, RateLimit],
				},
			),
		);

		await handle("/test");

		// Priority middleware (Auth, RateLimit, Logger) execute first in priority order
		// Non-priority middleware (CORS) follows in original relative order
		expect(mockMiddleware.beforeAfterLog).toEqual([
			"Auth:before",
			"RateLimit:before",
			"Logger:before",
			"CORS:before",
			"handler",
			"CORS:after",
			"Logger:after",
			"RateLimit:after",
			"Auth:after",
		]);
	});

	test("sorts middleware once during registration, not per request", async () => {
		const Auth = mockMiddleware("Auth");
		const RateLimit = mockMiddleware("RateLimit");

		const applyPrioritySpy = spyOn(MiddlewareSet.prototype, "applyPriority");

		container = new ContainerImpl();
		router = new Router(container, {
			middlewarePriority: [Auth, RateLimit],
		});

		// Register routes - they share the same MiddlewareSet
		router.register(
			group({ middleware: [RateLimit, Auth] }, [
				get("/test", MockController),
				get("/test-2", MockController),
			]),
		);

		// Send two requests
		await handle("/test");
		await handle("/test");

		// applyPriority should be called exactly once (during registration, for the shared MiddlewareSet)
		expect(applyPrioritySpy).toHaveBeenCalledTimes(1);
	});
});

describe("route groups", () => {
	test("applies prefix to routes", async () => {
		const mc1 = mockController();
		const mc2 = mockController();
		const routes = group(
			{
				prefix: "/admin",
			},
			[get("/dashboard", mc1), get("/users", mc2)],
		);

		router.register(routes);

		await router.handle(new Request("http://example.com/admin/dashboard"));
		expect(mc1.mock.handle).toHaveBeenCalledTimes(1);

		await router.handle(new Request("http://example.com/admin/users"));
		expect(mc2.mock.handle).toHaveBeenCalledTimes(1);
	});

	test("applies domain to routes in group", async () => {
		router.register(group({ domain: "api.example.com" }, [get("/status", MockController)]));

		await handle("//api.example.com/status");
		expect(controller.handle).toHaveBeenCalledTimes(1);

		const response2 = await handle("/status");
		expect(response2.status).toBe(404);
	});

	test("supports nested groups", async () => {
		const mc1 = mockController();
		const mc2 = mockController();
		const userRoutes = group({ prefix: "/users", namePrefix: "users." }, [
			get("/", mc1, { name: "index" }),
			get("/{id}", mc2, { name: "show" }),
		]);

		const apiRoutes = group({ prefix: "/api", namePrefix: "api." }, [userRoutes]);

		router.register(apiRoutes);

		await router.handle(new Request("http://example.com/api/users/"));
		expect(mc1.mock.handle).toHaveBeenCalledTimes(1);

		await router.handle(new Request("http://example.com/api/users/123"));
		expect(mc2.mock.params).toEqual({ id: "123" });

		// Type check
		expectTypeOf(apiRoutes).toEqualTypeOf<
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
				get("/user/{numeric}", MockController, {
					where: { numeric: "numeric" },
				}),
				get("/user/{any}", MockController),
			]),
		);

		const response = await handle("/user/abc");
		expect(response.status).toBe(404);
	});

	test("whereNumber constraint", async () => {
		router.register(get("/user/{id}", MockController, { where: { id: "numeric" } }));

		await handle("/user/123");
		expect(controller.params).toEqual({ id: "123" });

		const response2 = await handle("/user/abc");
		expect(response2.status).toBe(404);
	});

	test("whereAlphaNumeric allows letters and numbers", async () => {
		router.register(
			get("/category/{slug}", MockController, {
				where: { slug: "alphanumeric" },
			}),
		);

		await handle("/category/news");
		expect(controller.params).toEqual({ slug: "news" });

		controller.handle.mockClear();
		await handle("/category/news123");
		expect(controller.params).toEqual({ slug: "news123" });

		const response3 = await handle("/category/news-123");
		expect(response3.status).toBe(404);
	});

	test("whereAlphaNumeric constraint", async () => {
		router.register(get("/post/{slug}", MockController, { where: { slug: "alphanumeric" } }));

		await handle("/post/post123");
		expect(controller.params).toEqual({ slug: "post123" });

		const response2 = await handle("/post/post-123");
		expect(response2.status).toBe(404);
	});

	test("whereUuid constraint", async () => {
		router.register(get("/resource/{uuid}", MockController, { where: { uuid: "uuid" } }));

		const validUuid = "550e8400-e29b-41d4-a716-446655440000";
		await handle(`/resource/${validUuid}`);
		expect(controller.params).toEqual({ uuid: validUuid });

		const response2 = await handle("/resource/not-a-uuid");
		expect(response2.status).toBe(404);
	});

	test("whereUlid constraint", async () => {
		router.register(get("/item/{ulid}", MockController, { where: { ulid: "ulid" } }));

		const validUlid = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
		await handle(`/item/${validUlid}`);
		expect(controller.params).toEqual({ ulid: validUlid });

		const response2 = await handle("/item/not-a-ulid");
		expect(response2.status).toBe(404);
	});

	test("whereIn constraint", async () => {
		router.register(
			get("/status/{type}", MockController, {
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
			get("/file/{ext}", MockController, {
				where: {
					ext: isIn([".txt", ".md", "c++", "node.js", "[test]", "(group)"]),
				},
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
		router.register(
			get("/year/{year}", MockController, {
				where: { year: /^(19|20)\d{2}$/ },
			}),
		);

		await handle("/year/2024");
		expect(controller.params).toEqual({ year: "2024" });

		const response2 = await handle("/year/3024");
		expect(response2.status).toBe(404);
	});

	test("where with incorrect parameter", async () => {
		router.register(
			get("/year/{param}", MockController, {
				where: { notParam: "alphanumeric" } as any,
			}),
		);

		const response = await handle("/year/foo");
		expect(response.status).toBe(404);
	});

	test("multiple constraints on same route", async () => {
		router.register(
			get("/posts/{postId}/comments/{commentId}", MockController, {
				where: { postId: "numeric", commentId: "numeric" },
			}),
		);

		await handle("/posts/123/comments/456");
		expect(controller.params).toEqual({ postId: "123", commentId: "456" });

		const response2 = await handle("/posts/abc/comments/456");
		expect(response2.status).toBe(404);
	});

	test("group-level constraints apply to all routes in group", async () => {
		const mc1 = mockController();
		const mc2 = mockController();

		router.register(
			group({ prefix: "/admin", where: { id: "numeric" } }, [
				get("/{id}", mc1),
				get("/{id}/edit", mc2),
			]),
		);

		// First route should accept numeric id
		await handle("/admin/123");
		expect(mc1.mock.params).toEqual({ id: "123" });

		// Second route should accept numeric id
		await handle("/admin/456/edit");
		expect(mc2.mock.params).toEqual({ id: "456" });

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
				get("/post/{id}", MockController, { where: { id: "uuid" } }),
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
	test("parameterPatterns validates matching parameters", async () => {
		const mc1 = mockController();
		const mc2 = mockController();

		router.register(
			group({ parameterPatterns: { id: /^\d+$/ } }, [
				get("/user/{id}", mc1),
				get("/post/{id}", mc2),
			]),
		);

		await handle("/user/123");
		expect(mc1.mock.params).toEqual({ id: "123" });

		const response2 = await handle("/user/abc");
		expect(response2.status).toBe(404);

		await handle("/post/456");
		expect(mc2.mock.params).toEqual({ id: "456" });

		const response4 = await handle("/post/xyz");
		expect(response4.status).toBe(404);
	});

	test("parameterPatterns ignores non-existent parameters", async () => {
		const mc1 = mockController();
		const mc2 = mockController();

		router.register(
			group({ parameterPatterns: { id: "numeric" } }, [
				get("/user/{userId}", mc1),
				get("/post/{postId}", mc2),
			]),
		);

		// Routes without 'id' parameter should match even with parameterPatterns for 'id'
		await handle("/user/abc");
		expect(mc1.mock.params).toEqual({ userId: "abc" });

		await handle("/post/xyz");
		expect(mc2.mock.params).toEqual({ postId: "xyz" });
	});

	test("where and parameterPatterns work together", async () => {
		router.register(
			get("/post/{postId}/comment/{commentId}", MockController, {
				where: { postId: "numeric" }, // Required - must be numeric
				parameterPatterns: { commentId: "numeric" }, // Optional - only checked if present
			}),
		);

		// Both numeric - success
		await handle("/post/123/comment/456");
		expect(controller.params).toEqual({ postId: "123", commentId: "456" });

		// postId not numeric - 404 (where constraint)
		const response2 = await handle("/post/abc/comment/456");
		expect(response2.status).toBe(404);

		// commentId not numeric - 404 (parameterPatterns constraint)
		const response3 = await handle("/post/123/comment/xyz");
		expect(response3.status).toBe(404);
	});

	test("group-level parameterPatterns apply to all child routes", async () => {
		const mc1 = mockController();
		const mc2 = mockController();
		const mc3 = mockController();

		router.register(
			group({ prefix: "/admin", parameterPatterns: { id: "numeric" } }, [
				get("/{id}", mc1),
				get("/{id}/edit", mc2),
				get("/users/{userId}", mc3), // Different param name - not affected
			]),
		);

		// First route - numeric id passes
		await handle("/admin/123");
		expect(mc1.mock.params).toEqual({ id: "123" });

		// First route - non-numeric id fails
		const response1 = await handle("/admin/abc");
		expect(response1.status).toBe(404);

		// Second route - numeric id passes
		await handle("/admin/456/edit");
		expect(mc2.mock.params).toEqual({ id: "456" });

		// Second route - non-numeric id fails
		const response2 = await handle("/admin/xyz/edit");
		expect(response2.status).toBe(404);

		// Third route - different param name, not affected by parameterPatterns for 'id'
		await handle("/admin/users/abc");
		expect(mc3.mock.params).toEqual({ userId: "abc" });
	});

	test("parameterPatterns merge through nested groups", async () => {
		const mc1 = mockController();
		const mc2 = mockController();

		router.register(
			group({ parameterPatterns: { id: "numeric" } }, [
				group({ parameterPatterns: { slug: "alphanumeric" } }, [
					get("/post/{id}", mc1),
					get("/category/{slug}", mc2),
				]),
			]),
		);

		// Post with numeric id - success
		await handle("/post/123");
		expect(mc1.mock.params).toEqual({ id: "123" });

		// Post with non-numeric id - 404
		const response1 = await handle("/post/abc");
		expect(response1.status).toBe(404);

		// Category with alphanumeric slug - success
		await handle("/category/news");
		expect(mc2.mock.params).toEqual({ slug: "news" });

		// Category with alphanumeric slug including numbers - success
		mc2.mock.handle.mockClear();
		await handle("/category/news123");
		expect(mc2.mock.params).toEqual({ slug: "news123" });

		// Category with non-alphanumeric slug (hyphen) - 404
		const response2 = await handle("/category/news-123");
		expect(response2.status).toBe(404);
	});

	test("parameterPatterns can constrain multiple different parameters", async () => {
		const mc1 = mockController();
		const mc2 = mockController();
		const mc3 = mockController();

		router.register(
			group(
				{
					parameterPatterns: {
						id: "numeric",
						slug: "alphanumeric",
						uuid: "uuid",
					},
				},
				[get("/user/{id}", mc1), get("/category/{slug}", mc2), get("/resource/{uuid}", mc3)],
			),
		);

		// Valid id
		await handle("/user/123");
		expect(mc1.mock.params).toEqual({ id: "123" });

		// Invalid id
		const response1 = await handle("/user/abc");
		expect(response1.status).toBe(404);

		// Valid slug
		await handle("/category/news");
		expect(mc2.mock.params).toEqual({ slug: "news" });

		// Valid slug with numbers
		mc2.mock.handle.mockClear();
		await handle("/category/news123");
		expect(mc2.mock.params).toEqual({ slug: "news123" });

		// Invalid slug (hyphen not allowed)
		const response2 = await handle("/category/news-123");
		expect(response2.status).toBe(404);

		// Valid uuid
		const validUuid = "550e8400-e29b-41d4-a716-446655440000";
		await handle(`/resource/${validUuid}`);
		expect(mc3.mock.params).toEqual({ uuid: validUuid });

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
		router.register(get("/api", MockController, { domain: "api.example.com" }));

		await handle("//api.example.com/api");
		expect(controller.handle).toHaveBeenCalledTimes(1);

		const response2 = await handle("//different.com/api");
		expect(response2.status).toBe(404);
	});

	test("extracts single domain parameter", async () => {
		router.register(get("/users", MockController, { domain: "{account}.example.com" }));

		await handle("//acme.example.com/users");
		expect(controller.params).toEqual({ account: "acme" });

		const response2 = await handle("//example.com/api");
		expect(response2.status).toBe(404);
	});

	test("static domain pattern takes precedence over parametric domain pattern", async () => {
		const controller1 = mockController();
		const controller2 = mockController();
		router.register(
			group([
				// define parametric pattern first
				get("/users", controller1, { domain: "{account}.example.com" }),
				get("/users", controller2, { domain: "www.example.com" }),
			]),
		);

		await handle("//www.example.com/users");
		expect(controller1.mock.handle).not.toHaveBeenCalled();
		expect(controller2.mock.handle).toHaveBeenCalledTimes(1);
	});

	test("parametric domain pattern matches when static doesn't", async () => {
		router.register(
			group([
				get("/users", MockController, { domain: "www.example.com" }),
				get("/users", MockController, { domain: "{account}.example.com" }),
			]),
		);

		await handle("//acme.example.com/users");
		expect(controller.params).toEqual({ account: "acme" });
	});

	test("extracts multiple domain parameters", async () => {
		router.register(get("/", MockController, { domain: "{subdomain}.{region}.example.com" }));

		await handle("//api.us.example.com/");
		expect(controller.params).toEqual({ subdomain: "api", region: "us" });
	});

	test("handles multi-level subdomains", async () => {
		router.register(get("/", MockController, { domain: "{a}.{b}.{c}.example.com" }));

		await handle("//x.y.z.example.com/");
		expect(controller.params).toEqual({ a: "x", b: "y", c: "z" });
	});

	test("combines domain and path parameters", async () => {
		router.register(get("/users/{id}", MockController, { domain: "{account}.example.com" }));

		await handle("//acme.example.com/users/123");
		expect(controller.params).toEqual({ account: "acme", id: "123" });
	});

	test("domain-specific route takes precedence over domain-agnostic", async () => {
		const domainController = mockController();
		const generalController = mockController();

		router.register(get("/users", generalController));
		router.register(get("/users", domainController, { domain: "api.example.com" }));

		await handle("//api.example.com/users");
		expect(domainController.mock.handle).toHaveBeenCalledTimes(1);
		expect(generalController.mock.handle).not.toHaveBeenCalled();
	});

	test("falls back to domain-agnostic when domain doesn't match", async () => {
		const domainController = mockController();
		const generalController = mockController();

		router.register(get("/users", generalController));
		router.register(get("/users", domainController, { domain: "api.example.com" }));

		await handle("//other.example.com/users");
		expect(generalController.mock.handle).toHaveBeenCalledTimes(1);
		expect(domainController.mock.handle).not.toHaveBeenCalled();
	});

	test("applies domain to routes in group", async () => {
		const controller1 = mockController();
		const controller2 = mockController();

		router.register(
			group({ domain: "{tenant}.app.com" }, [
				get("/dashboard", controller1),
				get("/settings", controller2),
			]),
		);

		await handle("//acme.app.com/dashboard");
		expect(controller1.mock.params).toEqual({ tenant: "acme" });

		await handle("//widgets.app.com/settings");
		expect(controller2.mock.params).toEqual({ tenant: "widgets" });
	});

	test("group domain applies to all child routes", async () => {
		const controller1 = mockController();
		const controller2 = mockController();

		router.register(
			group({ domain: "{tenant}.app.com" }, [
				get("/api/status", controller1),
				get("/api/health", controller2),
			]),
		);

		await handle("//acme.app.com/api/status");
		expect(controller1.mock.params).toEqual({ tenant: "acme" });

		await handle("//acme.app.com/api/health");
		expect(controller2.mock.params).toEqual({ tenant: "acme" });
	});

	test("combines path prefix and domain in groups", async () => {
		router.register(
			group({ prefix: "/api", domain: "{tenant}.app.com" }, [get("/status", MockController)]),
		);

		await handle("//acme.app.com/api/status");
		expect(controller.params).toEqual({ tenant: "acme" });
	});

	test("combines domain parameters and prefix parameters in groups", async () => {
		router.register(
			group({ prefix: "/users/{userId}", domain: "{tenant}.app.com" }, [
				get("/profile", MockController),
			]),
		);

		await handle("//acme.app.com/users/123/profile");
		expect(controller.params).toEqual({ tenant: "acme", userId: "123" });
	});

	test("generates correct URL for named domain route", () => {
		const route = get("/users/{id}", MockController, {
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
		router.register(get("/files/{...rest}", MockController));

		await handle("/files/a");
		await handle("/files/a/b/c");
		await handle("/files/documents/2024/report.pdf");
		await handle("/not-files/documents/2024/report.pdf");
		expect(controller.handle).toHaveBeenCalledTimes(3);
	});

	test("named wildcard captures remaining path", async () => {
		router.register(get("/files/{...path}", MockController));

		await handle("/files/document.pdf");
		expect(controller.params).toEqual({ path: "document.pdf" });

		await handle("/files/docs/2024/report.pdf");
		expect(controller.allParams[1]).toEqual({ path: "docs/2024/report.pdf" });
	});

	test("named wildcard with prefix parameters", async () => {
		router.register(get("/users/{userId}/files/{...path}", MockController));

		await handle("/users/123/files/photos/vacation.jpg");
		expect(controller.params).toEqual({
			userId: "123",
			path: "photos/vacation.jpg",
		});
	});

	test("wildcards in route groups", async () => {
		router.register(group({ prefix: "/api" }, [get("/{...path}", MockController)]));

		await handle("/api/v1/users/list");
		expect(controller.params).toEqual({ path: "v1/users/list" });
	});
});

// ============================================================================
// Mixed Params (Partial Segment Parameters)
// ============================================================================

describe("mixed params in same segment", () => {
	test("simple prefix pattern matches correctly", async () => {
		router.register(get("/npm/@{scope}/{package}", MockController));

		await handle("/npm/@vue/router");
		expect(controller.params).toEqual({ scope: "vue", package: "router" });
	});

	test("simple prefix pattern does not match without prefix", async () => {
		router.register(get("/npm/@{scope}/{package}", MockController));

		const response = await handle("/npm/vue/router");
		expect(response.status).toBe(404);
	});

	test("simple suffix pattern matches correctly", async () => {
		router.register(get("/files/{id}.txt", MockController));

		await handle("/files/123.txt");
		expect(controller.params).toEqual({ id: "123" });
	});

	test("simple suffix pattern does not match without suffix", async () => {
		router.register(get("/files/{id}.txt", MockController));

		const response = await handle("/files/123.pdf");
		expect(response.status).toBe(404);
	});

	test("multiple params in same segment", async () => {
		router.register(get("/files/{category}/{id},name={name}.txt", MockController));

		await handle("/files/docs/123,name=report.txt");
		expect(controller.params).toEqual({
			category: "docs",
			id: "123",
			name: "report",
		});
	});

	test("multiple params in same segment does not match wrong pattern", async () => {
		router.register(get("/files/{id},name={name}.txt", MockController));

		const response = await handle("/files/123.txt");
		expect(response.status).toBe(404);
	});

	test("mixed params work with regular params", async () => {
		router.register(get("/api/v{version}/users/{userId}", MockController));

		await handle("/api/v2/users/123");
		expect(controller.params).toEqual({ version: "2", userId: "123" });
	});

	test("multiple routes with different patterns select correctly", async () => {
		const controller1 = mockController();
		const controller2 = mockController();

		router.register(get("/npm/@{scope}/{package}", controller1));
		router.register(get("/npm/{package}/{version}", controller2));

		await handle("/npm/@vue/router");
		expect(controller1.mock.params).toEqual({
			scope: "vue",
			package: "router",
		});
		expect(controller2.mock.handle).not.toHaveBeenCalled();

		controller1.mock.handle.mockClear();
		controller2.mock.handle.mockClear();

		await handle("/npm/express/4.18.2");
		expect(controller2.mock.params).toEqual({
			package: "express",
			version: "4.18.2",
		});
		expect(controller1.mock.handle).not.toHaveBeenCalled();
	});

	test("mixed params in domain patterns", async () => {
		router.register(get("/status", MockController, { domain: "api-{version}.example.com" }));

		await handle("//api-v2.example.com/status");
		expect(controller.params).toEqual({ version: "v2" });
	});

	test("mixed params in domain does not match different pattern", async () => {
		router.register(get("/status", MockController, { domain: "api-{version}.example.com" }));

		const response = await handle("//apiv2.example.com/status");
		expect(response.status).toBe(404);
	});

	test("mixed params with special regex characters in literal parts", async () => {
		router.register(get("/files/{id}.{ext}", MockController));

		await handle("/files/report.pdf");
		expect(controller.params).toEqual({ id: "report", ext: "pdf" });
	});

	test("mixed params do not match when literal part is missing", async () => {
		router.register(get("/api/v{version}/status", MockController));

		const response = await handle("/api/2/status");
		expect(response.status).toBe(404);
	});
});

// ============================================================================
// URL Encoding/Decoding
// ============================================================================

describe("URL encoding and decoding", () => {
	test("decodes encoded slashes in route parameters", async () => {
		router.register(get("/foo/{param}/quux", MockController));

		await handle("/foo/bar%2Fbaz/quux");
		expect(controller.params).toEqual({ param: "bar/baz" });
		expect(controller.rawParams).toEqual({ param: "bar%2Fbaz" });
		expect(controller.url?.pathname).toBe("/foo/bar%2Fbaz/quux");
	});

	test("decodes encoded characters in multiple parameters", async () => {
		router.register(get("/posts/{postId}/comments/{commentId}", MockController));

		await handle("/posts/hello%20world/comments/foo%26bar");
		expect(controller.params).toEqual({
			postId: "hello world",
			commentId: "foo&bar",
		});
		expect(controller.rawParams).toEqual({
			postId: "hello%20world",
			commentId: "foo%26bar",
		});
		expect(controller.url?.pathname).toBe("/posts/hello%20world/comments/foo%26bar");
	});

	test("decodes wildcard parameters with encoded characters", async () => {
		router.register(get("/files/{...path}", MockController));

		await handle("/files/docs%2F2024%2Freport.pdf");
		expect(controller.params).toEqual({ path: "docs/2024/report.pdf" });
		expect(controller.rawParams).toEqual({ path: "docs%2F2024%2Freport.pdf" });
		expect(controller.url?.pathname).toBe("/files/docs%2F2024%2Freport.pdf");
	});

	test("handles invalid percent encoding gracefully", async () => {
		router.register(get("/test/{param}", MockController));

		// Invalid encoding should use the original value
		await handle("/test/foo%2");
		expect(controller.params).toEqual({ param: "foo%2" });
		expect(controller.rawParams).toEqual({ param: "foo%2" });
	});

	test("query parameters are decoded by URL object", async () => {
		router.register(get("/search", MockController));

		await handle("/search?foo=bar+baz%2Fquux");
		expect(controller.url?.searchParams.get("foo")).toBe("bar baz/quux");
	});
});

describe("MiddlewareSet sharing", () => {
	const M1 = mockMiddleware("M1");
	const M2 = mockMiddleware("M2");

	test("sibling routes with no middleware both have null middleware", () => {
		const routes = group([get("/a", MockController), get("/b", MockController)]);

		expect(routes[0].middleware).toBe(null);
		expect(routes[1].middleware).toBe(null);
	});

	test("sibling routes in group with middleware share MiddlewareSet instance", () => {
		const routes = group({ middleware: M1 }, [
			get("/a", MockController),
			get("/b", MockController),
		]);

		expect(routes[0].middleware).toBe(routes[1].middleware);
		expect(routes[0].middleware).toBeInstanceOf(MiddlewareSet);
	});

	test("routes with different middleware get different MiddlewareSet instances", () => {
		const routes = group([
			get("/a", MockController, { middleware: M1 }),
			get("/b", MockController, { middleware: M2 }),
		]);

		expect(routes[0].middleware).toBeInstanceOf(MiddlewareSet);
		expect(routes[1].middleware).toBeInstanceOf(MiddlewareSet);
		expect(routes[0].middleware).not.toBe(routes[1].middleware);
	});

	test("only routes with middleware get a MiddlewareSet", () => {
		const routes = group([
			get("/a", MockController, { middleware: M1 }),
			get("/b", MockController),
		]);

		expect(routes[0].middleware).toBeInstanceOf(MiddlewareSet);
		expect(routes[1].middleware).toBe(null);
	});

	test("nested groups: siblings share MiddlewareSet, different groups differ", () => {
		const routes = group({ middleware: M1 }, [
			get("/a", MockController),
			get("/b", MockController),
			group({ middleware: M2 }, [get("/c", MockController), get("/d", MockController)]),
		]);

		// /a and /b share (both have [M1])
		expect(routes[0].middleware).toBeInstanceOf(MiddlewareSet);
		expect(routes[0].middleware).toBe(routes[1].middleware);

		// /c and /d share (both have [M1, M2])
		expect(routes[2].middleware).toBeInstanceOf(MiddlewareSet);
		expect(routes[2].middleware).toBe(routes[3].middleware);

		// /a and /c differ (different middleware)
		expect(routes[0].middleware).not.toBe(routes[2].middleware);
	});

	test("route with withoutMiddleware gets different MiddlewareSet", () => {
		const routes = group({ middleware: [M1, M2] }, [
			get("/a", MockController),
			get("/b", MockController, { withoutMiddleware: M1 }),
		]);

		// Different because /b filters out M1
		expect(routes[0].middleware).toBeInstanceOf(MiddlewareSet);
		expect(routes[1].middleware).toBeInstanceOf(MiddlewareSet);
		expect(routes[0].middleware).not.toBe(routes[1].middleware);
	});
});

describe("multi-method routes", () => {
	test("match() accepts multiple HTTP methods", async () => {
		router.register(match(["GET", "POST"], "/form", MockController));

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
		router.register(match(["BREW"], "/form", MockController));

		const response1 = await router.handle(brewRequest);
		expect(response1.status).toBe(200);

		const response2 = await handle("/form", "GET");
		expect(response2.status).toBe(404);
	});

	test("any() accepts all HTTP methods", async () => {
		router.register(any("/catchall", MockController));

		const methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];

		for (const method of methods) {
			const response = await handle("/catchall", method);
			expect(response.status).toBe(200);
		}
	});

	test("meta is passed to controller context", async () => {
		router.register(get("/test", MockController, { meta: { foo: "bar", num: 42 } }));

		await handle("/test");
		expect(controller.meta).toEqual({ foo: "bar", num: 42 });
	});

	test("meta is empty object when not specified", async () => {
		router.register(get("/test", MockController));

		await handle("/test");
		expect(controller.meta).toEqual({});
	});
});

describe("handler validation", () => {
	test("throws helpful error when passing non-Controller class", async () => {
		class NotAController {
			someMethod() {
				return new Response("This won't work");
			}
		}

		router.register(get("/test", NotAController as unknown as NoArgConstructor<Controller>));

		expect(async () => {
			await handle("/test");
		}).toThrow(
			"Route handler NotAController for /test is a class but does not extend Controller. Class-based handlers must extend the Controller class.",
		);
	});

	test("throws helpful error when Controller returns invalid value", async () => {
		router.register(get("/test", () => "strings are not valid" as unknown as ControllerReturn));

		expect(async () => {
			await handle("/test");
		}).toThrow(
			"Route handler  for /test returned an object with a 'handle' method. This can happen if you have a controller that does not extend the Controller class.",
		);
	});

	test("accepts function controller (non-class)", async () => {
		const functionController = (ctx: ControllerContext) => {
			return new Response(`Function controller, id: ${ctx.params.id}`);
		};

		router.register(get("/user/{id}", functionController));

		const response = await handle("/user/123");
		expect(response.status).toBe(200);
		expect(await response.text()).toBe("Function controller, id: 123");
	});

	test("accepts newable function that extends Controller", async () => {
		// A constructor function that extends Controller via prototype
		function NewableController(this: Controller) {
			this.handle = (ctx: ControllerContext) => {
				return new Response(`Newable controller, id: ${ctx.params.id}`);
			};
		}
		NewableController.prototype = Object.create(Controller.prototype);

		router.register(
			get("/item/{id}", NewableController as unknown as NoArgConstructor<Controller>),
		);

		const response = await handle("/item/456");
		expect(response.status).toBe(200);
		expect(await response.text()).toBe("Newable controller, id: 456");
	});

	test("Error when passing a newable function that does not extends Controller", async () => {
		// A constructor function that extends Controller via prototype
		function NewableController() {
			return {
				handle: (ctx: ControllerContext) => {
					return new Response(`Newable controller, id: ${ctx.params.id}`);
				},
			};
		}

		router.register(get("/item/{id}", NewableController));

		expect(async () => {
			await handle("/item/456");
		}).toThrow("Expected Response, JSX element, or null, but got: [object Object]");
	});
});

describe("param access checking", () => {
	class ControllerInvalidParam extends Controller {
		handle(ctx: ControllerContext) {
			return new Response(`ctx.params.nonExistent: ${ctx.params.nonExistent}`);
		}
	}
	test("throwOnInvalidParamAccess: 'always' throws even when development: false", async () => {
		router = new Router(new ContainerImpl(), undefined, {
			development: false,
			throwOnInvalidParamAccess: "always",
		});

		router.register(get("/user/{id}", ControllerInvalidParam));

		expect(async () => {
			await router.handle(new Request("http://example.com/user/123"));
		}).toThrow('Route parameter "nonExistent" does not exist');
	});

	test("throwOnInvalidParamAccess: 'never' doesn't throw even when development: true", async () => {
		router = new Router(new ContainerImpl(), undefined, {
			development: true,
			throwOnInvalidParamAccess: "never",
		});

		router.register(get("/user/{id}", ControllerInvalidParam));

		const response = await router.handle(new Request("http://example.com/user/123"));
		expect(response.status).toBe(200);
		expect(await response.text()).toBe("ctx.params.nonExistent: undefined");
	});

	test("throwOnInvalidParamAccess: 'development' throws when development: true", async () => {
		router = new Router(new ContainerImpl(), undefined, {
			development: true,
			throwOnInvalidParamAccess: "development",
		});

		router.register(get("/user/{id}", ControllerInvalidParam));

		expect(async () => {
			await router.handle(new Request("http://example.com/user/123"));
		}).toThrow('Route parameter "nonExistent" does not exist');
	});

	test("throwOnInvalidParamAccess: 'development' doesn't throw when development: false", async () => {
		router = new Router(new ContainerImpl(), undefined, {
			development: false,
			throwOnInvalidParamAccess: "development",
		});

		router.register(get("/user/{id}", ControllerInvalidParam));

		const response = await router.handle(new Request("http://example.com/user/123"));
		expect(response.status).toBe(200);
		expect(await response.text()).toBe("ctx.params.nonExistent: undefined");
	});

	test("throwOnInvalidParamAccess: undefined (default) throws when development: true", async () => {
		router = new Router(new ContainerImpl(), undefined, { development: true });

		router.register(get("/user/{id}", ControllerInvalidParam));

		expect(async () => {
			await router.handle(new Request("http://example.com/user/123"));
		}).toThrow('Route parameter "nonExistent" does not exist');
	});

	test("throwOnInvalidParamAccess: undefined (default) doesn't throw when development: false", async () => {
		router = new Router(new ContainerImpl(), undefined, { development: false });

		router.register(get("/user/{id}", ControllerInvalidParam));

		const response = await router.handle(new Request("http://example.com/user/123"));
		expect(response.status).toBe(200);
		expect(await response.text()).toBe("ctx.params.nonExistent: undefined");
	});

	test("valid param access works in all modes", async () => {
		const config = {
			development: true,
			throwOnInvalidParamAccess: "always" as const,
		};
		const containerWithConfig = new ContainerImpl();
		containerWithConfig.instance(createTypeToken("Configuration"), config);
		const routerWithConfig = new Router(containerWithConfig, undefined, config);

		let capturedId: string | undefined;
		routerWithConfig.register(
			get("/user/{id}", (ctx: ControllerContext) => {
				capturedId = ctx.params.id; // Should work fine
				return new Response("ok");
			}),
		);

		const response = await routerWithConfig.handle(new Request("http://example.com/user/123"));
		expect(response.status).toBe(200);
		expect(capturedId).toBe("123");
	});

	test("rawParams also throws when configured", async () => {
		const config = { development: true };
		const containerWithConfig = new ContainerImpl();
		containerWithConfig.instance(createTypeToken("Configuration"), config);
		const routerWithConfig = new Router(containerWithConfig, undefined, config);

		routerWithConfig.register(
			get("/user/{id}", (ctx: ControllerContext) => {
				const _unused = ctx.rawParams.nonExistent; // Should throw
				return new Response(`ok: ${_unused}`);
			}),
		);

		expect(async () => {
			await routerWithConfig.handle(new Request("http://example.com/user/123"));
		}).toThrow('Route parameter "nonExistent" does not exist');
	});
});
