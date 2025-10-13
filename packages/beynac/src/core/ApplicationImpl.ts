import { Container } from "../container/container";
import type { Application } from "../contracts/Application";
import { Dispatcher as DispatcherKey, type Dispatcher } from "../contracts/Dispatcher";
import { RequestContext } from "../contracts/RequestContext";
import { RequestHandler } from "../contracts/RequestHandler";
import { BeynacError } from "../error";
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
   * Handle an incoming HTTP request. The request will be routed to the
   * appropriate handler and will go through the middle
   */
  async handleRequest(request: Request): Promise<Response> {
    await this.bootstrap();
    const handler = this.get(RequestHandler);
    return await handler.handle(request);
  }

  /**
   * Execute a callback in a context where request data is available. This
   * enabled Beynac features that require request data, like the `Cookies` and
   * `Headers` facades, and features like authentication that build on
   */
  withRequest<R>(_context: RequestContext | Request, callback: () => R): R {
    if (this.hasScope) {
      throw new BeynacError("Can't start a new request scope, we're already handling a request.");
    }
    return this.withScope(() => {
      return callback();
    });
  }
}
