import { Dispatcher } from "./contracts/Dispatcher";
import { DispatcherImpl } from "./DispatcherImpl";
import { ServiceProvider } from "./ServiceProvider";

export class CoreServiceProvider extends ServiceProvider {
	override register(): void {
		this.container.singleton(Dispatcher, DispatcherImpl);
	}
}
