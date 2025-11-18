import { ContainerImpl } from "../container/ContainerImpl";
import { Cookies, Headers, KeepAlive, RequestLocals, Storage, ViewRenderer } from "../contracts";
import type { UrlOptionsNoParams, UrlOptionsWithParams } from "../contracts/Application";
import { Application } from "../contracts/Application";
import type { ServiceProviderReference } from "../contracts/Configuration";
import { Configuration } from "../contracts/Configuration";
import type { Container } from "../contracts/Container";
import { type Dispatcher, Dispatcher as DispatcherKey } from "../contracts/Dispatcher";
import { IntegrationContext } from "../contracts/IntegrationContext";
import { DevModeAutoRefreshMiddleware } from "../development/DevModeAutoRefreshMiddleware";
import { DevModeWatchService } from "../development/DevModeWatchService";
import { BeynacError } from "../error";
import { group, Router, RouteUrlGenerator } from "../http";
import { RequestHandler } from "../http/RequestHandler";
import { StorageServiceProvider } from "../storage/StorageServiceProvider";
import { BaseClass } from "../utils";
import { ViewRendererImpl } from "../view/ViewRendererImpl";
import { CookiesImpl } from "./CookiesImpl";
import { DispatcherImpl } from "./DispatcherImpl";
import { HeadersImpl } from "./HeadersImpl";
import { KeepAliveImpl } from "./KeepAliveImpl";
import { RequestLocalsImpl } from "./RequestLocalsImpl";
import type { ServiceProvider } from "./ServiceProvider";

const DEFAULT_PROVIDERS = [StorageServiceProvider];

export class ApplicationImpl<RouteParams extends Record<string, string> = {}>
	extends BaseClass
	implements Application<RouteParams>
{
	readonly container: Container;
	#bootstrapped = false;
	#config: Configuration<RouteParams>;
	#urlGenerator?: RouteUrlGenerator;

	constructor(config: Configuration<RouteParams> = {}) {
		super();
		this.container = new ContainerImpl();
		this.#config = config;
		if (config.appUrl?.overrideHost?.includes("/")) {
			throw new Error(
				`Invalid appUrl.overrideHost: "${config.appUrl.overrideHost}". Host must not contain slashes.`,
			);
		}
		if (config.appUrl?.defaultHost?.includes("/")) {
			throw new Error(
				`Invalid appUrl.defaultHost: "${config.appUrl.defaultHost}". Host must not contain slashes.`,
			);
		}
	}

	bootstrap(): void {
		if (this.#bootstrapped) return;
		this.#bootstrapped = true;

		this.container.singletonInstance(Configuration, this.#config);
		this.container.singletonInstance(Application, this);
		this.container.scoped(Headers, HeadersImpl);
		this.container.scoped(Cookies, CookiesImpl);
		this.container.scoped(RequestLocals, RequestLocalsImpl);
		this.container.scoped(KeepAlive, KeepAliveImpl);
		this.container.singleton(ViewRenderer, ViewRendererImpl);
		this.container.singleton(DispatcherKey, DispatcherImpl);
		this.container.singleton(DevModeAutoRefreshMiddleware);
		this.container.singleton(DevModeWatchService);
		this.container.singleton(Router);
		this.container.singleton(RequestHandler);
		this.container.singleton(RouteUrlGenerator);

		this.#urlGenerator = this.container.get(RouteUrlGenerator);

		const autoRefreshEnabled =
			this.#config.development &&
			// TODO add configuration defaults so that each code usage doesn't need to know about the correct default
			this.#config.devMode?.autoRefresh !== false;

		// Register routes with dev mode middleware if needed
		if (this.#config.routes) {
			const router = this.container.get(Router);
			if (autoRefreshEnabled) {
				const wrappedRoutes = group({ middleware: DevModeAutoRefreshMiddleware }, [
					this.#config.routes,
				]);
				router.register(wrappedRoutes);
				this.#urlGenerator.register(wrappedRoutes);
			} else {
				router.register(this.#config.routes);
				this.#urlGenerator.register(this.#config.routes);
			}
		}
		if (autoRefreshEnabled) {
			this.container.get(DevModeWatchService).start();
		}

		// Register phase - combine default and user providers
		this.#registerServiceProviders(DEFAULT_PROVIDERS);
		this.#registerServiceProviders(this.#config.providers ?? []);
		this.#bootServiceProviders();
	}

	get events(): Dispatcher {
		return this.container.get(DispatcherKey);
	}

	get storage(): Storage {
		return this.container.get(Storage);
	}

	url<N extends keyof RouteParams & string>(
		name: N,
		...args: RouteParams[N] extends never
			? [] | [options?: UrlOptionsNoParams]
			: [options: UrlOptionsWithParams<RouteParams[N]>]
	): string {
		if (!this.#urlGenerator) {
			throw new Error("Can't call url() before the application is bootstrapped.");
		}
		return this.#urlGenerator.url(name, args[0]);
	}

	async handleRequest(request: Request, context: IntegrationContext): Promise<Response> {
		// Enrich context with requestUrl if not already provided
		const enrichedContext: IntegrationContext = {
			...context,
			requestUrl: context.requestUrl ?? new URL(request.url),
		};

		return this.withIntegration(enrichedContext, async () => {
			const router = this.container.get(Router);
			const requestHandler = this.container.get(RequestHandler);

			const { match, methodMismatch } = router.lookup(request);

			if (!match) {
				return methodMismatch
					? new Response("Method Not Allowed", { status: 405 })
					: new Response("Not Found", { status: 404 });
			}

			return requestHandler.handle(match);
		});
	}

	withIntegration<R>(context: IntegrationContext, callback: () => R): R {
		if (this.container.hasScope) {
			throw new BeynacError("Can't start a new request scope, we're already handling a request.");
		}
		return this.container.withScope(() => {
			this.container.scopedInstance(IntegrationContext, context);
			return callback();
		});
	}

	#serviceProvidersToBoot: ServiceProvider[] = [];
	#hasBooted = true;

	registerServiceProvider(provider: ServiceProvider | ServiceProviderReference): void {
		if (typeof provider === "function") {
			provider = new provider(this);
		}
		provider.register();
		this.#serviceProvidersToBoot.push(provider);
		if (this.#hasBooted) {
			this.#bootServiceProviders();
		}
	}

	#registerServiceProviders(providers: ServiceProviderReference[]): void {
		for (const provider of providers) {
			this.registerServiceProvider(provider);
		}
	}

	#bootServiceProviders(): void {
		try {
			if (this.#serviceProvidersToBoot) {
				for (const provider of this.#serviceProvidersToBoot) {
					provider.boot();
				}
			}
		} finally {
			this.#hasBooted = true;
			this.#serviceProvidersToBoot.length = 0;
		}
	}
}
