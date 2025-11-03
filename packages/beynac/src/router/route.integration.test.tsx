/** @jsxImportSource ../view */
import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { ContainerImpl } from "../container/ContainerImpl";
import { createTypeToken } from "../container/container-key";
import { Configuration, Container } from "../contracts";
import { createTestApplication, MockController, mockMiddleware } from "../test-utils";
import { NoArgConstructor } from "../utils";
import { Controller, type ControllerContext, type ControllerReturn } from "./Controller";
import { any, get, group, post, Router } from "./index";
import type { Middleware } from "./Middleware";
import { MiddlewareSet } from "./MiddlewareSet";
import { ControllerReference } from "./router-types";

let container: Container;
let router: Router;
let handle: (url: string, method?: string) => Promise<Response>;
let controller: MockController;

beforeEach(() => {
	({ container, router, handle } = createTestApplication());
	controller = new MockController();
	// Bind the controller instance so routes using MockController class get this instance
	container.bind(MockController, { instance: controller });
	mockMiddleware.reset();
});

// ============================================================================
// Controller Execution
// ============================================================================

describe("controller execution", () => {
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
});

// ============================================================================
// Middleware Pipeline
// ============================================================================

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

		const response = await handle("/protected");
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

		const response = await handle("/test");
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
		await handle("/api/v1");
		expect(mockMiddleware.log).toEqual(["GroupMiddleware", "v1"]);

		mockMiddleware.reset();
		await handle("/api/v2");
		expect(mockMiddleware.log).toEqual(["GroupMiddleware", "v2"]);
	});
});

// ============================================================================
// Middleware Priority
// ============================================================================

describe("middleware priority", () => {
	test("sorts middleware according to priority list", async () => {
		const Auth = mockMiddleware("Auth");
		const RateLimit = mockMiddleware("RateLimit");
		const Logger = mockMiddleware("Logger");
		const CORS = mockMiddleware("CORS");

		({ container, router, handle } = createTestApplication({
			middlewarePriority: [Auth, RateLimit, Logger],
		}));

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
		container.singletonInstance(Container, container);
		container.singletonInstance(Configuration, {
			middlewarePriority: [Auth, RateLimit],
		});
		router = container.get(Router);

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

// ============================================================================
// Handler Validation
// ============================================================================

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
			"Controller NotAController for /test is a class but does not extend Controller. Class-based handlers must extend the Controller class.",
		);
	});

	test("throws helpful error when Controller returns invalid value", async () => {
		router.register(get("/test", () => "strings are not valid" as unknown as ControllerReturn));

		expect(async () => {
			await handle("/test");
		}).toThrow(
			"Controller for /test returned an object with a 'handle' method. This can happen if you have a controller that does not extend the Controller class.",
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

		router.register(get("/item/{id}", NewableController as unknown as ControllerReference));

		expect(async () => {
			await handle("/item/456");
		}).toThrow("Expected Response, JSX element, or null, but got: [object Object]");
	});
});

// ============================================================================
// Param Access Checking
// ============================================================================

describe("param access checking", () => {
	class ControllerInvalidParam extends Controller {
		handle(ctx: ControllerContext) {
			return new Response(`ctx.params.nonExistent: ${ctx.params.nonExistent}`);
		}
	}
	test("throwOnInvalidParamAccess: 'always' throws even when development: false", async () => {
		({ container, router, handle } = createTestApplication({
			development: false,
			throwOnInvalidParamAccess: "always",
		}));

		router.register(get("/user/{id}", ControllerInvalidParam));

		expect(async () => {
			await handle("/user/123");
		}).toThrow('Route parameter "nonExistent" does not exist');
	});

	test("throwOnInvalidParamAccess: 'never' doesn't throw even when development: true", async () => {
		({ container, router, handle } = createTestApplication({
			development: true,
			throwOnInvalidParamAccess: "never",
		}));

		router.register(get("/user/{id}", ControllerInvalidParam));

		const response = await handle("/user/123");
		expect(response.status).toBe(200);
		expect(await response.text()).toBe("ctx.params.nonExistent: undefined");
	});

	test("throwOnInvalidParamAccess: 'development' throws when development: true", async () => {
		({ container, router, handle } = createTestApplication({
			development: true,
			throwOnInvalidParamAccess: "development",
		}));

		router.register(get("/user/{id}", ControllerInvalidParam));

		expect(async () => {
			await handle("/user/123");
		}).toThrow('Route parameter "nonExistent" does not exist');
	});

	test("throwOnInvalidParamAccess: 'development' doesn't throw when development: false", async () => {
		({ container, router, handle } = createTestApplication({
			development: false,
			throwOnInvalidParamAccess: "development",
		}));

		router.register(get("/user/{id}", ControllerInvalidParam));

		const response = await handle("/user/123");
		expect(response.status).toBe(200);
		expect(await response.text()).toBe("ctx.params.nonExistent: undefined");
	});

	test("throwOnInvalidParamAccess: undefined (default) throws when development: true", async () => {
		({ container, router, handle } = createTestApplication({ development: true }));

		router.register(get("/user/{id}", ControllerInvalidParam));

		expect(async () => {
			await handle("/user/123");
		}).toThrow('Route parameter "nonExistent" does not exist');
	});

	test("throwOnInvalidParamAccess: undefined (default) doesn't throw when development: false", async () => {
		({ container, router, handle } = createTestApplication({ development: false }));

		router.register(get("/user/{id}", ControllerInvalidParam));

		const response = await handle("/user/123");
		expect(response.status).toBe(200);
		expect(await response.text()).toBe("ctx.params.nonExistent: undefined");
	});

	test("valid param access works in all modes", async () => {
		({ container, router, handle } = createTestApplication({
			development: true,
			throwOnInvalidParamAccess: "always",
		}));

		let capturedId: string | undefined;
		router.register(
			get("/user/{id}", (ctx: ControllerContext) => {
				capturedId = ctx.params.id; // Should work fine
				return new Response("ok");
			}),
		);

		const response = await handle("/user/123");
		expect(response.status).toBe(200);
		expect(capturedId).toBe("123");
	});

	test("rawParams also throws when configured", async () => {
		({ container, router, handle } = createTestApplication({ development: true }));

		router.register(
			get("/user/{id}", (ctx: ControllerContext) => {
				const _unused = ctx.rawParams.nonExistent; // Should throw
				return new Response(`ok: ${_unused}`);
			}),
		);

		expect(async () => {
			await handle("/user/123");
		}).toThrow('Route parameter "nonExistent" does not exist');
	});
});

// ============================================================================
// Meta Property
// ============================================================================

describe("meta property", () => {
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

// ============================================================================
// Special Routes
// ============================================================================

describe("special routes", () => {
	test("redirect returns 303 by default (changes to GET)", async () => {
		const { redirect } = await import("../router/index");
		const route = any("/old", redirect("/new"));
		router.register(route);

		const response = await handle("/old");
		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe("/new");
	});

	test("redirect with preserveHttpMethod returns 307", async () => {
		const { redirect } = await import("../router/index");
		const route = post("/old-api", redirect("/new-api", { preserveHttpMethod: true }));
		router.register(route);

		const response = await handle("/old-api", "POST");
		expect(response.status).toBe(307);
		expect(response.headers.get("Location")).toBe("/new-api");
	});
});

// ============================================================================
// Status Pages
// ============================================================================

describe("status pages", () => {
	const NotFoundPage = ({ status }: { status: number }) => (
		<div>
			<h1>404 Not Found</h1>
			<p>Status: {status}</p>
		</div>
	);

	test("renders custom 404 page with correct status", async () => {
		const { StatusPagesMiddleware } = await import("./index");

		router.register(
			get("/test", () => new Response("Not Found", { status: 404 }), {
				middleware: StatusPagesMiddleware,
				statusPages: { 404: NotFoundPage },
			}),
		);

		const response = await handle("/test");
		expect(response.status).toBe(404);
		const html = await response.text();
		expect(html).toContain("<h1>404 Not Found</h1>");
		expect(html).toContain("<p>Status: 404</p>");
	});

	test("AbortException triggers status page", async () => {
		const { StatusPagesMiddleware, abort } = await import("./index");

		router.register(
			get(
				"/test",
				() => {
					return abort.notFound("Resource not found");
				},
				{
					middleware: StatusPagesMiddleware,
					statusPages: { 404: NotFoundPage },
				},
			),
		);

		const response = await handle("/test");
		expect(response.status).toBe(404);
		const html = await response.text();
		expect(html).toContain("<h1>404 Not Found</h1>");
	});

	test("Response with error status triggers status page", async () => {
		const { StatusPagesMiddleware } = await import("./index");

		router.register(
			get("/test", () => new Response("Not Found", { status: 404 }), {
				middleware: StatusPagesMiddleware,
				statusPages: { 404: NotFoundPage },
			}),
		);

		const response = await handle("/test");
		expect(response.status).toBe(404);
		const html = await response.text();
		expect(html).toContain("<h1>404 Not Found</h1>");
	});

	test("middleware throws abort triggers status page", async () => {
		const { StatusPagesMiddleware, abort } = await import("./index");

		class AuthMiddleware implements Middleware {
			handle(_ctx: ControllerContext) {
				return abort.unauthorized("Not authorized");
			}
		}

		const UnauthorizedPage = ({ status }: { status: number }) => (
			<div>
				<h1>Unauthorized</h1>
				<p>Status: {status}</p>
			</div>
		);

		router.register(
			get("/test", () => new Response("OK"), {
				middleware: [AuthMiddleware, StatusPagesMiddleware],
				statusPages: { 401: UnauthorizedPage },
			}),
		);

		const response = await handle("/test");
		expect(response.status).toBe(401);
		const html = await response.text();
		expect(html).toContain("<h1>Unauthorized</h1>");
	});

	// TODO restore this when we have sync and async response rendering, it currently doesn't work because abort is thrown asynchronously
	// test("status page throws abort returns plain text", async () => {
	// 	const { StatusPagesMiddleware, abort } = await import("./index");

	// 	const ThrowingErrorPage = () => {
	// 		return abort.internalServerError("Error page failed");
	// 	};

	// 	router.register(
	// 		get("/test", () => new Response("Not Found", { status: 404 }), {
	// 			middleware: StatusPagesMiddleware,
	// 			statusPages: { 404: ThrowingErrorPage },
	// 		}),
	// 	);

	// 	const response = await handle("/test");
	// 	expect(response.status).toBe(500);
	// 	const text = await response.text();
	// 	expect(text).toBe("Error page failed");
	// });

	test("Error thrown in middleware before StatusPagesMiddleware can catch it gets a default plaintext response", async () => {
		const { abort, StatusPagesMiddleware } = await import("./index");

		class EarlyMiddleware implements Middleware {
			handle() {
				return abort.unauthorized();
			}
		}

		const UnauthorizedPage = () => <h1>Custom Unauthorized</h1>;

		// Create new test application with middleware priority
		// EarlyMiddleware has higher priority, so it runs before (outermost) StatusPagesMiddleware
		// When it throws, StatusPagesMiddleware never gets to catch it
		const testApp = createTestApplication({
			middlewarePriority: [EarlyMiddleware, StatusPagesMiddleware],
		});

		testApp.router.register(
			get("/test", () => new Response("OK"), {
				middleware: [EarlyMiddleware, StatusPagesMiddleware],
				statusPages: { 401: UnauthorizedPage },
			}),
		);

		const response = await testApp.handle("/test");
		expect(response.status).toBe(401);
		const text = await response.text();
		expect(text).toBe("Unauthorized"); // Plain text, not the custom page
	});
});
