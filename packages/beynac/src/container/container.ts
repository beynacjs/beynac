import { AsyncLocalStorage } from "node:async_hooks";
import { BeynacError } from "@/error";
import type { Key } from "@/keys";
import { ArrayMultiMap, arrayWrap, SetMultiMap } from "@/utils";
import { ContextualBindingBuilder } from "./ContextualBindingBuilder";
import {
	type ClassReference,
	getKeyName,
	type KeyOrClass,
} from "./container-key";
import { _getInjectHandler, _setInjectHandler } from "./inject";
import { NO_VALUE, type NoValue } from "./no-value";

/**
 * A function that produces an instance of T
 */
export type FactoryFunction<T, C extends Container> = (container: C) => {
	[K in keyof T]: T[K];
};

type Lifecycle = "transient" | "singleton" | "scoped";

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

type BindKeyArgs<T, C extends Container> =
	| BindKeyToInstanceArgs<T>
	| BindKeyToFactoryArgs<T, C>;

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

export type TypeCallback<T> = (
	key: KeyOrClass<T>,
	container: Container,
) => void;

/**
 * A type-safe Inversion of Control (IoC) container. Essentially a fancy map of
 * keys (class objects or type tokens) to values (instances of the types
 * referred to by the class or token).
 *
 * Key features include:
 *
 * - make(MyClass): create an instance of MyClass
 * - bind(MyClass, () => ...): register a method to control how MyClass is constructed
 * - singleton(MyClass): all future calls to make(MyClass) will return the same object
 * - scoped(MyClass): each request gets a separate instance of MyClass
 *
 * See: {@link TODO link to IoC docs}
 */
export class Container {
	#bindings = new Map<KeyOrClass, Binding>();
	#buildStack: KeyOrClass[] = [];
	#buildStackSet: Set<KeyOrClass> = new Set();
	#tags = new SetMultiMap<KeyOrClass, KeyOrClass>();
	#scopeStorage = new AsyncLocalStorage<Map<KeyOrClass, unknown>>();

	#reboundCallbacks = new ArrayMultiMap<
		KeyOrClass,
		InstanceCallback<unknown>
	>();

	/**
	 * All of the resolving callbacks by class type.
	 */
	#resolvingCallbacks = new ArrayMultiMap<
		KeyOrClass,
		InstanceCallback<unknown>
	>();

	/**
	 * Bind a value to a type token in the IoC container
	 *
	 * @param key a type token created with typeKey
	 * @param factory a factory function to generate an instance
	 */
	public bind<T, C extends Container>(
		this: C,
		key: Key<T>,
		args: BindKeyArgs<T, C>,
	): void;

	/**
	 * Bind a value to a class reference in the IoC container
	 *
	 * @param key a class object
	 * @param factory a factory function to generate an instance - can be omitted
	 *                 and an instance of the provided class will be created
	 */
	public bind<T, C extends Container>(
		this: C,
		key: ClassReference<T>,
		args?: BindClassArgs<T, C>,
	): void;

	public bind<T, C extends Container>(
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

	public bound(key: KeyOrClass): boolean {
		return this.#getActualBinding(key).type !== "implicit";
	}

	public make<T>(abstract: KeyOrClass<T>): T {
		const binding = this.#getConcreteBinding(abstract);
		const key = binding.key as KeyOrClass<T>;

		if (this.#buildStackSet.has(key)) {
			throw this.#containerError(
				`Circular dependency detected: ${formatKeyCycle(this.#buildStack, key)}`,
			);
		}

		this.#buildStack.push(key);
		this.#buildStackSet.add(key);
		const previousInjectHandler = _getInjectHandler();
		try {
			const needsContextualBuild = this.#hasContextualOverrides(binding);
			_setInjectHandler(
				<TArg>(dependency: KeyOrClass<TArg>, optional: boolean) => {
					return this.#makeInjected(key, dependency, optional);
				},
			);

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
						return instance;
					}
				} else if (binding?.instance !== undefined && !needsContextualBuild) {
					const instance = binding.instance as T;
					this.#fireResolvingCallbacks(key, instance);
					return instance;
				}
				factory = binding.factory;
			}

			if (!factory && typeof key === "function") {
				// allow implicitly bound keys to be resolved if they're class references
				factory = () => new (key as new () => T)();
			}

			if (!factory) {
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
				} else if (
					binding?.lifecycle === "singleton" &&
					!needsContextualBuild
				) {
					binding.instance = instance;
				}
				binding.resolved = true;
			} else if (binding.type === "implicit") {
				binding.resolved = true;
			}

			this.#fireResolvingCallbacks(key, instance);

			return instance;
		} finally {
			this.#buildStack.pop();
			this.#buildStackSet.delete(key);
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

		const getOverride = (cb: Binding, db: Binding) =>
			cb.contextualOverrides?.get(db.key);

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

	#makeInjected<T>(
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
		return this.make(dependency);
	}

	#getConcreteBinding<T>(
		key: KeyOrClass<T>,
	): ConcreteBinding | ImplicitBinding {
		const stack = new Set<KeyOrClass>();
		let binding = this.#getActualBinding(key);
		while (binding?.type === "alias") {
			if (stack.has(key)) {
				throw this.#containerError(
					`Circular alias detected: ${formatKeyCycle(Array.from(stack), key)}`,
				);
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
	 * Alias a type to a different name.
	 *
	 * @param key The abstract type
	 * @param alias The alias
	 */
	public alias<T>({
		to,
		from,
	}: {
		to: KeyOrClass<T>;
		from: KeyOrClass<T>;
	}): void {
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
	public resolved(key: KeyOrClass): boolean {
		const binding = this.#getConcreteBinding(key);
		return !!(
			binding.resolved ||
			(binding.type === "concrete" && binding.instance !== undefined)
		);
	}

	/**
	 * Get the lifecycle associated with the given key.
	 */
	public getLifecycle(key: KeyOrClass): Lifecycle {
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
	public async withScope<T>(callback: () => Promise<T>): Promise<T> {
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
	public onRebinding<T>(
		key: KeyOrClass<T>,
		callback: (instance: T, container: Container) => void,
	): void {
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
	public extend<T, C extends Container>(
		this: C,
		key: KeyOrClass<T>,
		callback: ExtenderCallback<T, C>,
	): void {
		const binding = this.#getConcreteBinding(key);
		binding.extenders ??= [];
		binding.extenders.push(callback as ExtenderCallback);

		// If there's already a shared instance, apply the extender immediately
		// const binding = this.#bindings.get(key);
		if (binding.type === "concrete" && binding.instance !== undefined) {
			binding.instance = callback(binding.instance as T, this);
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
			const instance = this.make(key);
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
	public when<C extends Container>(
		this: C,
		dependent: KeyOrClass | KeyOrClass[],
	): ContextualBindingBuilder<C> {
		return new ContextualBindingBuilder<C>(this, (need, factory) => {
			for (const cls of arrayWrap(dependent)) {
				const binding =
					this.#bindings.get(cls) ?? this.#getConcreteBinding(cls);
				binding.contextualOverrides ??= new Map();
				binding.contextualOverrides.set(
					need,
					factory as FactoryFunction<unknown, Container>,
				);
			}
		});
	}

	#containerError(
		message: string,
		args: { omitTopOfBuildStack?: boolean } = {},
	): ContainerError {
		return new ContainerError(message, {
			buildStack: args.omitTopOfBuildStack
				? this.#buildStack.slice(0, -1)
				: this.#buildStack,
		});
	}

	/**
	 * Get the key that the container is currently resolving or null if there is
	 * no key being
	 */
	public currentlyResolving(): KeyOrClass | null {
		return this.#buildStack.at(-1) ?? null;
	}

	/**
	 * Register a callback to be run after a type is resolved.
	 *
	 * The callback will be called when either:
	 *
	 * 1. the type is used as a key `container.make(MyType)`
	 * 2. an instance of the type or a subclass is returned from
	 *    container.make()
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
		let prototype = Object.getPrototypeOf(instance);
		while (prototype) {
			const classReference = prototype.constructor;
			if (typeof classReference !== "function") {
				break;
			}
			if (classReference !== key) {
				fireForType(classReference);
			}
			prototype = Object.getPrototypeOf(prototype);
		}
	}

	/**
	 * Call a method on an object in the context of the container, allowing
	 * dependencies to be injected into the method.
	 *
	 * The method may declare injected dependencies and contextual bindings can
	 * be used to override the dependencies given to the object.
	 */
	public call<T extends object, K extends keyof T>(
		object: T,
		methodName: T[K] extends () => unknown ? K : never,
	): T[K] extends () => infer R ? R : never {
		const dependent: KeyOrClass | undefined =
			Object.getPrototypeOf(object).constructor;

		const previousInjectHandler = _getInjectHandler();
		try {
			_setInjectHandler(
				<TArg>(dependency: KeyOrClass<TArg>, optional: boolean) => {
					return this.#makeInjected(dependent, dependency, optional) as TArg;
				},
			);
			const o = object as Record<string, () => unknown>;
			const m = methodName as string;
			if (!o[m]) {
				throw new Error(`Method ${m} not found on object`);
			}
			return o[m]() as T[K] extends () => infer R ? R : never;
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
	public tag<T>(
		keys: KeyOrClass<T> | KeyOrClass<T>[],
		tags: Key<T> | Key<T>[],
	): void {
		this.#tags.addAll(tags, keys);
	}

	/**
	 * Resolve all of the bindings for a given tag or tags.
	 *
	 * This method returns a generator so that you can iterate lazily over the
	 * results and each service will not be made until required.
	 *
	 * @example
	 * for (const report of container.tagged(reportTag)) {
	 *     // process each report, lazily creating them
	 * }
	 * // eagerly create all reports
	 * const reports = Array.from(container.tagged(reportTag));
	 */
	public *tagged<T>(tags: Key<T> | Key<T>[]): Generator<T, void, void> {
		for (const tag of arrayWrap(tags)) {
			for (const key of this.#tags.get(tag)) {
				yield this.make(key) as T;
			}
		}
	}

	static #instance: Container | null = null;

	public static getInstance(): Container {
		if (!Container.#instance) {
			Container.#instance = new Container();
		}
		return Container.#instance;
	}

	public static setInstance(instance: Container | null): void {
		Container.#instance = instance;
	}
}

const formatKeyCycle = (stack: KeyOrClass[], cycleKey: KeyOrClass) => {
	const cycleStart = stack.indexOf(cycleKey);
	return stack.slice(cycleStart).concat(cycleKey).map(getKeyName).join(" -> ");
};

const looksLikeClassConstructor = (value: unknown) => {
	return (
		typeof value === "function" &&
		/^class\s+/.test(Function.prototype.toString.call(value))
	);
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

const describeType = (value: unknown) =>
	value == null ? String(value) : typeof value;

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
