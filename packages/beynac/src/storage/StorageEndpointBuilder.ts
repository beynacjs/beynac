import { inject } from "../container";
import { createTypeToken, type TypeToken } from "../container/container-key";
import { Container } from "../contracts";
import type { ConfiguredStorageDriver, StorageEndpoint } from "../contracts/Storage";
import { BaseClass } from "../utils";
import { isConfiguredStorageDriver } from "./storage-utils";

export interface StorageEndpointBuilder {
	build(driver: ConfiguredStorageDriver | StorageEndpoint): StorageEndpoint;
}

export class StorageEndpointBuilderImpl extends BaseClass implements StorageEndpointBuilder {
	#container: Container;

	constructor(container: Container = inject(Container)) {
		super();
		this.#container = container;
	}

	build(driverOrEndpoint: ConfiguredStorageDriver | StorageEndpoint): StorageEndpoint {
		if (isConfiguredStorageDriver(driverOrEndpoint)) {
			return driverOrEndpoint.build(this.#container);
		}
		return driverOrEndpoint;
	}
}

export const StorageEndpointBuilder: TypeToken<StorageEndpointBuilder> =
	createTypeToken("StorageEndpointBuilder");
