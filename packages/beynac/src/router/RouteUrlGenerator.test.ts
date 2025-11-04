import { beforeEach, describe, expect, test } from "bun:test";
import { ContainerImpl } from "../container/ContainerImpl";
import { Configuration } from "../contracts/Configuration";
import type { Container } from "../contracts/Container";
import { MockController } from "../test-utils";
import { get, group, resource } from "./helpers";
import { ResourceController } from "./ResourceController";
import { RouteUrlGenerator } from "./RouteUrlGenerator";

describe("route URL generation", () => {
	let urlGenerator: RouteUrlGenerator;
	let container: Container;
	let config: Configuration;

	beforeEach(() => {
		container = new ContainerImpl();
		config = {};
		container.singletonInstance(Configuration, config);
		urlGenerator = new RouteUrlGenerator(container, config);
	});

	test("generates URL for named route without parameters", () => {
		const route = get("/users", MockController, { name: "users.index" });
		urlGenerator.register(route);

		expect(urlGenerator.url("users.index")).toBe("/users");
	});

	test("generates URL for named route with parameters", () => {
		const route = get("/users/{id}", MockController, { name: "users.show" });

		urlGenerator.register(route);

		expect(urlGenerator.url("users.show", { params: { id: 123 } })).toBe("/users/123");
		expect(urlGenerator.url("users.show", { params: { id: "abc" } })).toBe("/users/abc");
	});

	test("generates URL for route with multiple parameters", () => {
		const route = get("/posts/{postId}/comments/{commentId}", MockController, {
			name: "posts.comments.show",
		});

		urlGenerator.register(route);

		expect(urlGenerator.url("posts.comments.show", { params: { postId: 42, commentId: 7 } })).toBe(
			"/posts/42/comments/7",
		);
	});

	test("throws error for non-existent route name", () => {
		const route = get("/users", MockController, { name: "users.index" });

		urlGenerator.register(route);

		expect(() => urlGenerator.url("non.existent" as any)).toThrow('Route "non.existent" not found');
	});

	test("generates URLs for routes in groups with namePrefix", () => {
		const routes = group({ prefix: "/admin", namePrefix: "admin." }, [
			get("/dashboard", MockController, { name: "dashboard" }),
			get("/users/{id}", MockController, { name: "users.show" }),
		]);

		urlGenerator.register(routes);

		expect(urlGenerator.url("admin.dashboard")).toBe("/admin/dashboard");
		expect(urlGenerator.url("admin.users.show", { params: { id: 456 } })).toBe("/admin/users/456");
	});

	test("generates URLs for routes in nested groups", () => {
		const userRoutes = group({ prefix: "/users", namePrefix: "users." }, [
			get("/", MockController, { name: "index" }),
			get("/{id}", MockController, { name: "show" }),
		]);

		const apiRoutes = group({ prefix: "/api", namePrefix: "api." }, [userRoutes]);

		urlGenerator.register(apiRoutes);

		expect(urlGenerator.url("api.users.index")).toBe("/api/users");
		expect(urlGenerator.url("api.users.show", { params: { id: 789 } })).toBe("/api/users/789");
	});

	test("generates protocol-relative URL for routes with static domain", () => {
		const route = get("/users/{id}", MockController, {
			name: "users.show",
			domain: "api.example.com",
		});

		urlGenerator.register(route);

		expect(urlGenerator.url("users.show", { params: { id: 123 } })).toBe(
			"//api.example.com/users/123",
		);
	});

	test("generates protocol-relative URL with domain parameters", () => {
		const route = get("/users/{id}", MockController, {
			name: "users.show",
			domain: "{account}.example.com",
		});

		urlGenerator.register(route);

		expect(urlGenerator.url("users.show", { params: { account: "acme", id: 123 } })).toBe(
			"//acme.example.com/users/123",
		);
	});

	test("uses same param in both domain and path", () => {
		const route = get("/orgs/{org}/users", MockController, {
			name: "users.index",
			domain: "{org}.example.com",
		});

		urlGenerator.register(route);

		expect(urlGenerator.url("users.index", { params: { org: "acme" } })).toBe(
			"//acme.example.com/orgs/acme/users",
		);
	});

	test("wildcard URL generation", () => {
		const route = get("/files/{...path}", MockController, {
			name: "files.show",
		});

		urlGenerator.register(route);

		expect(urlGenerator.url("files.show", { params: { path: "document.pdf" } })).toBe(
			"/files/document.pdf",
		);
		expect(urlGenerator.url("files.show", { params: { path: "docs/2024/report.pdf" } })).toBe(
			"/files/docs%2F2024%2Freport.pdf",
		);
	});

	test("wildcard with regular params URL generation", () => {
		const route = get("/users/{userId}/files/{...path}", MockController, {
			name: "users.files",
		});

		urlGenerator.register(route);

		expect(
			urlGenerator.url("users.files", { params: { userId: 123, path: "photos/pic.jpg" } }),
		).toBe("/users/123/files/photos%2Fpic.jpg");
	});

	test("encodes slashes in parameters", () => {
		const route = get("/foo/{param}/quux", MockController, {
			name: "test.route",
		});

		urlGenerator.register(route);

		expect(urlGenerator.url("test.route", { params: { param: "bar/baz" } })).toBe(
			"/foo/bar%2Fbaz/quux",
		);
	});

	test("encodes special characters in parameters", () => {
		const route = get("/posts/{postId}/comments/{commentId}", MockController, {
			name: "posts.comments.show",
		});

		urlGenerator.register(route);

		expect(
			urlGenerator.url("posts.comments.show", {
				params: {
					postId: "hello world",
					commentId: "foo&bar",
				},
			}),
		).toBe("/posts/hello%20world/comments/foo%26bar");
		expect(
			urlGenerator.url("posts.comments.show", {
				params: {
					postId: "test?",
					commentId: "foo#bar",
				},
			}),
		).toBe("/posts/test%3F/comments/foo%23bar");
	});

	test("encodes wildcard parameters", () => {
		const route = get("/files/{...path}", MockController, {
			name: "files.show",
		});

		urlGenerator.register(route);

		expect(urlGenerator.url("files.show", { params: { path: "docs/2024/report.pdf" } })).toBe(
			"/files/docs%2F2024%2Freport.pdf",
		);
	});

	test("encodes domain parameters", () => {
		const route = get("/users/{id}", MockController, {
			name: "user.show",
			domain: "{tenant}.example.com",
		});

		urlGenerator.register(route);

		expect(urlGenerator.url("user.show", { params: { tenant: "hello world", id: 123 } })).toBe(
			"//hello%20world.example.com/users/123",
		);
	});

	test("generates URL for mixed params with prefix", () => {
		const route = get("/npm/@{scope}/{package}", MockController, {
			name: "npm.package",
		});

		urlGenerator.register(route);

		expect(urlGenerator.url("npm.package", { params: { scope: "vue", package: "router" } })).toBe(
			"/npm/@vue/router",
		);
	});

	test("generates URL for mixed params with suffix", () => {
		const route = get("/files/{id}.txt", MockController, {
			name: "files.text",
		});

		urlGenerator.register(route);

		expect(urlGenerator.url("files.text", { params: { id: "123" } })).toBe("/files/123.txt");
	});

	test("generates URL for mixed params with multiple params in segment", () => {
		const route = get("/files/{id},name={name}.txt", MockController, {
			name: "files.named",
		});

		urlGenerator.register(route);

		expect(urlGenerator.url("files.named", { params: { id: "123", name: "report" } })).toBe(
			"/files/123,name=report.txt",
		);
	});

	test("generates URL for mixed params in domain", () => {
		const route = get("/status", MockController, {
			name: "api.status",
			domain: "api-{version}.example.com",
		});

		urlGenerator.register(route);

		expect(urlGenerator.url("api.status", { params: { version: "v2" } })).toBe(
			"//api-v2.example.com/status",
		);
	});

	test("encodes special characters in mixed params", () => {
		const route = get("/npm/@{scope}/{package}", MockController, {
			name: "npm.package",
		});

		urlGenerator.register(route);

		expect(
			urlGenerator.url("npm.package", { params: { scope: "my scope", package: "pkg&test" } }),
		).toBe("/npm/@my%20scope/pkg%26test");
	});
});

// ============================================================================
// RouteUrlGenerator Typed Method
// ============================================================================

describe("RouteUrlGenerator typed method", () => {
	let urlGenerator: RouteUrlGenerator;
	let container: Container;
	let config: Configuration;

	beforeEach(() => {
		container = new ContainerImpl();
		config = {};
		container.singletonInstance(Configuration, config);
		urlGenerator = new RouteUrlGenerator(container, config);
	});

	test("generates URL for route without parameters", () => {
		const routes = group({ namePrefix: "users." }, [
			get("/users", MockController, { name: "index" }),
		]);

		urlGenerator.register(routes);

		expect(urlGenerator.url("users.index")).toBe("/users");
	});

	test("generates URL for route with single parameter", () => {
		const routes = group({ namePrefix: "users." }, [
			get("/users/{id}", MockController, { name: "show" }),
		]);

		urlGenerator.register(routes);

		expect(urlGenerator.url("users.show", { params: { id: 123 } })).toBe("/users/123");
		expect(urlGenerator.url("users.show", { params: { id: "abc" } })).toBe("/users/abc");
	});

	test("generates URL for route with multiple parameters", () => {
		const routes = group({ namePrefix: "posts." }, [
			get("/posts/{postId}/comments/{commentId}", MockController, {
				name: "comments",
			}),
		]);

		urlGenerator.register(routes);

		expect(urlGenerator.url("posts.comments", { params: { postId: 42, commentId: 7 } })).toBe(
			"/posts/42/comments/7",
		);
	});

	test("works with nested groups", () => {
		const userRoutes = group({ prefix: "/users", namePrefix: "users." }, [
			get("/", MockController, { name: "index" }),
			get("/{id}", MockController, { name: "show" }),
		]);

		const apiRoutes = group({ prefix: "/api", namePrefix: "api." }, [userRoutes]);

		urlGenerator.register(apiRoutes);

		expect(urlGenerator.url("api.users.index")).toBe("/api/users");
		expect(urlGenerator.url("api.users.show", { params: { id: 789 } })).toBe("/api/users/789");
	});

	test("throws error for non-existent route name", () => {
		const routes = group({ namePrefix: "users." }, [
			get("/users", MockController, { name: "index" }),
		]);

		urlGenerator.register(routes);

		expect(() => urlGenerator.url("users.nonexistent" as any)).toThrow(
			'Route "users.nonexistent" not found',
		);
	});

	test("resource routes with slash-to-dot conversion", () => {
		class TestController extends ResourceController {}

		const routes = resource("/admin/photos", TestController);

		// Runtime URL generation should work
		urlGenerator.register(routes);
		expect(urlGenerator.url("admin.photos.index")).toBe("/admin/photos");
		expect(urlGenerator.url("admin.photos.show", { params: { resourceId: "123" } })).toBe(
			"/admin/photos/123",
		);
	});

	test("resource routes with multiple slashes convert to dots", () => {
		class TestController extends ResourceController {}

		const routes = resource("/api/v1/users", TestController);

		urlGenerator.register(routes);
		expect(urlGenerator.url("api.v1.users.index")).toBe("/api/v1/users");
		expect(urlGenerator.url("api.v1.users.show", { params: { resourceId: "42" } })).toBe(
			"/api/v1/users/42",
		);
	});

	test("domain routing URL generation", () => {
		const route = get("/users/{id}", MockController, {
			name: "users.show",
			domain: "{subdomain}.example.com",
		});

		urlGenerator.register(route);

		expect(urlGenerator.url("users.show", { params: { subdomain: "acme", id: 123 } })).toBe(
			"//acme.example.com/users/123",
		);
	});

	test("generates URL with both domain and path params", () => {
		const route = get("/users/{id}", MockController, {
			name: "users.show",
			domain: "{subdomain}.example.com",
		});

		urlGenerator.register(route);

		expect(urlGenerator.url("users.show", { params: { subdomain: "widgets", id: 456 } })).toBe(
			"//widgets.example.com/users/456",
		);
	});
});

// ============================================================================
// Query String Generation
// ============================================================================

describe("query string generation", () => {
	let urlGenerator: RouteUrlGenerator;
	let container: Container;
	let config: Configuration;

	beforeEach(() => {
		container = new ContainerImpl();
		config = {};
		container.singletonInstance(Configuration, config);
		urlGenerator = new RouteUrlGenerator(container, config);
	});

	test("appends query string to route without params", () => {
		const route = get("/search", MockController, { name: "search" });
		urlGenerator.register(route);

		expect(urlGenerator.url("search", { query: { q: "test" } })).toBe("/search?q=test");
	});

	test("appends query string to route with params", () => {
		const route = get("/users/{id}", MockController, { name: "users.show" });
		urlGenerator.register(route);

		expect(urlGenerator.url("users.show", { params: { id: 123 }, query: { tab: "profile" } })).toBe(
			"/users/123?tab=profile",
		);
	});

	test("handles multiple query parameters", () => {
		const route = get("/search", MockController, { name: "search" });
		urlGenerator.register(route);

		expect(urlGenerator.url("search", { query: { q: "test", page: 2, limit: 10 } })).toBe(
			"/search?q=test&page=2&limit=10",
		);
	});

	test("handles array values as multiple params", () => {
		const route = get("/search", MockController, { name: "search" });
		urlGenerator.register(route);

		expect(urlGenerator.url("search", { query: { tags: ["js", "ts"] } })).toBe(
			"/search?tags=js&tags=ts",
		);
	});

	test("omits null and undefined values", () => {
		const route = get("/search", MockController, { name: "search" });
		urlGenerator.register(route);

		expect(
			urlGenerator.url("search", { query: { q: "test", filter: null, sort: undefined } }),
		).toBe("/search?q=test");
	});

	test("omits null and undefined in arrays", () => {
		const route = get("/search", MockController, { name: "search" });
		urlGenerator.register(route);

		expect(urlGenerator.url("search", { query: { tags: ["a", null, "b", undefined, "c"] } })).toBe(
			"/search?tags=a&tags=b&tags=c",
		);
	});

	test("handles URLSearchParams directly", () => {
		const route = get("/search", MockController, { name: "search" });
		urlGenerator.register(route);

		const params = new URLSearchParams();
		params.append("q", "test");
		params.append("page", "2");

		expect(urlGenerator.url("search", { query: params })).toBe("/search?q=test&page=2");
	});

	test("encodes query parameter keys and values", () => {
		const route = get("/search", MockController, { name: "search" });
		urlGenerator.register(route);

		expect(urlGenerator.url("search", { query: { "search query": "hello world" } })).toBe(
			"/search?search+query=hello+world",
		);
	});

	test("works with absolute URLs", () => {
		config.appUrl = {
			overrideHost: "example.com",
			overrideHttps: true,
		};

		const route = get("/search", MockController, { name: "search" });
		urlGenerator.register(route);

		expect(urlGenerator.url("search", { query: { q: "test" } })).toBe(
			"https://example.com/search?q=test",
		);
	});

	test("works with domain routes", () => {
		const route = get("/search", MockController, {
			name: "search",
			domain: "api.example.com",
		});
		urlGenerator.register(route);

		expect(urlGenerator.url("search", { query: { q: "test" } })).toBe(
			"//api.example.com/search?q=test",
		);
	});

	test("empty query object produces no query string", () => {
		const route = get("/search", MockController, { name: "search" });
		urlGenerator.register(route);

		expect(urlGenerator.url("search", { query: {} })).toBe("/search");
	});

	test("query with only null/undefined produces no query string", () => {
		const route = get("/search", MockController, { name: "search" });
		urlGenerator.register(route);

		expect(urlGenerator.url("search", { query: { a: null, b: undefined } })).toBe("/search");
	});
});
