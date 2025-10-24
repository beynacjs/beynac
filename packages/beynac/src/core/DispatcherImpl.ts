import type { Container } from "../contracts/Container";
import type { Dispatcher } from "../contracts/Dispatcher";
import { AnyConstructor, getPrototypeChain, SetMultiMap } from "../utils";

type AnyEventListener = (event: unknown) => void;

export class DispatcherImpl implements Dispatcher {
	#listeners = new SetMultiMap<AnyConstructor, AnyEventListener>();

	#container: Container;

	constructor(container: Container) {
		this.#container = container;
	}

	addListener<T extends object>(eventClass: AnyConstructor<T>, listener: (event: T) => void): void {
		this.#listeners.add(eventClass, listener as AnyEventListener);
	}

	removeListener(eventClass: AnyConstructor, listener: Function): void {
		this.#listeners.delete(eventClass, listener as AnyEventListener);
	}

	hasListener(eventClass: AnyConstructor): boolean {
		for (const constructor of getPrototypeChain(eventClass)) {
			if (this.#listeners.hasAny(constructor)) {
				return true;
			}
		}
		return false;
	}

	dispatch<T extends object>(event: T): void {
		for (const constructor of getPrototypeChain(event)) {
			for (const listener of this.#listeners.get(constructor)) {
				this.#container.call(() => listener(event));
			}
		}
	}
}
