import { inject } from "../container";
import { createTypeToken, type TypeToken } from "../container/container-key";
import { Container } from "../container/contracts/Container";
import { BaseClass } from "../utils";
import type { StorageAdapter, StorageEndpoint } from "./contracts/Storage";
import { isConfiguredStorageDriver } from "./storage-utils";

export interface StorageEndpointBuilder {
	build(adapter: StorageAdapter | StorageEndpoint): StorageEndpoint;
}

export class StorageEndpointBuilderImpl extends BaseClass implements StorageEndpointBuilder {
	#container: Container;

	constructor(container: Container = inject(Container)) {
		super();
		this.#container = container;
	}

	build(adapterOrEndpoint: StorageAdapter | StorageEndpoint): StorageEndpoint {
		if (isConfiguredStorageDriver(adapterOrEndpoint)) {
			return adapterOrEndpoint.build(this.#container);
		}
		return adapterOrEndpoint;
	}
}

export const StorageEndpointBuilder: TypeToken<StorageEndpointBuilder> =
	createTypeToken("StorageEndpointBuilder");
