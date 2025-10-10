import { Container } from "../container/container";
import type { Application } from "../contracts/Application";
import { Dispatcher as DispatcherKey, type Dispatcher } from "../contracts/Dispatcher";
import { RequestHandler } from "../contracts/RequestHandler";

/**
 * Application implementation that handles HTTP requests
 */
export class ApplicationImpl extends Container implements Application {
  /**
   * Get the event dispatcher instance
   */
  get events(): Dispatcher {
    return this.get(DispatcherKey);
  }

  /**
   * Handle an incoming HTTP request
   */
  async handleRequest(request: Request): Promise<Response> {
    const handler = this.get(RequestHandler);
    return await handler.handle(request);
  }
}
