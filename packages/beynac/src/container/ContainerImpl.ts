import { AsyncLocalStorage } from "node:async_hooks";
import type { Container } from "../contracts/Container";
import { BeynacError } from "../error";
import {
	type AnyConstructor,
	ArrayMultiMap,
	arrayWrap,
	getPrototypeChain,
	type NoArgConstructor,
	SetMultiMap,
} from "../utils";
import { ContextualBindingBuilder } from "./ContextualBindingBuilder";
import { getKeyName, type KeyOrClass, type TypeToken } from "./container-key";
import { _getInjectHandler, _setInjectHandler } from "./inject";
import { NO_VALUE, type NoValue } from "./no-value";

export type FactoryFunction<T> = (container: Container) => {
	[K in keyof T]: T[K];
};

export type Lifecycle = "transient" | "singleton" | "scoped";

type ContextualOverrides = Map<KeyOrClass, FactoryFunction<unknown>>;

type AnyFactory = (container: Container) => unknown;

type CommonBindingProperties = {
	contextualOverrides?: ContextualOverrides;
	extenders?: ExtenderCallback[];
	reverseAliases?: Set<KeyOrClass>;
	resolvingCallbacks?: InstanceCallback<unknown>[];
};

type ConcreteBinding = {
	kind: "concrete";
	type: KeyOrClass;
	class?: AnyConstructor;
	factory?: AnyFactory;
	lifecycle: Lifecycle;
	instance?: unknown;
	resolved?: boolean;
} & CommonBindingProperties;

type AliasBinding = {
	kind: "alias";
	type: KeyOrClass;
	to: KeyOrClass;
} & CommonBindingProperties;

type ImplicitBinding = {
	kind: "implicit";
	type: KeyOrClass;
	resolved?: boolean;
} & CommonBindingProperties;

type Binding = ConcreteBinding | AliasBinding | ImplicitBinding;

type BindArgsWithFactory<T> = {
	class?: AnyConstructor<T>;
	factory?: FactoryFunction<T>;
	instance?: T;
	lifecycle?: Lifecycle;
	ifNotBound?: boolean;
};

type BindArgsWithoutFactory<T> = {
	class: NoArgConstructor<T>;
	factory?: never;
	instance?: never;
	lifecycle?: Lifecycle;
	ifNotBound?: boolean;
};

type ExtenderCallback<T = unknown> = (instance: T, container: Container) => T;

export type InstanceCallback<T> = (instance: T, container: Container) => void;

export type TypeCallback<T> = (type: KeyOrClass<T>, container: Container) => void;

/**
 * Implementation of the Container interface.
 *
 * See {@link Container} for full documentation.
 */
export class ContainerImpl implements Container {
	#bindings = new Map<KeyOrClass, Binding>();
	#buildStack: Set<KeyOrClass> = new Set();
	#tags = new SetMultiMap<KeyOrClass, KeyOrClass>();
	#scopeStorage = new AsyncLocalStorage<Map<KeyOrClass, unknown>>();

	#reboundCallbacks = new ArrayMultiMap<KeyOrClass, InstanceCallback<unknown>>();

	#resolvingCallbacks = new ArrayMultiMap<KeyOrClass, InstanceCallback<unknown>>();

	bind<T>(
		type: KeyOrClass<T>,
		implOrOptions?: NoArgConstructor<T> | BindArgsWithFactory<T> | BindArgsWithoutFactory<T>,
	): void {
		// Handle the bind(type, impl) overload
		if (typeof implOrOptions === "function") {
			this.bind(type, { class: implOrOptions });
			return;
		}
		// Handle the bind(impl) overload - only for classes
		if (typeof implOrOptions === "undefined" && typeof type === "function") {
			this.bind(type, { class: type as NoArgConstructor });
			return;
		}

		const options = implOrOptions ?? {};
		let { class: cls, factory, instance, lifecycle, ifNotBound } = options;

		const previousBinding = this.#bindings.get(type);

		if (ifNotBound && previousBinding) {
			return;
		}

		// Normally we consider null to be a valid kind of instance. You can bind a
		// nullable type with the value null in the container. However, if people
		// have provided a factory function, let us assume that it is an accidental
		// null, and they meant undefined rather than null. Otherwise they'd get a
		// weird error saying "you can't provide both an instance and a factory" and
		// they'll be all "mate I haven't provided an instance".
		if ((factory || cls) && instance === null) {
			instance = undefined;
		}

		if (factory && instance !== undefined) {
			throw this.#containerError(
				`Error binding ${getKeyName(type)}: Cannot provide both factory and instance`,
			);
		}

		if (cls && instance !== undefined) {
			throw this.#containerError(
				`Error binding ${getKeyName(type)}: Cannot provide both class and instance`,
			);
		}

		if (!cls && !factory && !instance) {
			throw this.#containerError(
				`Error binding ${getKeyName(type)}: Must provide class, factory, or instance`,
			);
		}

		// Instance validation
		lifecycle ??= instance !== undefined ? "singleton" : "transient";

		if (instance !== undefined) {
			if (lifecycle !== "singleton") {
				throw this.#containerError(
					`Error binding ${getKeyName(type)}: an instance can only be provided for singletons, set lifecycle to "singleton" or omit the lifecycle parameter.`,
				);
			}
			// Apply any extenders that were registered before the instance
			instance = this.#applyExtenders(type, instance);
		}

		this.#bindings.set(type, {
			kind: "concrete",
			type: type,
			class: cls as AnyConstructor,
			factory: factory as FactoryFunction<unknown>,
			lifecycle,
			instance,
			...getPropertiesThatSurviveRebinding(previousBinding),
		});

		if (previousBinding) {
			this.#rebound(type);
		}
	}

	bindIf<T>(typeOrImpl: KeyOrClass<T>, impl?: NoArgConstructor<T>): void {
		this.#bindWithLifecycle(typeOrImpl, impl, "transient", true);
	}

	singleton<T>(typeOrImpl: KeyOrClass<T>, impl?: NoArgConstructor<T>): void {
		this.#bindWithLifecycle(typeOrImpl, impl, "singleton");
	}

	singletonIf<T>(typeOrImpl: KeyOrClass<T>, impl?: NoArgConstructor<T>): void {
		this.#bindWithLifecycle(typeOrImpl, impl, "singleton", true);
	}

	scoped<T>(typeOrImpl: KeyOrClass<T>, impl?: NoArgConstructor<T>): void {
		this.#bindWithLifecycle(typeOrImpl, impl, "scoped");
	}

	scopedIf<T>(typeOrImpl: KeyOrClass<T>, impl?: NoArgConstructor<T>): void {
		this.#bindWithLifecycle(typeOrImpl, impl, "scoped", true);
	}

	#bindWithLifecycle<T>(
		typeOrImpl: KeyOrClass<T>,
		impl: NoArgConstructor<T> | undefined,
		lifecycle: Lifecycle,
		ifNotBound = false,
	): void {
		if (impl === undefined) {
			this.bind(typeOrImpl as NoArgConstructor<T>, {
				class: typeOrImpl as NoArgConstructor<T>,
				lifecycle,
				ifNotBound,
			});
		} else {
			this.bind(typeOrImpl, { class: impl, lifecycle, ifNotBound });
		}
	}

	instance<T>(type: KeyOrClass<T>, instance: T): void {
		this.bind(type, { instance });
	}

	instanceIf<T>(type: KeyOrClass<T>, instance: T): void {
		this.bind(type, { instance, ifNotBound: true });
	}

	bound(type: KeyOrClass): boolean {
		return this.#getActualBinding(type).kind !== "implicit";
	}

	get<T>(type: KeyOrClass<T>): T {
		const binding = this.#getConcreteBinding(type);
		type = binding.type as KeyOrClass<T>;

		if (this.#buildStack.has(type)) {
			throw this.#containerError(
				`Circular dependency detected: ${formatKeyCycle(this.#buildStack, type)}`,
			);
		}

		this.#buildStack.add(type);
		const previousInjectHandler = _getInjectHandler();
		try {
			const needsContextualBuild = this.#hasContextualOverrides(binding);
			_setInjectHandler(<TArg>(dependency: KeyOrClass<TArg>, optional: boolean) => {
				return this.#getInjected(type, dependency, optional);
			});

			let factory: AnyFactory | undefined;

			let scopeInstances: Map<KeyOrClass, unknown> | undefined;

			if (binding.kind === "concrete") {
				// Check if this is a scoped binding
				if (binding.lifecycle === "scoped") {
					scopeInstances = this.#scopeStorage.getStore();
					if (!scopeInstances) {
						throw this.#containerError(
							`Cannot create ${getKeyName(type)} because it is scoped so can only be accessed within a request or job. See https://beynac.dev/xyz TODO make online explainer for this error and list causes and symptoms`,
							{ omitTopOfBuildStack: true },
						);
					}

					if (scopeInstances.has(type)) {
						const instance = scopeInstances.get(type) as T;
						this.#fireResolvingCallbacks(type, instance);
						return instance;
					}
				} else if (binding?.instance !== undefined && !needsContextualBuild) {
					const instance = binding.instance as T;
					this.#fireResolvingCallbacks(type, instance);
					return instance;
				}
				factory = binding.factory;

				// If no factory but we have a stored class, create factory from the class
				if (!factory && binding.class) {
					factory = () => new (binding.class as new () => T)();
				}
			}

			if (!factory && typeof type === "function") {
				// allow implicitly bound keys to be resolved if they're class references
				// Runtime check: ensure no required constructor arguments
				if (type.length > 0) {
					throw this.#containerError(
						`Can't create an instance of ${getKeyName(type)} because it looks like it has required constructor arguments. Either bind it to the container, or ensure that all arguments have default values e.g. constructor(arg = "default")`,
						{ omitTopOfBuildStack: true },
					);
				}
				factory = () => new (type as new () => T)();
			}

			if (!factory) {
				const name = getKeyName(type);
				throw this.#containerError(
					`Can't create an instance of ${name} because no value or factory function was supplied`,
					{ omitTopOfBuildStack: true },
				);
			}

			let instance = factory(this) as T;

			instance = this.#applyExtenders(type, instance);

			if (binding.kind === "concrete") {
				// Store instance appropriately based on binding type
				if (scopeInstances) {
					scopeInstances.set(type, instance);
				} else if (binding?.lifecycle === "singleton" && !needsContextualBuild) {
					binding.instance = instance;
				}
				binding.resolved = true;
			} else if (binding.kind === "implicit") {
				binding.resolved = true;
			}

			this.#fireResolvingCallbacks(type, instance);

			return instance;
		} finally {
			this.#buildStack.delete(type);
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
					if (fromBinding && fromBinding.kind === "alias") {
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
	): FactoryFunction<unknown> | null {
		const ctxBinding = this.#getConcreteBinding(context);
		const depBinding = this.#getConcreteBinding(dependency);

		if (!ctxBinding.contextualOverrides) return null;

		const getOverride = (cb: Binding, db: Binding) => cb.contextualOverrides?.get(db.type);

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

		// Check stored class in dependency binding
		if (depBinding.kind === "concrete" && depBinding.class) {
			const classBinding = this.#getActualBinding(depBinding.class);
			const directClassMatch = getOverride(ctxBinding, classBinding);
			if (directClassMatch) {
				return directClassMatch;
			}

			// Also check aliases to the stored class
			for (const classAlias of this.#getAllAliasesTo(classBinding)) {
				const aliasMatch = getOverride(ctxBinding, classAlias);
				if (aliasMatch) {
					return aliasMatch;
				}
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

	#getConcreteBinding<T>(type: KeyOrClass<T>): ConcreteBinding | ImplicitBinding {
		const stack = new Set<KeyOrClass>();
		let binding = this.#getActualBinding(type);
		while (binding?.kind === "alias") {
			if (stack.has(type)) {
				throw this.#containerError(`Circular alias detected: ${formatKeyCycle(stack, type)}`);
			}
			stack.add(type);
			type = binding.to as KeyOrClass<T>;
			binding = this.#getActualBinding(type);
		}
		return binding;
	}

	#getActualBinding<T>(type: KeyOrClass<T>): Binding {
		let binding = this.#bindings.get(type);
		if (!binding) {
			binding = {
				kind: "implicit",
				type: type,
			};
			this.#bindings.set(type, binding);
		}
		return binding;
	}

	alias<T>({ to, from }: { to: KeyOrClass<T>; from: KeyOrClass<T> }): void {
		if (to === from) {
			throw this.#containerError(`${getKeyName(from)} is aliased to itself.`);
		}

		const existingFrom = this.#bindings.get(from);
		if (existingFrom?.kind === "alias") {
			const existingTo = this.#bindings.get(existingFrom.to);
			if (existingTo) {
				existingTo.reverseAliases?.delete(from);
			}
		}

		const newBinding: AliasBinding = {
			kind: "alias",
			type: from,
			to,
			...getPropertiesThatSurviveRebinding(existingFrom),
		};
		this.#bindings.set(from, newBinding);

		const toBinding = this.#getActualBinding(to);
		toBinding.reverseAliases ??= new Set();
		toBinding.reverseAliases.add(from);
	}

	resolved(type: KeyOrClass): boolean {
		const binding = this.#getConcreteBinding(type);
		return !!(binding.resolved || (binding.kind === "concrete" && binding.instance !== undefined));
	}

	getLifecycle(type: KeyOrClass): Lifecycle {
		const binding = this.#getConcreteBinding(type);
		return binding.kind === "concrete" ? binding.lifecycle : "transient";
	}

	withScope<T>(callback: () => T): T {
		const scopeInstances = new Map<KeyOrClass, unknown>();
		return this.#scopeStorage.run(scopeInstances, callback);
	}

	get hasScope(): boolean {
		return this.#scopeStorage.getStore() !== undefined;
	}

	extend<T>(type: KeyOrClass<T>, callback: ExtenderCallback<T>): void {
		const binding = this.#getConcreteBinding(type);
		binding.extenders ??= [];
		binding.extenders.push(callback as ExtenderCallback);

		// If there's already a shared instance, apply the extender immediately
		if (binding.kind === "concrete" && binding.instance !== undefined) {
			binding.instance = callback(binding.instance as T, this);
			this.#rebound(type);
		} else if (this.resolved(type)) {
			this.#rebound(type);
		}
	}

	/**
	 * Apply all registered extenders for a given type to an instance
	 */
	#applyExtenders<T>(type: KeyOrClass<T>, instance: T): T {
		const keyBinding = this.#getConcreteBinding(type);
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
	 * Fire the "rebound" callbacks for the given type
	 */
	#rebound<T>(type: KeyOrClass<T>): void {
		const callbacks = Array.from(this.#reboundCallbacks.get(type));
		if (callbacks.length) {
			const instance = this.get(type);
			for (const callback of callbacks) {
				callback(instance, this);
			}
		}
	}

	when(dependent: KeyOrClass | KeyOrClass[]): ContextualBindingBuilder {
		return new ContextualBindingBuilder(this, (need, factory) => {
			for (const type of arrayWrap(dependent)) {
				const binding = this.#bindings.get(type) ?? this.#getConcreteBinding(type);
				binding.contextualOverrides ??= new Map();
				binding.contextualOverrides.set(need, factory);
			}
		});
	}

	#containerError(message: string, args: { omitTopOfBuildStack?: boolean } = {}): ContainerError {
		const stackArray = Array.from(this.#buildStack);
		return new ContainerError(message, {
			buildStack: args.omitTopOfBuildStack ? stackArray.slice(0, -1) : stackArray,
		});
	}

	onRebinding<T>(type: KeyOrClass<T>, callback: InstanceCallback<T>): this {
		this.#reboundCallbacks.add(type, callback as InstanceCallback<unknown>);
		return this;
	}

	currentlyResolving(): KeyOrClass | null {
		return Array.from(this.#buildStack).at(-1) ?? null;
	}

	onResolving<T>(type: KeyOrClass<T>, callback: InstanceCallback<T>): this {
		this.#resolvingCallbacks.add(type, callback as InstanceCallback<unknown>);
		return this;
	}

	#fireResolvingCallbacks(type: KeyOrClass, instance: unknown): void {
		const fireForType = (type: KeyOrClass) => {
			const callbacks = this.#resolvingCallbacks.get(type);
			if (callbacks) {
				for (const callback of callbacks) {
					callback(instance, this);
				}
			}
		};

		fireForType(type);

		if (instance == null) return;

		for (const constructor of getPrototypeChain(instance)) {
			if (constructor !== type) {
				fireForType(constructor);
			}
		}
	}

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

	tag<T>(keys: KeyOrClass<T> | KeyOrClass<T>[], tags: TypeToken<T> | TypeToken<T>[]): void {
		this.#tags.addAll(tags, keys);
	}

	*tagged<T>(tags: TypeToken<T> | TypeToken<T>[]): Generator<T, void, void> {
		for (const tag of arrayWrap(tags)) {
			for (const type of this.#tags.get(tag)) {
				yield this.get(type) as T;
			}
		}
	}
}

const formatKeyCycle = (stack: Set<KeyOrClass>, cycleKey: KeyOrClass) => {
	const stackArray = Array.from(stack);
	const cycleStart = stackArray.indexOf(cycleKey);
	return stackArray.slice(cycleStart).concat(cycleKey).map(getKeyName).join(" -> ");
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
		if (binding.kind === "concrete" && binding.resolved) {
			(common as ConcreteBinding).resolved = binding.resolved;
		}
	}
	return common;
};
