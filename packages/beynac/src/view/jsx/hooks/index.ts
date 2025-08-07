import type { JSX } from "../base";

type UpdateStateFunction<T> = (newState: T | ((currentState: T) => T)) => void;

export type EffectData = [
	readonly unknown[] | undefined, // deps
	(() => void | (() => void)) | undefined, // layout effect
	(() => void) | undefined, // cleanup
	(() => void) | undefined, // effect
	(() => void) | undefined, // insertion effect
];

// Stub implementations for SSR - these hooks don't actually do anything server-side

export const startViewTransition = (callback: () => void): void => {
	// In SSR, just execute the callback immediately
	callback();
};

export const useViewTransition = (): [
	boolean,
	(callback: () => void) => void,
] => {
	return [false, startViewTransition];
};

export const startTransition = (callback: () => void): void => {
	// In SSR, just execute the callback immediately
	callback();
};

export const useTransition = (): [
	boolean,
	(callback: () => void | Promise<void>) => void,
] => {
	return [
		false,
		(callback) => {
			const result = callback();
			if (result instanceof Promise) {
				result.catch(() => {}); // Ignore errors in SSR
			}
		},
	];
};

type UseDeferredValue = <T>(value: T, initialValue?: T) => T;
export const useDeferredValue: UseDeferredValue = <T>(
	value: T,
	..._rest: [T | undefined]
): T => {
	// In SSR, always return the current value
	return value;
};

type UseStateType = {
	<T>(initialState: T | (() => T)): [T, UpdateStateFunction<T>];
	<T = undefined>(): [T | undefined, UpdateStateFunction<T | undefined>];
};
export const useState: UseStateType = <T>(
	initialState?: T | (() => T),
): [T, UpdateStateFunction<T>] => {
	const resolveInitialState = () =>
		typeof initialState === "function"
			? (initialState as () => T)()
			: (initialState as T);

	// In SSR, return initial state and a no-op updater
	return [resolveInitialState(), () => {}];
};

export const useReducer = <T, A>(
	_reducer: (state: T, action: A) => T,
	initialArg: T,
	init?: (initialState: T) => T,
): [T, (action: A) => void] => {
	const initialState = init ? init(initialArg) : initialArg;
	// In SSR, return initial state and a no-op dispatcher
	return [initialState, () => {}];
};

// Effect hooks - these don't run on the server
export const useEffect = (
	_effect: () => void | (() => void),
	_deps?: readonly unknown[],
): void => {
	// No-op in SSR
};

export const useLayoutEffect = (
	_effect: () => void | (() => void),
	_deps?: readonly unknown[],
): void => {
	// No-op in SSR
};

export const useInsertionEffect = (
	_effect: () => void | (() => void),
	_deps?: readonly unknown[],
): void => {
	// No-op in SSR
};

export const useCallback = <T extends Function>(
	callback: T,
	_deps: readonly unknown[],
): T => {
	// In SSR, just return the callback as-is
	return callback;
};

export type RefObject<T> = { current: T | null };
export const useRef = <T>(initialValue: T | null): RefObject<T> => {
	// In SSR, return a simple ref object
	return { current: initialValue };
};

const resolvedPromiseValueMap: WeakMap<Promise<unknown>, unknown> = new WeakMap<
	Promise<unknown>,
	unknown
>();

export const use = <T>(promise: Promise<T>): T => {
	const cachedRes = resolvedPromiseValueMap.get(promise) as
		| [T]
		| [undefined, unknown]
		| undefined;
	if (cachedRes) {
		if (cachedRes.length === 2) {
			throw cachedRes[1];
		}
		return cachedRes[0] as T;
	}
	promise.then(
		(res) => resolvedPromiseValueMap.set(promise, [res]),
		(e) => resolvedPromiseValueMap.set(promise, [undefined, e]),
	);

	throw promise;
};

export const useMemo = <T>(factory: () => T, _deps: readonly unknown[]): T => {
	// In SSR, just compute the value
	return factory();
};

let idCounter = 0;
export const useId = (): string => {
	// Generate a unique ID for SSR
	return `:r${(idCounter++).toString(32)}:`;
};

// Define to avoid errors. This hook currently does nothing.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const useDebugValue = (
	_value: unknown,
	_formatter?: (value: unknown) => string,
): void => {};

export const createRef = <T>(): RefObject<T> => {
	return { current: null };
};

export const forwardRef = <T, P = {}>(
	Component: (props: P, ref?: RefObject<T>) => JSX.Element,
): ((props: P & { ref?: RefObject<T> }) => JSX.Element) => {
	return (props) => {
		const { ref, ...rest } = props;
		return Component(rest as P, ref);
	};
};

export const useImperativeHandle = <T>(
	ref: RefObject<T>,
	createHandle: () => T,
	_deps: readonly unknown[],
): void => {
	// In SSR, set the ref immediately
	if (ref) {
		ref.current = createHandle();
	}
};

export const useSyncExternalStore = <T>(
	_subscribe: (callback: () => void) => () => void,
	_getSnapshot: () => T,
	getServerSnapshot?: () => T,
): T => {
	// In SSR, use the server snapshot if provided
	if (getServerSnapshot) {
		return getServerSnapshot();
	}
	throw new Error("getServerSnapshot is required for server side rendering");
};

// Stub implementations for DOM-specific hooks
export const useOptimistic = <T, N>(
	state: T,
	_updateState: (currentState: T, action: N) => T,
): [T, (action: N) => void] => {
	// For SSR, just return the current state and a no-op function
	return [state, () => {}];
};

export const useActionState = <T>(
	_fn: Function,
	initialState: T,
	_permalink?: string,
): [T, Function] => {
	// For SSR, return initial state and a no-op function
	return [initialState, () => {}];
};
