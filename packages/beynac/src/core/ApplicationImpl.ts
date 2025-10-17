import { ContainerImpl } from "../container/ContainerImpl";
import type { Container } from "../contracts";
import { Cookies, Headers } from "../contracts";
import { Application } from "../contracts/Application";
import { Configuration } from "../contracts/Configuration";
import { Dispatcher as DispatcherKey, type Dispatcher } from "../contracts/Dispatcher";
import { RequestContext } from "../contracts/RequestContext";
import { DevModeAutoRefreshMiddleware } from "../development/DevModeAutoRefreshMiddleware";
import { DevModeWatchService } from "../development/DevModeWatchService";
import { BeynacError } from "../error";
import { group, Router, RouteRegistry, type UrlFunction } from "../router";
import { CookiesImpl } from "./CookiesImpl";
import { HeadersImpl } from "./HeadersImpl";

export class ApplicationImpl<RouteParams extends Record<string, string> = {}>
  implements Application<RouteParams>
{
  container: Container;
  #bootstrapped = false;
  #config: Configuration<RouteParams>;
  #routeRegistry: RouteRegistry<RouteParams> | null = null;

  constructor(config: Configuration<RouteParams> = {}) {
    this.container = new ContainerImpl();
    this.#config = config;
  }

  bootstrap(): void {
    if (this.#bootstrapped) return;
    this.#bootstrapped = true;

    // Bind core services
    this.container.scoped(Headers, HeadersImpl);
    this.container.scoped(Cookies, CookiesImpl);
    this.container.singleton(DevModeAutoRefreshMiddleware);
    this.container.singleton(DevModeWatchService);
    this.container.instance(Configuration, this.#config);
    this.container.instance(Application, this);

    // Create and bind Router
    this.container.bind(Router, {
      factory: () => new Router(this.container),
      lifecycle: "singleton",
    });

    // Register routes with dev mode middleware if needed
    if (this.#config.routes) {
      const router = this.container.get(Router);

      // Wrap routes with dev mode middleware if enabled
      if (this.#config.development && !this.#config.devMode?.suppressAutoRefresh) {
        const wrappedRoutes = group({ middleware: DevModeAutoRefreshMiddleware }, [
          this.#config.routes,
        ]);
        router.register(wrappedRoutes);
      } else {
        router.register(this.#config.routes);
      }
    }

    // Start dev mode watch service
    if (this.#config.development && !this.#config.devMode?.suppressAutoRefresh) {
      this.container.get(DevModeWatchService).start();
    }
  }

  get events(): Dispatcher {
    return this.container.get(DispatcherKey);
  }

  url: UrlFunction<RouteParams> = (name, ...args) => {
    if (!this.#routeRegistry) {
      this.#routeRegistry = new RouteRegistry(this.#config.routes);
    }
    return this.#routeRegistry.url(name, ...args);
  };

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
