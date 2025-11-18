import { Storage } from "../contracts";
import { ServiceProvider } from "../core/ServiceProvider";
import { StorageEndpointBuilder, StorageEndpointBuilderImpl } from "./StorageEndpointBuilder";
import { StorageImpl } from "./StorageImpl";

export class StorageServiceProvider extends ServiceProvider {
	override register(): void {
		this.container.singleton(StorageEndpointBuilder, StorageEndpointBuilderImpl);
		this.container.singleton(Storage, StorageImpl);
	}
}
