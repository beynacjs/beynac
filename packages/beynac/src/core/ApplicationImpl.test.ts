import { beforeEach, describe, expect, test } from "bun:test";
import { Dispatcher } from "../contracts/Dispatcher";
import {
  RequestHandler as RequestHandlerKey,
  type RequestHandler,
} from "../contracts/RequestHandler";
import { ApplicationImpl } from "./ApplicationImpl";
import { DispatcherImpl } from "./DispatcherImpl";

describe("ApplicationImpl", () => {
  let app: ApplicationImpl;

  beforeEach(() => {
    app = new ApplicationImpl();
  });

  test("handleRequest delegates to RequestHandler", async () => {
    // Create a mock handler
    const mockHandler: RequestHandler = {
      handle: async (request: Request) => {
        return new Response(`Handled: ${request.url}`, { status: 200 });
      },
    };

    // Bind the mock handler
    app.bind(RequestHandlerKey, { factory: () => mockHandler });

    // Create a test request
    const request = new Request("http://example.com/test");

    // Handle the request
    const response = await app.handleRequest(request);

    // Verify the response
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toBe("Handled: http://example.com/test");
  });

  test("events getter returns Dispatcher instance", () => {
    // Bind a dispatcher
    const dispatcher = new DispatcherImpl(app);
    app.bind(Dispatcher, { factory: () => dispatcher });

    // Access through getter
    const events = app.events;

    // Verify it's the same instance
    expect(events).toBe(dispatcher);
  });

  test("events getter uses container resolution", () => {
    // Bind dispatcher as singleton
    app.bind(Dispatcher, {
      factory: (container) => new DispatcherImpl(container),
      lifecycle: "singleton",
    });

    // Access through getter multiple times
    const events1 = app.events;
    const events2 = app.events;

    // Should be same instance (singleton)
    expect(events1).toBe(events2);
    expect(events1).toBeInstanceOf(DispatcherImpl);
  });
});
