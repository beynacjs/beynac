import { NextRequest } from "next/server";

/**
 * Catch-all route handler for /beynac/* paths
 * Delegates all requests to a Beynac RequestHandler
 */

// TODO: Import RequestHandler from beynac package once exported
// import { RequestHandler, RequestHandlerImpl } from "beynac";

// Temporary handler implementation until integration
class TemporaryHandler {
  async handle(request: Request): Promise<Response> {
    return new Response("Hello from Beynac catch-all route", {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
      },
    });
  }
}

const handler = new TemporaryHandler();

/**
 * Handle GET requests
 */
export async function GET(request: NextRequest) {
  const webRequest = new Request(request.url, {
    method: "GET",
    headers: request.headers,
  });

  return handler.handle(webRequest);
}

/**
 * Handle POST requests
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const webRequest = new Request(request.url, {
    method: "POST",
    headers: request.headers,
    body: body,
  });

  return handler.handle(webRequest);
}

/**
 * Handle PUT requests
 */
export async function PUT(request: NextRequest) {
  const body = await request.text();
  const webRequest = new Request(request.url, {
    method: "PUT",
    headers: request.headers,
    body: body,
  });

  return handler.handle(webRequest);
}

/**
 * Handle DELETE requests
 */
export async function DELETE(request: NextRequest) {
  const webRequest = new Request(request.url, {
    method: "DELETE",
    headers: request.headers,
  });

  return handler.handle(webRequest);
}

/**
 * Handle PATCH requests
 */
export async function PATCH(request: NextRequest) {
  const body = await request.text();
  const webRequest = new Request(request.url, {
    method: "PATCH",
    headers: request.headers,
    body: body,
  });

  return handler.handle(webRequest);
}

/**
 * Handle OPTIONS requests
 */
export async function OPTIONS(request: NextRequest) {
  const webRequest = new Request(request.url, {
    method: "OPTIONS",
    headers: request.headers,
  });

  return handler.handle(webRequest);
}

/**
 * Handle HEAD requests
 */
export async function HEAD(request: NextRequest) {
  const webRequest = new Request(request.url, {
    method: "HEAD",
    headers: request.headers,
  });

  return handler.handle(webRequest);
}