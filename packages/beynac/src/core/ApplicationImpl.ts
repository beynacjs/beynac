import { ContainerImpl } from "../container/ContainerImpl";
import { Cookies, Headers, RequestLocals, ViewRenderer } from "../contracts";
import { Application, UrlOptionsNoParams, UrlOptionsWithParams } from "../contracts/Application";
import { Configuration } from "../contracts/Configuration";
import { Container } from "../contracts/Container";
import { type Dispatcher, Dispatcher as DispatcherKey } from "../contracts/Dispatcher";
import { IntegrationContext } from "../contracts/IntegrationContext";
import { DevModeAutoRefreshMiddleware } from "../development/DevModeAutoRefreshMiddleware";
import { DevModeWatchService } from "../development/DevModeWatchService";
import { BeynacError } from "../error";
import { group, Router, RouteUrlGenerator } from "../router";
import { RequestHandler } from "../router/RequestHandler";
import { ViewRendererImpl } from "../view/ViewRendererImpl";
import { CookiesImpl } from "./CookiesImpl";
import { DispatcherImpl } from "./DispatcherImpl";
import { HeadersImpl } from "./HeadersImpl";
import { RequestLocalsImpl } from "./RequestLocalsImpl";

export class ApplicationImpl<RouteParams extends Record<string, string> = {}>
	implements Application<RouteParams>
{
	readonly container: Container;
	#bootstrapped = false;
	#config: Configuration<RouteParams>;
	#urlGenerator?: RouteUrlGenerator;

	constructor(config: Configuration<RouteParams> = {}) {
		this.container = new ContainerImpl();
		this.#config = config;
	}

	bootstrap(): void {
		if (this.#bootstrapped) return;
		this.#bootstrapped = true;

		// Validate appUrl configuration
		if (this.#config.appUrl?.overrideHost) {
			if (this.#config.appUrl.overrideHost.includes("/")) {
				throw new Error(
					`Invalid appUrl.overrideHost: "${this.#config.appUrl.overrideHost}". Host must not contain slashes.`,
				);
			}
			if (this.#config.appUrl.overrideHost.includes("://")) {
				throw new Error(
					`Invalid appUrl.overrideHost: "${this.#config.appUrl.overrideHost}". Host must not contain protocol prefix.`,
				);
			}
		}
		if (this.#config.appUrl?.defaultHost) {
			if (this.#config.appUrl.defaultHost.includes("/")) {
				throw new Error(
					`Invalid appUrl.defaultHost: "${this.#config.appUrl.defaultHost}". Host must not contain slashes.`,
				);
			}
			if (this.#config.appUrl.defaultHost.includes("://")) {
				throw new Error(
					`Invalid appUrl.defaultHost: "${this.#config.appUrl.defaultHost}". Host must not contain protocol prefix.`,
				);
			}
		}

		this.container.singletonInstance(Configuration, this.#config);
		this.container.singletonInstance(Application, this);
		this.container.scoped(Headers, HeadersImpl);
		this.container.scoped(Cookies, CookiesImpl);
		this.container.scoped(RequestLocals, RequestLocalsImpl);
		this.container.singleton(ViewRenderer, ViewRendererImpl);
		this.container.singleton(DispatcherKey, DispatcherImpl);
		this.container.singleton(DevModeAutoRefreshMiddleware);
		this.container.singleton(DevModeWatchService);
		this.container.singleton(Router);
		this.container.singleton(RequestHandler);
		this.container.singleton(RouteUrlGenerator);

		this.#urlGenerator = this.container.get(RouteUrlGenerator);

		// Register routes with dev mode middleware if needed
		if (this.#config.routes) {
			const router = this.container.get(Router);

			// Wrap routes with dev mode middleware if enabled
			if (this.#config.development && !this.#config.devMode?.suppressAutoRefresh) {
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

		// Start dev mode watch service
		if (this.#config.development && !this.#config.devMode?.suppressAutoRefresh) {
			this.container.get(DevModeWatchService).start();
		}
	}

	get events(): Dispatcher {
		return this.container.get(DispatcherKey);
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
}
