import { inject } from "../container";
import { Container } from "../contracts/Container";
import type { Dispatcher, EventListener } from "../contracts/Dispatcher";
import { isClassListener } from "../contracts/Dispatcher";
import { AnyConstructor, getPrototypeChain, SetMultiMap } from "../utils";

type AnyEventListener = EventListener<object>;

export class DispatcherImpl implements Dispatcher {
	#listeners = new SetMultiMap<AnyConstructor, AnyEventListener>();

	#container: Container;

	constructor(container: Container = inject(Container)) {
		this.#container = container;
	}

	addListener<T extends object>(eventClass: AnyConstructor<T>, listener: EventListener<T>): void {
		this.#listeners.add(eventClass, listener as AnyEventListener);
	}

	removeListener(eventClass: AnyConstructor, listener: Function): void {
		this.#listeners.delete(eventClass, listener as AnyEventListener);
	}

	dispatch<T extends object>(event: T): void {
		const listeners = this.#getListeners(event);
		this.#invokeAllListeners(listeners, event);
	}

	dispatchIfHasListeners<T extends object>(eventClass: AnyConstructor<T>, factory: () => T): void;

	dispatchIfHasListeners<T extends object>(
		eventClass: AnyConstructor<T>,
		factory: () => Promise<T>,
	): Promise<void>;

	dispatchIfHasListeners<T extends object>(
		eventClass: AnyConstructor<T>,
		factory: () => T | Promise<T>,
	): void | Promise<void> {
		const listeners = this.#getListeners(eventClass);

		if (listeners.length === 0) {
			return;
		}

		const result = factory();
		if (result instanceof Promise) {
			return result.then((event) => {
				this.#invokeAllListeners(listeners, event);
			});
		}
		this.#invokeAllListeners(listeners, result);
	}

	#getListeners(eventOrClass: object | AnyConstructor): AnyEventListener[] {
		const listeners: AnyEventListener[] = [];
		for (const constructor of getPrototypeChain(eventOrClass)) {
			for (const listener of this.#listeners.get(constructor)) {
				listeners.push(listener);
			}
		}
		return listeners;
	}

	#invokeAllListeners<T extends object>(listeners: AnyEventListener[], event: T): void {
		for (const listener of listeners) {
			if (isClassListener(listener)) {
				const instance = this.#container.get(listener);
				instance.handle(event);
			} else {
				listener(event);
			}
		}
	}
}
