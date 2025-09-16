import { BeynacError } from "../error";
import { isKey, type Key } from "../keys";
import {
  type ClassReference,
  getKeyName,
  type KeyOrClass,
} from "./container-key";
import { NO_VALUE, type NoValue } from "./no-value";

const invalidInjectMessage = `Dependencies that use inject() must be created by the container. See https://beynac.dev/xyz TODO make online explainer for this error and list causes and symptoms`;

export function inject<T>(token: Key<T>): Exclude<T, undefined>;
export function inject<T>(token: ClassReference<T>): T;

/**
 * Inject a dependency into a class constructor. Use this method with JavaScript
 * default argument syntax in the constructor of a class. When an instance of
 * the class is being built by the IoC Container, the correct dependency will be
 * provided.
 *
 * @param token a type token created with typeKey or a class reference
 *
 * @example
 * class MyClass {
 *     // inferred type of this.emailService is EmailService
 *     constructor(private emailService = inject(EmailService)) {}
 * }
 * // in your app: instance will have EmailService injected
 * const instance = container.make(MyClass);
 * // in your tests: you can supply a mock dependency
 * const instance = new MyClass(new MockEmailService());
 */
export function inject<T>(arg: KeyOrClass<T>): Exclude<T, undefined> {
  if (!_currentInjectHandler) {
    throw new BeynacError(invalidInjectMessage);
  }
  const result = _currentInjectHandler(arg, false);
  if (result === NO_VALUE) {
    throw new BeynacError(`Required dependency ${getKeyName(arg)} not found`);
  }
  return result as Exclude<T, undefined>;
}

export function injectOptional<T>(token: Key<T>): Exclude<T, undefined> | null;
export function injectOptional<T>(token: ClassReference<T>): T | null;

/**
 * Inject an optional dependency into a class constructor. Use like `inject()`.
 * If the dependency is not bound, it will be injected as null.
 *
 * @param token a type token created with typeKey or a class reference
 * @see inject
 *
 * @example
 * class MyClass {
 *     // inferred type of this.emailService is EmailService | null
 *     constructor(private emailService = injectOptional(EmailService)) {}
 * }
 * // in your app: instance will have EmailService injected if available
 * const instance = container.make(MyClass);
 * // in your tests: you can supply a mock dependency
 * const instance = new MyClass(new MockEmailService());
 */
export function injectOptional<T>(
  arg: KeyOrClass<T>
): Exclude<T, undefined> | null {
  if (!_currentInjectHandler) {
    throw new BeynacError(invalidInjectMessage);
  }
  let result: unknown = _currentInjectHandler(arg, true);
  if (result === NO_VALUE) {
    if (isKey(arg)) {
      result = arg.default;
    } else {
      result = null;
    }
  }
  return (result ?? null) as Exclude<T, undefined>;
}

type InjectHandler = <T>(arg: KeyOrClass<T>, optional: boolean) => T | NoValue;

let _currentInjectHandler: InjectHandler | null = null;

export const _getInjectHandler = (): InjectHandler | null => {
  return _currentInjectHandler;
};

export const _setInjectHandler = (handler: InjectHandler | null): void => {
  _currentInjectHandler = handler;
};
