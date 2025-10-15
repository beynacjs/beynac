import { expect, mock, spyOn, test } from "bun:test";
import { DevModeAutoRefreshMiddleware } from "./DevModeAutoRefreshMiddleware";

test("calls next middleware for non-SSE requests", async () => {
  const middleware = new DevModeAutoRefreshMiddleware({});
  const next = mock(() => new Response("OK"));
  const request = new Request("http://example.com/test");

  await middleware.handle(request, next);

  expect(next).toHaveBeenCalledWith(request);
});

test("SSE endpoint returns correct headers", async () => {
  const middleware = new DevModeAutoRefreshMiddleware({});
  const next = mock(() => new Response("OK"));
  const request = new Request("http://example.com?__beynac_dev_mode_refresh");

  const response = await middleware.handle(request, next);

  expect(next).not.toHaveBeenCalled();
  expect(response).toBeInstanceOf(Response);
  expect(response.headers.get("Content-Type")).toBe("text/event-stream");
  expect(response.headers.get("Cache-Control")).toBe("no-cache");
  expect(response.headers.get("Connection")).toBe("keep-alive");
});

test("multiple SSE connections all receive reload event", async () => {
  const middleware = new DevModeAutoRefreshMiddleware({});
  const next = mock(() => new Response("OK"));

  const request1 = new Request("http://example.com?__beynac_dev_mode_refresh");
  const request2 = new Request("http://example.com?__beynac_dev_mode_refresh");
  const request3 = new Request("http://example.com?__beynac_dev_mode_refresh");

  const response1 = await middleware.handle(request1, next);
  const response2 = await middleware.handle(request2, next);
  const response3 = await middleware.handle(request3, next);

  const reader1 = response1.body?.getReader();
  const reader2 = response2.body?.getReader();
  const reader3 = response3.body?.getReader();
  const decoder = new TextDecoder();

  setTimeout(() => {
    middleware.triggerReload();
  }, 0);

  const readStream = async (reader: any) => {
    let data = "";
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          data += decoder.decode(value as Uint8Array, { stream: true });
        }
      }
    }
    return data;
  };

  const [data1, data2, data3] = await Promise.all([
    readStream(reader1),
    readStream(reader2),
    readStream(reader3),
  ]);

  expect(data1).toContain('data: {"reload": true}');
  expect(data2).toContain('data: {"reload": true}');
  expect(data3).toContain('data: {"reload": true}');
});

test("injects script into HTML response before </body>", async () => {
  const middleware = new DevModeAutoRefreshMiddleware({});
  const html = "<html><body><h1>Test</h1></body></html>";
  const next = mock(
    () =>
      new Response(html, {
        headers: { "Content-Type": "text/html" },
      }),
  );

  const generateScriptSpy = spyOn(middleware as any, "generateScript");
  generateScriptSpy.mockReturnValue("<script>MARKER</script>");

  const request = new Request("http://example.com/test");
  const response = await middleware.handle(request, next);

  const result = await response.text();

  expect(result).toContain("<script>MARKER</script>");
  expect(result).toContain("<h1>Test</h1>");
  expect(result.indexOf("<script>MARKER</script>")).toBeLessThan(result.indexOf("</body>"));
});

test("injects script into HTML response before </html> if no </body>", async () => {
  const middleware = new DevModeAutoRefreshMiddleware({});
  const html = "<html><h1>Test</h1></html>";
  const next = mock(
    () =>
      new Response(html, {
        headers: { "Content-Type": "text/html" },
      }),
  );

  const generateScriptSpy = spyOn(middleware as any, "generateScript");
  generateScriptSpy.mockReturnValue("<script>MARKER</script>");

  const request = new Request("http://example.com/test");
  const response = await middleware.handle(request, next);

  const result = await response.text();

  expect(result).toContain("<script>MARKER</script>");
  expect(result).toContain("<h1>Test</h1>");
  expect(result.indexOf("<script>MARKER</script>")).toBeLessThan(result.indexOf("</html>"));
});

test("injects script at end if no closing tags found", async () => {
  const middleware = new DevModeAutoRefreshMiddleware({});
  const html = "<h1>Test</h1>";
  const next = mock(
    () =>
      new Response(html, {
        headers: { "Content-Type": "text/html" },
      }),
  );

  const generateScriptSpy = spyOn(middleware as any, "generateScript");
  generateScriptSpy.mockReturnValue("<script>MARKER</script>");

  const request = new Request("http://example.com/test");
  const response = await middleware.handle(request, next);

  const result = await response.text();

  expect(result).toContain("<script>MARKER</script>");
  expect(result).toContain("<h1>Test</h1>");
  expect(result).toEndWith("<script>MARKER</script>");
});

test("does not inject script into non-HTML responses", async () => {
  const middleware = new DevModeAutoRefreshMiddleware({});
  const json = JSON.stringify({ test: "data" });
  const next = mock(
    () =>
      new Response(json, {
        headers: { "Content-Type": "application/json" },
      }),
  );

  const generateScriptSpy = spyOn(middleware as any, "generateScript");
  generateScriptSpy.mockReturnValue("<script>MARKER</script>");

  const request = new Request("http://example.com/test");
  const response = await middleware.handle(request, next);

  const result = await response.text();

  expect(result).not.toContain("<script>MARKER</script>");
  expect(result).toBe(json);
  expect(generateScriptSpy).not.toHaveBeenCalled();
});
