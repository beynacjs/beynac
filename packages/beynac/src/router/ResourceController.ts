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
 * based on the action specified in ctx.meta.action.
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
   * Delegates to the appropriate action method based on ctx.meta.action.
   */
  handle(ctx: ControllerContext): Response | Promise<Response> {
    const action = ctx.meta.action as ResourceAction;
    if (!action) {
      throw new Error("ResourceController requires meta.action to be set");
    }
    return this[action](ctx);
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
