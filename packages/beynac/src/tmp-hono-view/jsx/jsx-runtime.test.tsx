/** @jsxRuntime automatic **/
/** @jsxImportSource . **/
import { describe, it } from "bun:test";

describe("jsx-runtime", () => {
	it.skip("Hono integration tests need to be updated", () => {
		// Original tests depended on Hono which is not available
		// These tests need to be rewritten for the Beynac framework
	});

	// Original test content:
	/*
	import { beforeEach, describe, expect, it } from "bun:test";
	import { Hono } from "../hono";

	let app: Hono;

	beforeEach(() => {
		app = new Hono();
	});

	it("Should render HTML strings", async () => {
		app.get("/", (c) => {
			return c.html(<h1>Hello</h1>);
		});
		const res = await app.request("http://localhost/");
		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Type")).toBe("text/html; charset=UTF-8");
		expect(await res.text()).toBe("<h1>Hello</h1>");
	});
	*/
});
