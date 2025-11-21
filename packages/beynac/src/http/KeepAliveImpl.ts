import { inject } from "../container/inject";
import { IntegrationContext } from "../integrations/IntegrationContext";
import { BaseClass } from "../utils";
import type { KeepAlive } from "./contracts/KeepAlive";

export class KeepAliveImpl extends BaseClass implements KeepAlive {
	constructor(private integrationContext: IntegrationContext = inject(IntegrationContext)) {
		super();
	}

	waitUntil(task: Promise<void>): void {
		const addKeepAliveTask = this.integrationContext.addKeepAliveTask;
		if (!addKeepAliveTask) {
			throw new Error(
				`Cannot add keep-alive task in context "${this.integrationContext.context}": keep-alive tasks are not supported`,
			);
		}
		addKeepAliveTask(task);
	}
}
