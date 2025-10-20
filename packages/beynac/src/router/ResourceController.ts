import type { Controller, ControllerContext } from "../core/Controller";

/**
 * The seven standard RESTful resource actions
 */
export type ResourceAction = "index" | "create" | "store" | "show" | "edit" | "update" | "destroy";

/**
 * Abstract base class for RESTful resource controllers.
 *
 * Provides default implementations for all seven standard resource actions:
 * "index", "create", "store", "show", "edit", "update" and "destroy". Default
 * implementations return a 404. Subclasses override only the methods they need.
 *
 * The handle() method automatically delegates to the appropriate action method
 * based on the HTTP method and URL path structure.
 *
 * @example
 * class PhotoController extends ResourceController {
 *   index(ctx: ControllerContext) {
 *     return new Response('List photos');
 *   }
 *
 *   show(ctx: ControllerContext) {
 *     const { id } = ctx.params;
 *     return new Response(`Show photo ${id}`);
 *   }
 * }
 *
 * // Register all resource routes at once
 * resource('/photos', PhotoController)
 */
export abstract class ResourceController implements Controller {
  /**
   * Main entry point called by the router.
   * Determines which action to execute based on the request.
   */
  handle(ctx: ControllerContext): Response | Promise<Response> {
    const action = this.#determineAction(ctx);
    return this[action](ctx);
  }

  /**
   * Determines which resource action to call based on HTTP method and path structure.
   */
  #determineAction(ctx: ControllerContext): ResourceAction {
    const method = ctx.request.method;
    const hasId = ctx.params.id != null;
    const path = ctx.url.pathname;

    if (method === "GET") {
      if (!hasId) {
        // GET /photos or GET /photos/create
        return path.endsWith("/create") ? "create" : "index";
      }
      // GET /photos/{id} or GET /photos/{id}/edit
      return path.endsWith("/edit") ? "edit" : "show";
    }

    if (method === "POST") {
      return "store";
    }

    if (method === "PUT" || method === "PATCH") {
      return "update";
    }

    if (method === "DELETE") {
      return "destroy";
    }

    // Fallback (should not happen with proper route registration)
    throw new Error(`Unsupported HTTP method: ${method}`);
  }

  /**
   * Display a listing of the resource.
   * GET /resource
   */
  index(_ctx: ControllerContext): Response | Promise<Response> {
    return new Response("Not Found", { status: 404 });
  }

  /**
   * Show the form for creating a new resource.
   * GET /resource/create
   */
  create(_ctx: ControllerContext): Response | Promise<Response> {
    return new Response("Not Found", { status: 404 });
  }

  /**
   * Store a newly created resource in storage.
   * POST /resource
   */
  store(_ctx: ControllerContext): Response | Promise<Response> {
    return new Response("Not Found", { status: 404 });
  }

  /**
   * Display the specified resource.
   * GET /resource/{id}
   */
  show(_ctx: ControllerContext): Response | Promise<Response> {
    return new Response("Not Found", { status: 404 });
  }

  /**
   * Show the form for editing the specified resource.
   * GET /resource/{id}/edit
   */
  edit(_ctx: ControllerContext): Response | Promise<Response> {
    return new Response("Not Found", { status: 404 });
  }

  /**
   * Update the specified resource in storage.
   * PUT/PATCH /resource/{id}
   */
  update(_ctx: ControllerContext): Response | Promise<Response> {
    return new Response("Not Found", { status: 404 });
  }

  /**
   * Remove the specified resource from storage.
   * DELETE /resource/{id}
   */
  destroy(_ctx: ControllerContext): Response | Promise<Response> {
    return new Response("Not Found", { status: 404 });
  }
}
