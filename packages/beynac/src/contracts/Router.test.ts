import { describe, expectTypeOf, it } from "bun:test";
import type { RouteHandler } from "./Router";

describe("RouteHandler", () => {
  it("enforces correct param types based on params union", () => {
    // Handler with no params - should have empty params
    const handlerNoParams: RouteHandler<never> = {
      handle(_req, params) {
        expectTypeOf(params).toEqualTypeOf<Record<never, string>>();
        return new Response();
      },
    };

    // Handler with single param - should have that param
    const handlerSingleParam: RouteHandler<"id"> = {
      handle(_req, params) {
        expectTypeOf(params).toEqualTypeOf<{ id: string }>();
        expectTypeOf(params.id).toEqualTypeOf<string>();
        return new Response();
      },
    };

    // Handler with multiple params - should have all params
    const handlerMultiParams: RouteHandler<"postId" | "commentId"> = {
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
