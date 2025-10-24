import { describe, expect, test } from "bun:test";
import { ContainerImpl } from "../container/ContainerImpl";
import { abort } from "./abort";
import { get } from "./helpers";
import { Router } from "./Router";

async function getResponse(f: () => void) {
	const router = new Router(new ContainerImpl());
	router.register(
		get("/", () => {
			f();
			return new Response();
		}),
	);
	const response = await router.handle(new Request("http://example.com/"));
	return {
		status: response.status,
		text: await response.text(),
		headers: response.headers,
	};
}

describe(abort, () => {
	test("abort with status code", async () => {
		const response = await getResponse(() => abort(404));
		expect(response.status).toBe(404);
	});

	test("abort with custom body and headers", async () => {
		const response = await getResponse(() =>
			abort(429, "Rate limit exceeded", { "Retry-After": "60" }),
		);
		expect(response.status).toBe(429);
		expect(response.headers.get("Retry-After")).toBe("60");
		expect(response.text).toBe("Rate limit exceeded");
	});

	test("throws with custom message", async () => {
		const response = await getResponse(() => abort(403, "Access denied"));
		expect(response).toMatchObject({ status: 403, text: "Access denied" });
	});

	test("throws with headers", async () => {
		const response = await getResponse(() => abort(301, "", { Location: "/new-url" }));
		expect(response.status).toBe(301);
		expect(response.headers.get("Location")).toBe("/new-url");
	});

	test("abort.notFound throws 404", async () => {
		const response = await getResponse(() => abort.notFound());
		expect(response).toMatchObject({ status: 404, text: "Not Found" });
	});

	test("abort.notFound with custom message", async () => {
		const response = await getResponse(() => abort.notFound("User not found"));
		expect(response).toMatchObject({ status: 404, text: "User not found" });
	});

	test("abort.badRequest throws 400", async () => {
		const response = await getResponse(() => abort.badRequest());
		expect(response).toMatchObject({ status: 400, text: "Bad Request" });
	});

	test("abort.unauthorized throws 401", async () => {
		const response = await getResponse(() => abort.unauthorized());
		expect(response).toMatchObject({ status: 401, text: "Unauthorized" });
	});

	test("abort.forbidden throws 403", async () => {
		const response = await getResponse(() => abort.forbidden());
		expect(response).toMatchObject({ status: 403, text: "Forbidden" });
	});

	test("abort.methodNotAllowed throws 405", async () => {
		const response = await getResponse(() => abort.methodNotAllowed());
		expect(response).toMatchObject({ status: 405, text: "Method Not Allowed" });
	});

	test("abort.gone throws 410", async () => {
		const response = await getResponse(() => abort.gone());
		expect(response).toMatchObject({ status: 410, text: "Resource Gone" });
	});

	test("abort.unprocessableEntity throws 422", async () => {
		const response = await getResponse(() => abort.unprocessableEntity());
		expect(response).toMatchObject({
			status: 422,
			text: "Unprocessable Entity",
		});
	});

	test("abort.tooManyRequests throws 429", async () => {
		const response = await getResponse(() => abort.tooManyRequests());
		expect(response).toMatchObject({ status: 429, text: "Too Many Requests" });
	});

	test("abort.internalServerError throws 500", async () => {
		const response = await getResponse(() => abort.internalServerError());
		expect(response).toMatchObject({
			status: 500,
			text: "Internal Server Error",
		});
	});

	test("abort.serviceUnavailable throws 503", async () => {
		const response = await getResponse(() => abort.serviceUnavailable());
		expect(response).toMatchObject({
			status: 503,
			text: "Service Unavailable",
		});
	});

	test("abort.redirect throws 303 by default", async () => {
		const response = await getResponse(() => abort.redirect("/login"));
		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe("/login");
	});

	test("abort.redirect with permanent option throws 301", async () => {
		const response = await getResponse(() => abort.redirect("/new-location", { permanent: true }));
		expect(response.status).toBe(301);
		expect(response.headers.get("Location")).toBe("/new-location");
	});

	test("abort.redirect with preserveHttpMethod option throws 307", async () => {
		const response = await getResponse(() =>
			abort.redirect("/api/v2", { preserveHttpMethod: true }),
		);
		expect(response.status).toBe(307);
		expect(response.headers.get("Location")).toBe("/api/v2");
	});

	test("abort.redirect with both options throws 308", async () => {
		const response = await getResponse(() =>
			abort.redirect("/api/v2", { permanent: true, preserveHttpMethod: true }),
		);
		expect(response.status).toBe(308);
		expect(response.headers.get("Location")).toBe("/api/v2");
	});

	test("abort.withResponse throws HttpResponseException", async () => {
		const response = await getResponse(() =>
			abort.withResponse(new Response("Custom", { status: 418, headers: { "X-Test": "value" } })),
		);
		expect(response.status).toBe(418);
		expect(response.text).toBe("Custom");
		expect(response.headers.get("X-Test")).toBe("value");
	});
});
