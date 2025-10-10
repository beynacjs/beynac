import { describe, expect, test } from "bun:test";
import { RequestHandlerImpl } from "./RequestHandlerImpl";

describe(RequestHandlerImpl, () => {
  test("handle returns a response", async () => {
    const handler = new RequestHandlerImpl();
    const request = new Request("http://example.com/test");
    const response = await handler.handle(request);

    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(200);
  });
});
