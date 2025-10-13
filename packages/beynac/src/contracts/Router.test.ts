import { describe, expectTypeOf, it } from "bun:test";
import type { RouteHandler } from "./Router";

describe("RouteHandler", () => {
  it("enforces correct param types based on params record", () => {
    // Handler with no params - should accept empty record
    const handlerNoParams: RouteHandler<Record<string, never>> = {
      handle(_req, params) {
        expectTypeOf(params).toEqualTypeOf<Record<string, never>>();
        return new Response();
      },
    };

    // Handler with single param - should have that param
    const handlerSingleParam: RouteHandler<{ id: string }> = {
      handle(_req, params) {
        expectTypeOf(params).toEqualTypeOf<{ id: string }>();
        expectTypeOf(params.id).toEqualTypeOf<string>();
        return new Response();
      },
    };

    // Handler with multiple params - should have all params
    const handlerMultiParams: RouteHandler<{ postId: string; commentId: string }> = {
      handle(_req, params) {
        expectTypeOf(params).toEqualTypeOf<{ postId: string; commentId: string }>();
        expectTypeOf(params.postId).toEqualTypeOf<string>();
        expectTypeOf(params.commentId).toEqualTypeOf<string>();
        return new Response();
      },
    };

    // Use the variables to avoid unused warnings
    void handlerNoParams;
    void handlerSingleParam;
    void handlerMultiParams;
  });
});
