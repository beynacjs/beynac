import { Container } from "../container/container";
import { Application } from "../contracts/Application";
import { Dispatcher as DispatcherKey, type Dispatcher } from "../contracts/Dispatcher";
import { RequestContext } from "../contracts/RequestContext";
import { Router } from "../contracts/Router";
import { BeynacError } from "../error";
import { RouterImpl } from "./RouterImpl";

export class ApplicationImpl extends Container implements Application {
  constructor() {
    super();
    this.bind(Router, {
      factory: (container) => new RouterImpl(container),
      lifecycle: "singleton",
    });
    this.bind(Application, {
      instance: this,
    });
  }

  get events(): Dispatcher {
    return this.get(DispatcherKey);
  }

  async handleRequest(request: Request): Promise<Response> {
    return this.withRequest(request, () => {
      const router = this.get(Router);
      return router.handle(request);
    });
  }

  withRequest<R>(_context: RequestContext | Request, callback: () => R): R {
    if (this.hasScope) {
      throw new BeynacError("Can't start a new request scope, we're already handling a request.");
    }
    return this.withScope(() => {
      return callback();
    });
  }
}
