import { Mock, mock } from "bun:test";
import { Application, Container } from "../contracts";
import type { Configuration } from "../contracts/Configuration";
import type { RequestContext } from "../contracts/RequestContext";
import { createApplication } from "../entry";
import { ResourceController } from "../router";
import {
	BaseController,
	ControllerContext,
	type ControllerReturn,
	FunctionController,
} from "../router/Controller";
import { type ClassMiddleware } from "../router/Middleware";
import { Router } from "../router/Router";

export class MockController extends ResourceController {
	override handle: Mock<BaseController["handle"]>;

	constructor(response: Response | (() => Response) | null = null) {
		super();
		this.handle = mock(() => {
			if (typeof response === "function") return response();
			return response ?? new Response();
		});
	}

	get meta(): Record<string, unknown> {
		return this.#firstCall("meta").meta;
	}

	get params(): Record<string, string> {
		return this.#firstCall("params").params;
	}

	get url(): URL | undefined {
		return this.#firstCall("url").url;
	}

	get rawParams(): Record<string, string> {
		return this.#firstCall("rawParams").rawParams;
	}

	get allParams(): Record<string, string>[] {
		return this.handle.mock.calls.map((call) => call[0].params);
	}

	#firstCall(method: string) {
		const { calls } = this.handle.mock;
		if (calls.length !== 1) {
			throw new Error(
				`handle(ctx) was called ${calls.length} times, mockController.${method} can only be used if the handler is called exactly once`,
			);
		}
		return calls[0][0];
	}
}

export const mockController = (): FunctionController & {
	mock: MockController;
} => {
	const mock = new MockController();
	const controller = (ctx: ControllerContext): ControllerReturn => mock.handle(ctx);
	return Object.assign(controller, { mock });
};

export const controllerContext = (
	request: Request = new Request("https://example.com/"),
): ControllerContext => ({
	request,
	params: {},
	rawParams: {},
	url: new URL(request.url),
	meta: {},
});

export const requestContext = (): RequestContext => ({
	context: "test",
	getCookie: () => {
		throw new Error("Can't getCookie in mock request context");
	},
	getCookieNames: () => {
		throw new Error("Can't getCookieNames in mock request context");
	},
	deleteCookie: () => {
		throw new Error("Can't deleteCookie in mock request context");
	},
	setCookie: () => {
		throw new Error("Can't setCookie in mock request context");
	},
	getRequestHeader: () => {
		throw new Error("Can't getRequestHeader in mock request context");
	},
	getRequestHeaderNames: () => {
		throw new Error("Can't getRequestHeaderNames in mock request context");
	},
});

interface MockMiddlewareFunction {
	(name: string): ClassMiddleware;
	log: string[];
	beforeAfterLog: string[];
	reset(): void;
}

/**
 * Create a mock middleware class for testing.
 *
 * The returned function creates middleware classes that log their name when executed.
 * Access the execution log via `mockMiddleware.log` or `mockMiddleware.beforeAfterLog`
 * and reset both via `mockMiddleware.reset()`.
 *
 * @example
 * const M1 = mockMiddleware("M1");
 * router.register(get("/test", controller, { middleware: M1 }));
 * await handle("/test");
 * expect(mockMiddleware.log).toEqual(["M1"]);
 *
 * @example
 * // Access before/after logs
 * const M = mockMiddleware("M");
 * // beforeAfterLog contains: ["M:before", "M:after"]
 * // log contains: ["M"]
 */
export const mockMiddleware: MockMiddlewareFunction = Object.assign(
	(name: string) => {
		// Validate that the name is a valid JavaScript identifier
		if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name)) {
			throw new Error(`mockMiddleware name must be a valid JavaScript identifier, got: ${name}`);
		}

		// Create a function that returns a class with the dynamic name.
		// oxlint-disable-next-line no-implied-eval -- Function constructor needed for dynamic class names
		const createClass = new Function(`
      return class ${name} {}
    `);

		// Call the function to get the class
		const ClassConstructor = createClass();

		// Add the static property to mark it as a class middleware
		ClassConstructor.isClassMiddleware = true;

		// Add the handle method to the prototype
		ClassConstructor.prototype.handle = async function (
			ctx: ControllerContext,
			next: (ctx: ControllerContext) => ControllerReturn,
		): Promise<ControllerReturn> {
			mockMiddleware.log.push(name);
			mockMiddleware.beforeAfterLog.push(`${name}:before`);
			const result = await next(ctx);
			mockMiddleware.beforeAfterLog.push(`${name}:after`);
			return result;
		};

		return ClassConstructor as ClassMiddleware;
	},
	{
		log: [] as string[],
		beforeAfterLog: [] as string[],
		reset() {
			this.log.length = 0;
			this.beforeAfterLog.length = 0;
		},
	},
);

export const createTestApplication = <RouteParams extends Record<string, string> = {}>(
	config: Configuration<RouteParams> = {},
): {
	app: Application<RouteParams>;
	container: Container;
	router: Router;
	handle: (url: string, method?: string) => Promise<Response>;
} => {
	const app = createApplication({
		...config,
		devMode: { suppressAutoRefresh: true, ...config.devMode },
	});

	const container = app.container;
	const router = container.get(Router);

	const handle = async (url: string, method = "GET") => {
		if (url.startsWith("//")) {
			url = "https:" + url;
		} else if (url.startsWith("/")) {
			url = "https://example.com" + url;
		}
		return await app.handleRequest(new Request(url, { method }), requestContext());
	};

	return { app, container, router, handle };
};
