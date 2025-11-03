/** @jsxImportSource ../view */

import { describe, expect, mock, test } from "bun:test";
import { RequestLocalsImpl } from "../core/RequestLocalsImpl";
import { controllerContext, mockViewRenderer } from "../test-utils";
import { Component } from "../view";
import { AbortException } from "./abort";
import { get } from "./helpers";
import type { RouteDefinition, StatusPageComponent, StatusPages } from "./router-types";
import { StatusPagesMiddleware } from "./StatusPagesMiddleware";

const mockComponent =
	(content: string): Component =>
	() => <>{content}</>;

const mockComponentWithStatus =
	(prefix: string): StatusPageComponent =>
	({ status }) => (
		<>
			{prefix} {status}
		</>
	);

const mockComponentWithError: StatusPageComponent = ({ status, error }) => (
	<>
		error {status} - {error?.message}
	</>
);

function mockRoute(statusPages?: StatusPages): RouteDefinition {
	return get("/", () => null, { statusPages })[0];
}

async function handleMiddleware(
	middleware: StatusPagesMiddleware,
	status: number,
): Promise<Response> {
	const ctx = controllerContext();
	const next = mock(() => new Response("default response", { status }));
	return await middleware.handle(ctx, next);
}

describe(StatusPagesMiddleware, () => {
	describe("matchStatusPage priority", () => {
		test("exact match takes precedence over range match", async () => {
			const middleware = new StatusPagesMiddleware(
				mockRoute({
					404: mockComponent("404 status page"),
					"4xx": mockComponent("4xx status page"),
				}),
				new RequestLocalsImpl(),
				mockViewRenderer,
			);

			const response = await handleMiddleware(middleware, 404);

			expect(response.status).toBe(404);
			expect(await response.text()).toBe("404 status page");
		});
	});

	describe("4xx range matching", () => {
		test("4xx range matches status 400", async () => {
			const middleware = new StatusPagesMiddleware(
				mockRoute({ "4xx": mockComponentWithStatus("4xx page") }),
				new RequestLocalsImpl(),
				mockViewRenderer,
			);

			const response = await handleMiddleware(middleware, 400);

			expect(response.status).toBe(400);
			expect(await response.text()).toBe("4xx page 400");
		});

		test("4xx range matches status 499", async () => {
			const middleware = new StatusPagesMiddleware(
				mockRoute({ "4xx": mockComponentWithStatus("4xx page") }),
				new RequestLocalsImpl(),
				mockViewRenderer,
			);

			const response = await handleMiddleware(middleware, 499);

			expect(response.status).toBe(499);
			expect(await response.text()).toBe("4xx page 499");
		});

		test("4xx range does not match status 399", async () => {
			const middleware = new StatusPagesMiddleware(
				mockRoute({ "4xx": mockComponent("4xx status page") }),
				new RequestLocalsImpl(),
				mockViewRenderer,
			);

			const response = await handleMiddleware(middleware, 399);

			expect(response.status).toBe(399);
			expect(await response.text()).toBe("default response");
		});

		test("4xx range does not match status 500", async () => {
			const middleware = new StatusPagesMiddleware(
				mockRoute({ "4xx": mockComponent("4xx status page") }),
				new RequestLocalsImpl(),
				mockViewRenderer,
			);

			const response = await handleMiddleware(middleware, 500);

			expect(response.status).toBe(500);
			expect(await response.text()).toBe("default response");
		});

		test("range fallback when no exact match", async () => {
			const middleware = new StatusPagesMiddleware(
				mockRoute({
					404: mockComponent("404 status page"),
					"4xx": mockComponentWithStatus("4xx page"),
				}),
				new RequestLocalsImpl(),
				mockViewRenderer,
			);

			const response = await handleMiddleware(middleware, 403);

			expect(response.status).toBe(403);
			expect(await response.text()).toBe("4xx page 403");
		});
	});

	describe("5xx range matching", () => {
		test("5xx range matches status 500", async () => {
			const middleware = new StatusPagesMiddleware(
				mockRoute({ "5xx": mockComponentWithStatus("5xx page") }),
				new RequestLocalsImpl(),
				mockViewRenderer,
			);

			const response = await handleMiddleware(middleware, 500);

			expect(response.status).toBe(500);
			expect(await response.text()).toBe("5xx page 500");
		});

		test("5xx range matches status 599", async () => {
			const middleware = new StatusPagesMiddleware(
				mockRoute({ "5xx": mockComponentWithStatus("5xx page") }),
				new RequestLocalsImpl(),
				mockViewRenderer,
			);

			const response = await handleMiddleware(middleware, 599);

			expect(response.status).toBe(599);
			expect(await response.text()).toBe("5xx page 599");
		});

		test("5xx range does not match status 499", async () => {
			const middleware = new StatusPagesMiddleware(
				mockRoute({ "5xx": mockComponent("5xx status page") }),
				new RequestLocalsImpl(),
				mockViewRenderer,
			);

			const response = await handleMiddleware(middleware, 499);

			expect(response.status).toBe(499);
			expect(await response.text()).toBe("default response");
		});
	});

	describe("error prop handling", () => {
		test("passes AbortException cause as error prop when available", async () => {
			const middleware = new StatusPagesMiddleware(
				mockRoute({ 500: mockComponentWithError }),
				new RequestLocalsImpl(),
				mockViewRenderer,
			);

			const response = await middleware.handle(controllerContext(), () => {
				throw new AbortException(
					new Response("default response", { status: 500 }),
					new Error("Database connection failed"),
				);
			});

			expect(response.status).toBe(500);
			expect(await response.text()).toBe("error 500 - Database connection failed");
		});

		test("passes AbortException as error prop when no cause", async () => {
			const middleware = new StatusPagesMiddleware(
				mockRoute({ 404: mockComponentWithError }),
				new RequestLocalsImpl(),
				mockViewRenderer,
			);

			const response = await middleware.handle(controllerContext(), () => {
				throw new AbortException(new Response("default response", { status: 404 }));
			});

			expect(response.status).toBe(404);
			expect(await response.text()).toBe("error 404 - Request aborted");
		});
	});

	describe("response handling", () => {
		test("returns original response when no status page matches", async () => {
			const middleware = new StatusPagesMiddleware(
				mockRoute({ 500: mockComponent("500 page") }),
				new RequestLocalsImpl(),
				mockViewRenderer,
			);

			const response = await handleMiddleware(middleware, 404);

			expect(response.status).toBe(404);
			expect(await response.text()).toBe("default response");
		});
	});
});
