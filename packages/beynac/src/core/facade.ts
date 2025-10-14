import type { KeyOrClass } from "../container/container-key";
import type { Application } from "../contracts/Application";

type UnknownRecord = Record<string | symbol, unknown>;

let application: Application | null = null;

/**
 * Set the global application instance for facades.
 */
export const setFacadeApplication = (facadeApplication: Application | null): void => {
  application = facadeApplication ?? null;
};

/**
 * Get the global application instance for facades.
 */
export const getFacadeApplication = (): Application | null => {
  return application;
};

/**
 * Create a facade object that proxies method and property access to a container object
 *
 * @param key The key to look up in the container
 */
export function createFacade<T extends object>(key: KeyOrClass<T | undefined>): T {
  let lifecycleChecked = false;

  const getInstance = (): UnknownRecord => {
    if (!application) {
      throw new Error(
        "Global application instance is not available. Ensure createApplication() has been called.",
      );
    }

    if (!lifecycleChecked) {
      const lifecycle = application.getLifecycle(key);
      if (lifecycle === "transient") {
        throw new Error(
          `Cannot create facade for transient binding ${String(key)}. Facades only support singleton and scoped bindings.`,
        );
      }
      lifecycleChecked = true;
    }

    return application.get(key) as UnknownRecord;
  };

  return new Proxy({} as object, {
    get: (_target, prop) => {
      const instance = getInstance();
      let value = instance[prop];
      if (typeof value === "function") {
        // must bind function to instance, otherwise #private fields won't work
        value = value.bind(instance);
      }
      return value;
    },
    set: (_target, prop, value) => {
      getInstance()[prop] = value;
      return true;
    },
    has: (_target, prop) => {
      return prop in getInstance();
    },
    ownKeys: (_target) => {
      return Object.keys(getInstance());
    },
    getOwnPropertyDescriptor: (_target, prop) => {
      return Object.getOwnPropertyDescriptor(getInstance(), prop);
    },
  }) as T;
}
