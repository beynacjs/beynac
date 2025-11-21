import { Configuration } from "../core/contracts/Configuration";
import { ServiceProvider } from "../core/ServiceProvider";
import { DevModeAutoRefreshMiddleware } from "./DevModeAutoRefreshMiddleware";
import { DevModeWatchService } from "./DevModeWatchService";

export class DevelopmentServiceProvider extends ServiceProvider {
	override register(): void {
		this.container.singleton(DevModeAutoRefreshMiddleware);
		this.container.singleton(DevModeWatchService);
	}

	override boot(): void {
		const config = this.container.get(Configuration);

		const autoRefreshEnabled =
			config.development &&
			// TODO add configuration defaults so that each code usage doesn't need to know about the correct default
			config.devMode?.autoRefresh !== false;

		if (autoRefreshEnabled) {
			this.container.get(DevModeWatchService).start();
		}
	}
}
