import { Configuration } from "../core/contracts/Configuration";
import { ServiceProvider } from "../core/ServiceProvider";
import { DevModeAutoRefreshMiddleware } from "../development/DevModeAutoRefreshMiddleware";
import { CookiesImpl } from "./CookiesImpl";
import { Cookies } from "./contracts/Cookies";
import { Headers } from "./contracts/Headers";
import { KeepAlive } from "./contracts/KeepAlive";
import { RequestLocals } from "./contracts/RequestLocals";
import { HeadersImpl } from "./HeadersImpl";
import { group } from "./helpers";
import { KeepAliveImpl } from "./KeepAliveImpl";
import { RequestHandler } from "./RequestHandler";
import { RequestLocalsImpl } from "./RequestLocalsImpl";
import { Router } from "./Router";
import { RouteUrlGenerator } from "./RouteUrlGenerator";

export class HttpServiceProvider extends ServiceProvider {
	override register(): void {
		this.container.singleton(Router);
		this.container.singleton(RequestHandler);
		this.container.singleton(RouteUrlGenerator);
		this.container.scoped(Headers, HeadersImpl);
		this.container.scoped(Cookies, CookiesImpl);
		this.container.scoped(RequestLocals, RequestLocalsImpl);
		this.container.scoped(KeepAlive, KeepAliveImpl);
	}

	override boot(): void {
		const config = this.container.get(Configuration);
		const router = this.container.get(Router);
		const urlGenerator = this.container.get(RouteUrlGenerator);

		if (config.routes) {
			const autoRefreshEnabled = config.development && config.devMode?.autoRefresh !== false;

			if (autoRefreshEnabled) {
				const wrappedRoutes = group({ middleware: DevModeAutoRefreshMiddleware }, [config.routes]);
				router.register(wrappedRoutes);
				urlGenerator.register(wrappedRoutes);
			} else {
				router.register(config.routes);
				urlGenerator.register(config.routes);
			}
		}
	}
}
