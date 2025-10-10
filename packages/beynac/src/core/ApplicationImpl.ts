import { Container } from "../container/container";
import type { Application } from "../contracts/Application";
import { Dispatcher as DispatcherKey, type Dispatcher } from "../contracts/Dispatcher";
import { RequestHandler } from "../contracts/RequestHandler";
import { RequestHandlerImpl } from "./RequestHandlerImpl";

/**
 * Application implementation that handles HTTP requests
 */
export class ApplicationImpl extends Container implements Application {
  #hasBeenBootstrapped = false;
  #bootstrapPromise: Promise<void> | null = null;

  async bootstrap(): Promise<void> {
    if (this.#hasBeenBootstrapped) {
      await this.#bootstrapPromise;
      return;
    }
    this.#hasBeenBootstrapped = true;
    this.#bootstrapPromise = new Promise((resolve) => {
      this.bind(RequestHandler, {
        factory: () => new RequestHandlerImpl(),
        lifecycle: "singleton",
      });
      resolve();
    });
    await this.#bootstrapPromise;
  }

  get events(): Dispatcher {
    return this.get(DispatcherKey);
  }

  /**
   * Handle an incoming HTTP request
   */
  async handleRequest(request: Request): Promise<Response> {
    await this.bootstrap();
    const handler = this.get(RequestHandler);
    return await handler.handle(request);
  }
}
