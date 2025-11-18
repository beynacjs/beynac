import { ServiceProvider } from "../core/ServiceProvider";
import { ViewRenderer } from "./contracts/ViewRenderer";
import { ViewRendererImpl } from "./ViewRendererImpl";

export class ViewServiceProvider extends ServiceProvider {
	override register(): void {
		this.container.singleton(ViewRenderer, ViewRendererImpl);
	}
}
