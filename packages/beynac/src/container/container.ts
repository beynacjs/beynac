import { AsyncLocalStorage } from "node:async_hooks";
import { BeynacError } from "../error";
import { isKey, type Key } from "../keys";
import {
  ArrayMultiMap,
  arrayWrap,
  describeType,
  getPrototypeChain,
  MethodNamesWithNoRequiredArgs,
  type NoArgConstructor,
  SetMultiMap,
} from "../utils";
import { ContextualBindingBuilder } from "./ContextualBindingBuilder";
import { getKeyName, type KeyOrClass } from "./container-key";
import { _getInjectHandler, _setInjectHandler } from "./inject";
import { NO_VALUE, type NoValue } from "./no-value";

/**
 * A function that produces an instance of T
 */
export type FactoryFunction<T, C extends Container> = (container: C) => {
  [K in keyof T]: T[K];
};

export type Lifecycle = "transient" | "singleton" | "scoped";

type ContextualOverrides = Map<KeyOrClass, FactoryFunction<unknown, Container>>;

type AnyFactory = (container: Container) => unknown;

type CommonBindingProperties = {
  contextualOverrides?: ContextualOverrides;
  extenders?: ExtenderCallback[];
  reverseAliases?: Set<KeyOrClass>;
  resolvingCallbacks?: InstanceCallback<unknown>[];
};

type ConcreteBinding = {
  type: "concrete";
  key: KeyOrClass;
  factory?: AnyFactory;
  lifecycle: Lifecycle;
  instance?: unknown;
  resolved?: boolean;
} & CommonBindingProperties;

type AliasBinding = {
  type: "alias";
  key: KeyOrClass;
  to: KeyOrClass;
} & CommonBindingProperties;

type ImplicitBinding = {
  type: "implicit";
  key: KeyOrClass;
  resolved?: boolean;
} & CommonBindingProperties;

type Binding = ConcreteBinding | AliasBinding | ImplicitBinding;

type SharedBindArgs = {
  lifecycle?: Lifecycle;
  ifNotBound?: boolean;
};

type InstanceBindArgs<T> = {
  instance: T;
  lifecycle?: "singleton";
};

type BindKeyToInstanceArgs<T> = SharedBindArgs & InstanceBindArgs<T>;
type BindKeyToFactoryArgs<T, C extends Container> = SharedBindArgs & {
  factory: FactoryFunction<T, C>;
};

type BindKeyArgs<T, C extends Container> = BindKeyToInstanceArgs<T> | BindKeyToFactoryArgs<T, C>;

type BindClassToFactoryArgs<T, C extends Container> = SharedBindArgs & {
  factory?: FactoryFunction<T, C> | null;
};
type BindClassToInstanceArgs<T> = SharedBindArgs & InstanceBindArgs<T>;

type BindClassArgs<T, C extends Container> =
  | BindClassToInstanceArgs<T>
  | BindClassToFactoryArgs<T, C>;

type AnyBindArgs<T, C extends Container> = {
  factory?: FactoryFunction<T, C> | null;
  instance?: T;
} & SharedBindArgs;

type ExtenderCallback<T = unknown, C extends Container = Container> = (
  instance: T,
  container: C,
) => T;

export type InstanceCallback<T> = (instance: T, container: Container) => void;

export type TypeCallback<T> = (key: KeyOrClass<T>, container: Container) => void;

/**
 * A type-safe Inversion of Control (IoC) container. Essentially a fancy map of
 * keys (class objects or type tokens) to values (instances of the types
 * referred to by the class or token).
 *
 * Key features include:
 *
 * - get(MyClass): create an instance of MyClass
 * - bind(MyClass, () => ...): register a method to control how MyClass is constructed
 * - singleton(MyClass): all future calls to get(MyClass) will return the same object
 * - scoped(MyClass): each request gets a separate instance of MyClass
 *
 * See: {@link TODO link to IoC docs}
 */
export class Container {
  #bindings = new Map<KeyOrClass, Binding>();
  #buildStack: Set<KeyOrClass> = new Set();
  #tags = new SetMultiMap<KeyOrClass, KeyOrClass>();
  #scopeStorage = new AsyncLocalStorage<Map<KeyOrClass, unknown>>();

  #reboundCallbacks = new ArrayMultiMap<KeyOrClass, InstanceCallback<unknown>>();

  /**
   * All of the resolving callbacks by class type.
   */
  #resolvingCallbacks = new ArrayMultiMap<KeyOrClass, InstanceCallback<unknown>>();

  /**
   * Bind a value to a type token in the IoC container
   *
   * @param key a type token created with typeKey
   * @param args arguments to control how the value is bound:
   * @param args.factory a factory function to generate an instance - required
   *                     when binding a type token.
   * @param args.instance an instance to register as a singleton. When
   *                      providing an instance, `factory` must not be
   *                      provided and `lifecycle` will always be "singleton".
   * @param args.lifecycle the lifecycle of the binding. Available options
   *                       are:
   *
   *                       - "transient": a new instance is created on each call to get()
   *                       - "scoped": a new instance is created for each request
   *                       - "singleton": one instance is created for and reused for all requests
   * @param args.ifNotBound if true, the binding will not be created if it already exists
   */
  bind<T, C extends Container>(this: C, key: Key<T>, args: BindKeyArgs<T, C>): void;

  /**
   * Bind a value to a class reference in the IoC container
   *
   * @param key a class object
   * @param args arguments to control how the value is bound:
   * @param args.factory a factory function to generate an instance - can be
   *                     omitted when binding a class and a new instance of
   *                     the class will be created with `new key()`.
   * @param args.instance an instance to register as a singleton. When
   *                      providing an instance, `factory` must not be
   *                      provided and `lifecycle` will always be "singleton".
   * @param args.lifecycle the lifecycle of the binding. Available options
   *                       are:
   *
   *                       - "transient": a new instance is created on each call to get()
   *                       - "scoped": a new instance is created for each request
   *                       - "singleton": one instance is created for and reused for all requests
   * @param args.ifNotBound if true, the binding will not be created if it
   * already exists
   */
  bind<T, C extends Container>(this: C, key: NoArgConstructor<T>, args?: BindClassArgs<T, C>): void;

  bind<T, C extends Container>(
    this: C,
    key: KeyOrClass<T>,
    { factory, instance, lifecycle, ifNotBound }: AnyBindArgs<T, C> = {},
  ): void {
    lifecycle ??= instance ? "singleton" : "transient";

    const previousBinding = this.#bindings.get(key);

    if (ifNotBound && previousBinding) {
      return;
    }

    if (instance) {
      if (lifecycle !== "singleton") {
        throw this.#containerError(
          `Error binding ${getKeyName(key)}: an instance can only be provided for singletons, set lifecycle to "singleton" or omit the lifecycle parameter.`,
        );
      }
      // Apply any extenders that were registered before the instance
      instance = this.#applyExtenders(key, instance);
    }

    if (factory == null) {
      if (instance === undefined) {
        if (typeof key === "function") {
          factory = () => new (key as new () => T)();
        } else {
          throw this.#containerError(
            "When binding a type token you must supply a function to create an instance",
          );
        }
      }
    } else {
      if (typeof factory !== "function") {
        throw this.#containerError(
          `The factory property must be a function (${describeType(factory)} provided)`,
        );
      }
      if (looksLikeClassConstructor(factory)) {
        throw this.#containerError(
          `The factory property must be a callable factory function (class constructor provided)`,
        );
      }
    }

    this.#bindings.set(key, {
      type: "concrete",
      key,
      factory: factory as FactoryFunction<unknown, Container>,
      lifecycle,
      instance,
      ...getPropertiesThatSurviveRebinding(previousBinding),
    });

    if (previousBinding) {
      this.#rebound(key);
    }
  }

  bound(key: KeyOrClass): boolean {
    return this.#getActualBinding(key).type !== "implicit";
  }

  get<T>(abstract: KeyOrClass<T>): Exclude<T, undefined> {
    const binding = this.#getConcreteBinding(abstract);
    const key = binding.key as KeyOrClass<T>;

    if (this.#buildStack.has(key)) {
      throw this.#containerError(
        `Circular dependency detected: ${formatKeyCycle(this.#buildStack, key)}`,
      );
    }

    this.#buildStack.add(key);
    const previousInjectHandler = _getInjectHandler();
    try {
      const needsContextualBuild = this.#hasContextualOverrides(binding);
      _setInjectHandler(<TArg>(dependency: KeyOrClass<TArg>, optional: boolean) => {
        return this.#getInjected(key, dependency, optional);
      });

      let factory: AnyFactory | undefined;

      let scopeInstances: Map<KeyOrClass, unknown> | undefined;

      if (binding.type === "concrete") {
        // Check if this is a scoped binding
        if (binding.lifecycle === "scoped") {
          scopeInstances = this.#scopeStorage.getStore();
          if (!scopeInstances) {
            throw this.#containerError(
              `Cannot create ${getKeyName(key)} because it is scoped so can only be accessed within a request or job. See https://beynac.dev/xyz TODO make online explainer for this error and list causes and symptoms`,
              { omitTopOfBuildStack: true },
            );
          }

          if (scopeInstances.has(key)) {
            const instance = scopeInstances.get(key) as T;
            this.#fireResolvingCallbacks(key, instance);
            return instance as Exclude<T, undefined>;
          }
        } else if (binding?.instance !== undefined && !needsContextualBuild) {
          const instance = binding.instance as T;
          this.#fireResolvingCallbacks(key, instance);
          return instance as Exclude<T, undefined>;
        }
        factory = binding.factory;
      }

      if (!factory && typeof key === "function") {
        // allow implicitly bound keys to be resolved if they're class references
        factory = () => new (key as new () => T)();
      }

      if (!factory) {
        // Check if key has a default value
        if (isKey(key)) {
          const defaultValue = key.default;
          if (defaultValue !== undefined) {
            return defaultValue as Exclude<T, undefined>;
          }
        }

        const name = getKeyName(key);
        throw this.#containerError(
          `Can't create an instance of ${name} because no value or factory function was supplied`,
          { omitTopOfBuildStack: true },
        );
      }

      let instance = factory(this) as T;

      instance = this.#applyExtenders(key, instance);

      if (binding.type === "concrete") {
        // Store instance appropriately based on binding type
        if (scopeInstances) {
          scopeInstances.set(key, instance);
        } else if (binding?.lifecycle === "singleton" && !needsContextualBuild) {
          binding.instance = instance;
        }
        binding.resolved = true;
      } else if (binding.type === "implicit") {
        binding.resolved = true;
      }

      this.#fireResolvingCallbacks(key, instance);

      return instance as Exclude<T, undefined>;
    } finally {
      this.#buildStack.delete(key);
      _setInjectHandler(previousInjectHandler);
    }
  }

  #hasContextualOverrides(binding: Binding): boolean {
    if (binding.contextualOverrides) return true;

    for (const aliasTo of this.#getAllAliasesTo(binding)) {
      if (aliasTo.contextualOverrides) return true;
    }

    return false;
  }

  #getAllAliasesTo(binding: Binding): Set<AliasBinding> {
    const aliases = new Set<AliasBinding>();
    const add = (b: Binding) => {
      if (b.reverseAliases) {
        for (const fromKey of b.reverseAliases) {
          const fromBinding = this.#bindings.get(fromKey);
          if (fromBinding && fromBinding.type === "alias") {
            if (!aliases.has(fromBinding)) {
              aliases.add(fromBinding);
              add(fromBinding);
            }
          }
        }
      }
    };
    add(binding);
    return aliases;
  }

  #getContextualOverride(
    context: KeyOrClass,
    dependency: KeyOrClass,
  ): FactoryFunction<unknown, Container> | null {
    const ctxBinding = this.#getConcreteBinding(context);
    const depBinding = this.#getConcreteBinding(dependency);

    if (!ctxBinding.contextualOverrides) return null;

    const getOverride = (cb: Binding, db: Binding) => cb.contextualOverrides?.get(db.key);

    // direct overrides - this exact context needs this exact dependency
    const override = getOverride(ctxBinding, depBinding);
    if (override) {
      // the dependency has been directly overridden
      return override;
    }

    // overrides on an alias to the dependency
    for (const depAlias of this.#getAllAliasesTo(depBinding)) {
      const override = getOverride(ctxBinding, depAlias);
      if (override) {
        return override;
      }
    }

    // overrides on an alias to the context
    for (const ctxAlias of this.#getAllAliasesTo(ctxBinding)) {
      const override = getOverride(ctxAlias, depBinding);
      if (override) {
        return override;
      }
    }

    return null;
  }

  #getInjected<T>(
    context: KeyOrClass | undefined,
    dependency: KeyOrClass<T>,
    optional: boolean,
  ): T | NoValue {
    if (context) {
      // if we're calling a method on an object, we need to check for
      // contextual overrides for the class of the object
      const override = this.#getContextualOverride(context, dependency);
      if (override != null) {
        let instance = override(this) as T;
        instance = this.#applyExtenders(dependency, instance);
        this.#fireResolvingCallbacks(dependency, instance);
        return instance;
      }
    }
    if (optional && !this.bound(dependency)) {
      return NO_VALUE;
    }
    return this.get(dependency);
  }

  #getConcreteBinding<T>(key: KeyOrClass<T>): ConcreteBinding | ImplicitBinding {
    const stack = new Set<KeyOrClass>();
    let binding = this.#getActualBinding(key);
    while (binding?.type === "alias") {
      if (stack.has(key)) {
        throw this.#containerError(`Circular alias detected: ${formatKeyCycle(stack, key)}`);
      }
      stack.add(key);
      key = binding.to as KeyOrClass<T>;
      binding = this.#getActualBinding(key);
    }
    return binding;
  }

  #getActualBinding<T>(key: KeyOrClass<T>): Binding {
    let binding = this.#bindings.get(key);
    if (!binding) {
      binding = {
        type: "implicit",
        key,
      };
      this.#bindings.set(key, binding);
    }
    return binding;
  }

  /**
   * Alias a type to a different name. After setting up an alias,
   * `container.get(from)` will return the same value as `container.get(to)`
   */
  alias<T>({ to, from }: { to: KeyOrClass<T>; from: KeyOrClass<T> }): void {
    if (to === from) {
      throw this.#containerError(`${getKeyName(from)} is aliased to itself.`);
    }

    const existingFrom = this.#bindings.get(from);
    if (existingFrom?.type === "alias") {
      const existingTo = this.#bindings.get(existingFrom.to);
      if (existingTo) {
        existingTo.reverseAliases?.delete(from);
      }
    }

    const newBinding: AliasBinding = {
      type: "alias",
      key: from,
      to,
      ...getPropertiesThatSurviveRebinding(existingFrom),
    };
    this.#bindings.set(from, newBinding);

    const toBinding = this.#getActualBinding(to);
    toBinding.reverseAliases ??= new Set();
    toBinding.reverseAliases.add(from);
  }

  /**
   * Determine if the given abstract type has been resolved.
   *
   * @param key The abstract type
   * @returns True if the abstract type has been resolved
   */
  resolved(key: KeyOrClass): boolean {
    const binding = this.#getConcreteBinding(key);
    return !!(binding.resolved || (binding.type === "concrete" && binding.instance !== undefined));
  }

  /**
   * Get the lifecycle associated with the given key.
   */
  getLifecycle(key: KeyOrClass): Lifecycle {
    const binding = this.#getConcreteBinding(key);
    return binding.type === "concrete" ? binding.lifecycle : "transient";
  }

  /**
   * Execute a callback within a scope. Scoped bindings will return
   * independent instances within each scope.
   *
   * @param callback The async callback to execute within the scope
   * @returns The result of the callback
   */
  async withScope<T>(callback: () => Promise<T>): Promise<T> {
    const scopeInstances = new Map<KeyOrClass, unknown>();
    return await this.#scopeStorage.run(scopeInstances, callback);
  }

  /**
   * Register a listener to be called when the
   *
   * @param key The abstract type
   * @param callback The callback
   * @returns The instance if bound
   */
  onRebinding<T>(key: KeyOrClass<T>, callback: (instance: T, container: Container) => void): void {
    this.#reboundCallbacks.add(key, callback as InstanceCallback<unknown>);
  }

  /**
   * "Extend" a type in the container. You can use this to configure or alter
   * objects created by the container.
   *
   * Any singletons or shared instances already created will be extended
   * immediately.
   *
   * @param key The type to extend
   * @param callback The a callback that receives the instance and a reference
   *                 to the container. It may modify or and return the same
   *                 instance or create another instance of a compatible type.
   */
  extend<T, C extends Container>(
    this: C,
    key: KeyOrClass<T>,
    callback: ExtenderCallback<Exclude<T, undefined>, C>,
  ): void {
    const binding = this.#getConcreteBinding(key);
    binding.extenders ??= [];
    binding.extenders.push(callback as ExtenderCallback);

    // If there's already a shared instance, apply the extender immediately
    // const binding = this.#bindings.get(key);
    if (binding.type === "concrete" && binding.instance !== undefined) {
      binding.instance = callback(binding.instance as Exclude<T, undefined>, this);
      this.#rebound(key);
    } else if (this.resolved(key)) {
      this.#rebound(key);
    }
  }

  /**
   * Apply all registered extenders for a given key to an instance
   */
  #applyExtenders<T>(key: KeyOrClass<T>, instance: T): T {
    const keyBinding = this.#getConcreteBinding(key);
    const applied = new Set<Binding>();

    const applyOnce = (b: Binding) => {
      if (b.extenders && !applied.has(b)) {
        applied.add(b);
        for (const extender of b.extenders) {
          instance = extender(instance, this) as T;
        }
      }
    };

    applyOnce(keyBinding);

    for (const alias of this.#getAllAliasesTo(keyBinding)) {
      applyOnce(alias);
    }

    return instance;
  }

  /**
   * Fire the "rebound" callbacks for the given key
   */
  #rebound<T>(key: KeyOrClass<T>): void {
    const callbacks = Array.from(this.#reboundCallbacks.get(key));
    if (callbacks.length) {
      const instance = this.get(key);
      for (const callback of callbacks) {
        callback(instance, this);
      }
    }
  }

  /**
   * Define a contextual binding.
   *
   * @param dependent The concrete implementation
   * @returns A contextual binding builder
   */
  when<C extends Container>(
    this: C,
    dependent: KeyOrClass | KeyOrClass[],
  ): ContextualBindingBuilder<C> {
    return new ContextualBindingBuilder<C>(this, (need, factory) => {
      for (const cls of arrayWrap(dependent)) {
        const binding = this.#bindings.get(cls) ?? this.#getConcreteBinding(cls);
        binding.contextualOverrides ??= new Map();
        binding.contextualOverrides.set(need, factory as FactoryFunction<unknown, Container>);
      }
    });
  }

  #containerError(message: string, args: { omitTopOfBuildStack?: boolean } = {}): ContainerError {
    const stackArray = Array.from(this.#buildStack);
    return new ContainerError(message, {
      buildStack: args.omitTopOfBuildStack ? stackArray.slice(0, -1) : stackArray,
    });
  }

  /**
   * Get the key that the container is currently resolving or null if there is
   * no key being
   */
  currentlyResolving(): KeyOrClass | null {
    return Array.from(this.#buildStack).at(-1) ?? null;
  }

  /**
   * Register a callback to be run after a type is resolved.
   *
   * The callback will be called when either:
   *
   * 1. the type is used as a key `container.get(MyType)`
   * 2. an instance of the type or a subclass is returned from
   *    container.get()
   *
   * Since all values extend `Object` in javascript, you can register a
   * callback that fires when _any_ value is resolved using
   * `onResolving(Object, callback)`.
   *
   * @param key - The abstract type or a global callback
   * @param callback - The callback to run (optional if abstract is a
   * function)
   * @returns The container instance for chaining
   */
  onResolving<T>(key: KeyOrClass<T>, callback: InstanceCallback<T>): this {
    this.#resolvingCallbacks.add(key, callback as InstanceCallback<unknown>);
    return this;
  }

  /**
   * Fire all of the resolving callbacks
   */
  #fireResolvingCallbacks(key: KeyOrClass, instance: unknown): void {
    // Fire callbacks for the specific type
    const fireForType = (type: KeyOrClass) => {
      const callbacks = this.#resolvingCallbacks.get(type);
      if (callbacks) {
        for (const callback of callbacks) {
          callback(instance, this);
        }
      }
    };

    fireForType(key);

    if (instance == null) return;

    // Also fire callbacks for types that the object is an instance of
    for (const constructor of getPrototypeChain(instance)) {
      if (constructor !== key) {
        fireForType(constructor);
      }
    }
  }

  /**
   * Call a closure in the context of the container, allowing
   * dependencies to be injected.
   *
   * @param closure The closure to call
   * @returns The return value of the closure
   */
  call<R>(closure: () => R): R;

  /**
   * Call a method on an object in the context of the container, allowing
   * dependencies to be injected into the method.
   *
   * The method may declare injected dependencies and contextual bindings can
   * be used to override the dependencies given to the object.
   *
   * @param object The object containing the method
   * @param methodName The name of the method to call
   * @returns The return value of the method
   */
  call<T extends object, K extends MethodNamesWithNoRequiredArgs<T>>(
    object: T,
    methodName: K,
  ): T[K] extends () => infer R ? R : never;

  call<T extends object, K extends keyof T, R>(
    objectOrClosure: T | (() => R),
    methodName?: K,
  ): R | (T[K] extends () => infer R2 ? R2 : never) {
    // If only one argument and it's a function, it's a closure
    if (arguments.length === 1 && typeof objectOrClosure === "function") {
      const closure = objectOrClosure;
      const previousInjectHandler = _getInjectHandler();
      try {
        _setInjectHandler(<TArg>(dependency: KeyOrClass<TArg>, optional: boolean) => {
          return this.#getInjected(undefined, dependency, optional) as TArg;
        });
        return closure();
      } finally {
        _setInjectHandler(previousInjectHandler);
      }
    }

    // Otherwise it's an object method call
    const object = objectOrClosure as T;
    const dependent = (Object.getPrototypeOf(object) as object).constructor as
      | KeyOrClass
      | undefined;

    const previousInjectHandler = _getInjectHandler();
    try {
      _setInjectHandler(<TArg>(dependency: KeyOrClass<TArg>, optional: boolean) => {
        return this.#getInjected(dependent, dependency, optional) as TArg;
      });
      const o = object as Record<string, () => unknown>;
      const m = methodName as string;
      if (!o[m]) {
        throw new Error(`Method ${m} not found on object`);
      }
      return o[m]() as T[K] extends () => infer R2 ? R2 : never;
    } finally {
      _setInjectHandler(previousInjectHandler);
    }
  }

  /**
   * Assign a set of tags to a given binding.
   *
   * @param keys The abstract types
   * @param tags The tags
   */
  tag<T>(keys: KeyOrClass<T> | KeyOrClass<T>[], tags: Key<T> | Key<T>[]): void {
    this.#tags.addAll(tags, keys);
  }

  /**
   * Resolve all of the bindings for a given tag or tags.
   *
   * This method returns a generator so that you can iterate lazily over the
   * results and each service will not be created until required.
   *
   * @example
   * for (const report of container.tagged(reportTag)) {
   *     // process each report, lazily creating them
   * }
   * // eagerly create all reports
   * const reports = Array.from(container.tagged(reportTag));
   */
  *tagged<T>(tags: Key<T> | Key<T>[]): Generator<T, void, void> {
    for (const tag of arrayWrap(tags)) {
      for (const key of this.#tags.get(tag)) {
        yield this.get(key) as T;
      }
    }
  }

  static #instance: Container | null = null;

  static getInstance(): Container {
    if (!Container.#instance) {
      Container.#instance = new Container();
    }
    return Container.#instance;
  }

  static setInstance(instance: Container | null): void {
    Container.#instance = instance;
  }
}

const formatKeyCycle = (stack: Set<KeyOrClass>, cycleKey: KeyOrClass) => {
  const stackArray = Array.from(stack);
  const cycleStart = stackArray.indexOf(cycleKey);
  return stackArray.slice(cycleStart).concat(cycleKey).map(getKeyName).join(" -> ");
};

const looksLikeClassConstructor = (value: unknown) => {
  return typeof value === "function" && /^class\s+/.test(Function.prototype.toString.call(value));
};

class ContainerError extends BeynacError {
  constructor(message: string, args: { buildStack: KeyOrClass[] | null }) {
    if (args.buildStack && args.buildStack.length > 0) {
      message += ` (while building ${args.buildStack.map(getKeyName).join(" -> ")})`;
    }
    super(message);
    this.name = "ContainerError";
  }
}

const getPropertiesThatSurviveRebinding = (
  binding: Binding | undefined,
): CommonBindingProperties => {
  const common: CommonBindingProperties = {};
  if (binding) {
    if (binding.contextualOverrides !== undefined) {
      common.contextualOverrides = binding.contextualOverrides;
    }
    if (binding.extenders !== undefined) {
      common.extenders = binding.extenders;
    }
    if (binding.reverseAliases !== undefined) {
      common.reverseAliases = binding.reverseAliases;
    }
    if (binding.resolvingCallbacks !== undefined) {
      common.resolvingCallbacks = binding.resolvingCallbacks;
    }
    if (binding.type === "concrete" && binding.resolved) {
      (common as ConcreteBinding).resolved = binding.resolved;
    }
  }
  return common;
};
