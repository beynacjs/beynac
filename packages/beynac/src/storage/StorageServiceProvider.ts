import { ServiceProvider } from "../core/ServiceProvider";
import { Storage } from "./contracts/Storage";
import { StorageEndpointBuilder, StorageEndpointBuilderImpl } from "./StorageEndpointBuilder";
import { StorageImpl } from "./StorageImpl";

export class StorageServiceProvider extends ServiceProvider {
	override register(): void {
		this.container.singleton(StorageEndpointBuilder, StorageEndpointBuilderImpl);
		this.container.singleton(Storage, StorageImpl);
	}
}
