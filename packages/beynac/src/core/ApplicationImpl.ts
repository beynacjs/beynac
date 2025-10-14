import { Container } from "../container/container";
import { Cookies, Headers } from "../contracts";
import { Application } from "../contracts/Application";
import { Dispatcher as DispatcherKey, type Dispatcher } from "../contracts/Dispatcher";
import { RequestContext } from "../contracts/RequestContext";
import { Router } from "../contracts/Router";
import { BeynacError } from "../error";
import { Configuration } from "./Configuration";
import { CookiesImpl } from "./CookiesImpl";
import { HeadersImpl } from "./HeadersImpl";
import { RouterImpl } from "./RouterImpl";

export class ApplicationImpl extends Container implements Application {
  #bootstrapped = false;
  #config: Configuration;

  constructor(config: Configuration = {}) {
    super();
    this.#config = config;
  }

  bootstrap(): void {
    if (this.#bootstrapped) return;
    this.#bootstrapped = true;
    this.bind(Router, {
      factory: () => new RouterImpl(),
      lifecycle: "singleton",
    });
    this.bind(Headers, {
      factory: () => new HeadersImpl(),
      lifecycle: "scoped",
    });
    this.bind(Cookies, {
      factory: () => new CookiesImpl(),
      lifecycle: "scoped",
    });
    this.bind(Application, {
      instance: this,
    });
    if (this.#config.routes) {
      this.#config.routes(this.get(Router));
    }
  }

  get events(): Dispatcher {
    return this.get(DispatcherKey);
  }

  async handleRequest(request: Request, context: RequestContext): Promise<Response> {
    return this.withRequestContext(context, () => {
      const router = this.get(Router);
      return router.handle(request);
    });
  }

  withRequestContext<R>(context: RequestContext, callback: () => R): R {
    if (this.hasScope) {
      throw new BeynacError("Can't start a new request scope, we're already handling a request.");
    }
    return this.withScope(() => {
      this.bind(RequestContext, { lifecycle: "scoped", factory: () => context });
      return callback();
    });
  }
}
