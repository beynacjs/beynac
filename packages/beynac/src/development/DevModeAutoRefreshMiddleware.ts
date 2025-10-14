import { inject } from "../container/inject";
import { Configuration } from "../contracts/Configuration";
import type { Middleware } from "../core/Middleware";

export class DevModeAutoRefreshMiddleware implements Middleware {
  private reloadListeners = new Set<(reload: boolean) => void>();

  constructor(private config: Configuration = inject(Configuration)) {}

  triggerReload(): void {
    for (const listener of this.reloadListeners) {
      listener(true);
    }
    this.reloadListeners.clear();
  }

  destroy(): void {
    this.reloadListeners.clear();
  }

  handle(
    request: Request,
    next: (request: Request) => Response | Promise<Response>,
  ): Response | Promise<Response> {
    const url = new URL(request.url);

    // Handle SSE endpoint
    if (url.searchParams.has("__beynac_dev_mode_refresh")) {
      return this.handleSSERequest();
    }

    // Get response from next middleware/handler
    const response = next(request);

    // Only inject script into HTML responses
    if (response instanceof Promise) {
      return response.then((r) => this.maybeInjectScript(r));
    }
    return this.maybeInjectScript(response);
  }

  private handleSSERequest(): Response {
    const encoder = new TextEncoder();
    let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

    const heartbeatMs = this.config.devMode?.autoRefreshHeartbeatMs ?? 15000;
    const reloadListeners = this.reloadListeners;

    const stream = new ReadableStream({
      start(controller) {
        let isClosed = false;

        const cleanup = () => {
          if (isClosed) return;
          isClosed = true;
          if (heartbeatInterval) clearInterval(heartbeatInterval);
        };

        // Send heartbeat periodically to keep connection alive
        heartbeatInterval = setInterval(() => {
          if (!isClosed) {
            controller.enqueue(encoder.encode(":heartbeat\n\n"));
          }
        }, heartbeatMs);

        // Listener for reload events
        const listener = () => {
          cleanup();
          controller.enqueue(encoder.encode('data: {"reload": true}\n\n'));
          reloadListeners.delete(listener);
          controller.close();
        };

        reloadListeners.add(listener);
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  private maybeInjectScript(response: Response): Response {
    const contentType = response.headers.get("Content-Type");
    if (!contentType || !contentType.includes("text/html")) {
      return response;
    }

    return this.injectScript(response);
  }

  private injectScript(response: Response): Response {
    const script = this.generateScript();
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();

    const reader = response.body?.getReader();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    let buffer = "";
    let injected = false;

    void (async () => {
      if (!reader) {
        await writer.close();
        return;
      }

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value) continue;

          const chunk: Uint8Array = value;
          buffer += decoder.decode(chunk, { stream: true });

          // Try to inject before </body> or </html>
          if (!injected) {
            const bodyMatch = buffer.match(/<\/body>/i);
            const htmlMatch = buffer.match(/<\/html>/i);

            if (bodyMatch?.index !== undefined) {
              const index = bodyMatch.index;
              const before = buffer.substring(0, index);
              const after = buffer.substring(index);
              await writer.write(encoder.encode(before + script + after));
              buffer = "";
              injected = true;
            } else if (htmlMatch?.index !== undefined) {
              const index = htmlMatch.index;
              const before = buffer.substring(0, index);
              const after = buffer.substring(index);
              await writer.write(encoder.encode(before + script + after));
              buffer = "";
              injected = true;
            } else if (buffer.length > 1000) {
              // Flush buffer if it gets too large without finding a match
              await writer.write(encoder.encode(buffer));
              buffer = "";
            }
          } else {
            // chunk is Uint8Array, safe to write
            await writer.write(chunk);
          }
        }

        // Write any remaining buffer
        if (buffer) {
          if (!injected) {
            // No </body> or </html> found, inject at end
            await writer.write(encoder.encode(buffer + script));
          } else {
            await writer.write(encoder.encode(buffer));
          }
        }

        await writer.close();
      } catch (error) {
        await writer.abort(error);
      }
    })();

    return new Response(readable, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }

  private generateScript(): string {
    return `
<script>
(function() {
  const eventSource = new EventSource('?__beynac_dev_mode_refresh');

  eventSource.onmessage = function(event) {
    const data = JSON.parse(event.data);
    if (data.reload) {
      eventSource.close();
      location.reload();
    }
  };

  eventSource.onerror = function() {
    console.log('[Beynac] Dev mode connection lost, reconnecting...');
  };
})();
</script>`;
  }
}
