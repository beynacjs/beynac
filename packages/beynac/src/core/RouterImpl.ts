// TODO rou3 dep is pre 1.0, if it has no 1.0 release before us then consider switch to radix3
import { addRoute, createRouter, findRoute, RouterContext } from "rou3";
import { inject } from "../container/inject";
import { Application, type Application as IApplication } from "../contracts/Application";
import { Configuration } from "../contracts/Configuration";
import type { ExtractRouteParams, RouteHandler, Router } from "../contracts/Router";
import { DevModeAutoRefreshMiddleware } from "../development/DevModeAutoRefreshMiddleware";
import { arrayWrap } from "../utils";
import type { MiddlewareReference } from "./Middleware";

type RouteData = {
  handler: RouteHandler;
  middleware: MiddlewareReference[];
};

export class RouterImpl implements Router {
  private router: RouterContext<RouteData>;
  private middlewareStack: MiddlewareReference[] = [];

  constructor(
    private app: IApplication = inject(Application),
    private config: Configuration = inject(Configuration),
  ) {
    this.router = createRouter();

    // Add dev mode middleware if enabled
    if (this.config.development && !this.config.devMode?.suppressAutoRefresh) {
      this.middlewareStack.push(DevModeAutoRefreshMiddleware);
    }
  }

  get<Path extends string>(uri: Path, handler: RouteHandler<ExtractRouteParams<Path>>): Router {
    return this.#addRoute("GET", uri, handler);
  }

  post<Path extends string>(uri: Path, handler: RouteHandler<ExtractRouteParams<Path>>): Router {
    return this.#addRoute("POST", uri, handler);
  }

  put<Path extends string>(uri: Path, handler: RouteHandler<ExtractRouteParams<Path>>): Router {
    return this.#addRoute("PUT", uri, handler);
  }

  delete<Path extends string>(uri: Path, handler: RouteHandler<ExtractRouteParams<Path>>): Router {
    return this.#addRoute("DELETE", uri, handler);
  }

  patch<Path extends string>(uri: Path, handler: RouteHandler<ExtractRouteParams<Path>>): Router {
    return this.#addRoute("PATCH", uri, handler);
  }

  options<Path extends string>(uri: Path, handler: RouteHandler<ExtractRouteParams<Path>>): Router {
    return this.#addRoute("OPTIONS", uri, handler);
  }

  middleware(
    middleware: MiddlewareReference | MiddlewareReference[],
    callback: (router: Router) => void,
  ): void {
    const oldStack = this.middlewareStack;
    this.middlewareStack = [...oldStack, ...arrayWrap(middleware)];
    try {
      callback(this);
    } finally {
      this.middlewareStack = oldStack;
    }
  }

  #addRoute<Path extends string>(method: string, uri: Path, handler: RouteHandler): Router {
    addRoute(this.router, method, uri, {
      handler,
      middleware: this.middlewareStack,
    });
    return this;
  }

  handle(request: Request): Promise<Response> {
    const url = new URL(request.url);

    const match = this.#match(request.method, url.pathname);
    if (!match) {
      return Promise.resolve(new Response("Not Found", { status: 404 }));
    }

    let { handler, params, middleware } = match;

    const finalHandler = (req: Request): Response | Promise<Response> => {
      if (typeof handler === "function") {
        handler = this.app.container.get(handler);
      }

      return handler.handle(req, params);
    };

    return Promise.resolve(this.#executeMiddlewarePipeline(middleware, request, finalHandler));
  }

  #executeMiddlewarePipeline(
    middlewareRefs: MiddlewareReference[],
    request: Request,
    finalHandler: (request: Request) => Response | Promise<Response>,
  ): Response | Promise<Response> {
    const middlewareInstances = middlewareRefs.map((ref) => {
      if (typeof ref === "function") {
        return this.app.container.get(ref);
      }
      return ref;
    });

    // Build the pipeline from innermost to outermost as it executes in reverse order
    let next: (request: Request) => Response | Promise<Response> = finalHandler;

    for (let i = middlewareInstances.length - 1; i >= 0; i--) {
      const middleware = middlewareInstances[i];
      const currentNext = next;
      next = (request: Request) => middleware.handle(request, currentNext);
    }

    return next(request);
  }

  #match(method: string, path: string) {
    const result = findRoute(this.router, method, path);
    if (!result) {
      return undefined;
    }
    const data = result.data;
    return {
      handler: data.handler,
      params: result.params || {},
      middleware: data.middleware,
    };
  }
}
