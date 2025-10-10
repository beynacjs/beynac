import type { RequestHandler } from "../contracts/RequestHandler";

/**
 * Request handler implementation for processing HTTP requests
 */
export class RequestHandlerImpl implements RequestHandler {
  /**
   * Handle an HTTP request and return a response
   */
  async handle(_request: Request): Promise<Response> {
    // For now, just return a simple response
    // This is where routing, middleware, etc. would be processed
    return Promise.resolve(
      new Response("Hello from Beynac", {
        status: 200,
        headers: {
          "Content-Type": "text/plain",
        },
      }),
    );
  }
}
