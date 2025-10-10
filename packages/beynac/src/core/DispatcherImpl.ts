import type { Container } from "../container/container";
import type { Dispatcher, EventListener } from "../contracts/Dispatcher";
import { Constructor, getPrototypeChain, SetMultiMap } from "../utils";

/**
 * Implementation of the EventDispatcher interface.
 *
 * This dispatcher allows event listeners to use dependency injection by
 * invoking them through the container's `call()` method.
 */
export class DispatcherImpl implements Dispatcher {
  #listeners = new SetMultiMap<Constructor, EventListener>();

  /**
   * The container instance used for dependency injection in listeners
   */
  #container: Container;

  constructor(container: Container) {
    this.#container = container;
  }

  addListener<T extends object>(eventClass: Constructor<T>, listener: EventListener<T>): void {
    this.#listeners.add(eventClass, listener as EventListener);
  }

  removeListener<T extends object>(eventClass: Constructor<T>, listener: EventListener<T>): void {
    this.#listeners.delete(eventClass, listener as EventListener);
  }

  hasListener<T extends object>(eventClass: Constructor<T>): boolean {
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
