import type { Container } from "../container";
import { ContainerImpl } from "../container/ContainerImpl";
import { Cookies, Headers } from "../contracts";
import { Application } from "../contracts/Application";
import { Configuration } from "../contracts/Configuration";
import { Dispatcher as DispatcherKey, type Dispatcher } from "../contracts/Dispatcher";
import { RequestContext } from "../contracts/RequestContext";
import { Router } from "../contracts/Router";
import { DevModeAutoRefreshMiddleware } from "../development/DevModeAutoRefreshMiddleware";
import { DevModeWatchService } from "../development/DevModeWatchService";
import { BeynacError } from "../error";
import { CookiesImpl } from "./CookiesImpl";
import { HeadersImpl } from "./HeadersImpl";
import { RouterImpl } from "./RouterImpl";

export class ApplicationImpl implements Application {
  container: Container;
  #bootstrapped = false;
  #config: Configuration;

  constructor(config: Configuration = {}) {
    this.container = new ContainerImpl();
    this.#config = config;
  }

  bootstrap(): void {
    if (this.#bootstrapped) return;
    this.#bootstrapped = true;
    this.container.singleton(Router, RouterImpl);
    this.container.scoped(Headers, HeadersImpl);
    this.container.scoped(Cookies, CookiesImpl);
    this.container.instance(Configuration, this.#config);
    this.container.instance(Application, this);
    if (this.#config.routes) {
      this.#config.routes(this.container.get(Router));
    }
    if (this.#config.development && !this.#config.devMode?.suppressAutoRefresh) {
      this.container.singleton(DevModeAutoRefreshMiddleware);
      this.container.singleton(DevModeWatchService);
      this.container.get(DevModeWatchService).start();
    }
  }

  get events(): Dispatcher {
    return this.container.get(DispatcherKey);
  }

  async handleRequest(request: Request, context: RequestContext): Promise<Response> {
    return this.withRequestContext(context, () => {
      const router = this.container.get(Router);
      return router.handle(request);
    });
  }

  withRequestContext<R>(context: RequestContext, callback: () => R): R {
    if (this.container.hasScope) {
      throw new BeynacError("Can't start a new request scope, we're already handling a request.");
    }
    return this.container.withScope(() => {
      this.container.bind(RequestContext, { lifecycle: "scoped", factory: () => context });
      return callback();
    });
  }
}
