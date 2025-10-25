import { ContainerImpl } from "../container/ContainerImpl";
import { Cookies, Headers, RequestLocals } from "../contracts";
import { Application } from "../contracts/Application";
import { Configuration } from "../contracts/Configuration";
import { Container } from "../contracts/Container";
import { type Dispatcher, Dispatcher as DispatcherKey } from "../contracts/Dispatcher";
import { RequestContext } from "../contracts/RequestContext";
import { DevModeAutoRefreshMiddleware } from "../development/DevModeAutoRefreshMiddleware";
import { DevModeWatchService } from "../development/DevModeWatchService";
import { BeynacError } from "../error";
import { group, RouteRegistry, Router } from "../router";
import { RequestHandler } from "../router/RequestHandler";
import { UrlFunction } from "../router/router-types";
import { CookiesImpl } from "./CookiesImpl";
import { HeadersImpl } from "./HeadersImpl";
import { RequestLocalsImpl } from "./RequestLocalsImpl";

export class ApplicationImpl<RouteParams extends Record<string, string> = {}>
	implements Application<RouteParams>
{
	readonly container: Container;
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
		this.container.instance(Container, this.container);
		this.container.instance(Configuration, this.#config);
		this.container.instance(Application, this);
		this.container.scoped(Headers, HeadersImpl);
		this.container.scoped(Cookies, CookiesImpl);
		this.container.scoped(RequestLocals, RequestLocalsImpl);
		this.container.singleton(DevModeAutoRefreshMiddleware);
		this.container.singleton(DevModeWatchService);
		this.container.singleton(Router);
		this.container.singleton(RequestHandler);

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
		return this.withRequestContext(context, async () => {
			const router = this.container.get(Router);
			const requestHandler = this.container.get(RequestHandler);

			const match = router.lookup(request);

			if (!match) {
				return new Response("Not Found", { status: 404 });
			}

			return requestHandler.handle(match);
		});
	}

	withRequestContext<R>(context: RequestContext, callback: () => R): R {
		if (this.container.hasScope) {
			throw new BeynacError("Can't start a new request scope, we're already handling a request.");
		}
		return this.container.withScope(() => {
			this.container.bind(RequestContext, {
				lifecycle: "scoped",
				factory: () => context,
			});
			return callback();
		});
	}
}
