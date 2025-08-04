// TODO restore
// /**
//  * A constructor function type that creates instances of type T
//  */
// export type Constructor<T = {}> = new (...args: unknown[]) => T;

// /**
//  * A map of scope names to their constructor functions
//  */
// type ScopesMap = Record<string, Constructor>;

// /**
//  * Type that adds optional scope properties to a class
//  */
// type WithScopes<T extends ScopesMap> = {
//   [K in keyof T]?: InstanceType<T[K]>;
// };

// /**
//  * Constructor interface for classes created by withScopes
//  */
// interface WithScopesConstructor<T extends ScopesMap> {
//   new (...args: unknown[]): WithScopes<T>;
//   withScope<K extends keyof T, This extends Constructor>(
//     this: This,
//     scopeName: K,
//     ...args: ConstructorParameters<This>
//   ): InstanceType<This> & Required<Pick<WithScopes<T>, K>>;
// }

// /**
//  * Helper function to set a property on an object without type checking
//  * @internal
//  */
// function untypedSet(obj: object, key: string, value: unknown): void {
//   (obj as Record<string, unknown>)[key] = value;
// }

// /**
//  * Creates a base class that can be extended with optional scopes.
//  *
//  * @param scopes - An object mapping scope names to their implementation classes
//  * @returns A base class that can be extended and has a static withScope method
//  *
//  * @example
//  * ```typescript
//  * const BaseWithScopes = withScopes({
//  *   logger: Logger,
//  *   db: Database
//  * });
//  *
//  * class MyService extends BaseWithScopes {
//  *   doSomething() {
//  *     if (this.logger) {
//  *       this.logger.log("Doing something");
//  *     }
//  *   }
//  * }
//  *
//  * // Create instance with logger scope initialized
//  * const service = MyService.withScope("logger");
//  * service.logger.log("Hello"); // logger is guaranteed to exist
//  * ```
//  */
// export function withScopes<T extends ScopesMap>(
//   scopes: T,
// ): WithScopesConstructor<T> {
//   // Validate input
//   if (!scopes || typeof scopes !== "object") {
//     throw new TypeError(
//       "withScopes requires an object mapping scope names to constructors",
//     );
//   }

//   for (const [scopeName, ScopeClass] of Object.entries(scopes)) {
//     if (typeof ScopeClass !== "function") {
//       throw new TypeError(
//         `Scope "${scopeName}" must be a constructor function`,
//       );
//     }
//   }

//   const BaseWithScopes = class {
//     /**
//      * Creates an instance of this class with the specified scope initialized
//      */
//     static withScope<K extends keyof T>(
//       this: Constructor,
//       scopeName: K,
//       ...args: unknown[]
//     ) {
//       if (!(scopeName in scopes)) {
//         throw new Error(`Unknown scope: ${String(scopeName)}`);
//       }

//       const instance = new this(...args);
//       const ScopeClass = scopes[scopeName]!; // We already validated scopeName exists

//       try {
//         untypedSet(instance, scopeName as string, new ScopeClass());
//       } catch (error) {
//         throw new Error(
//           `Failed to initialize scope "${String(scopeName)}": ${error instanceof Error ? error.message : String(error)}`,
//         );
//       }

//       return instance;
//     }

//     constructor(..._args: unknown[]) {
//       // Initialize scope properties as undefined
//       for (const scopeName in scopes) {
//         untypedSet(this, scopeName, undefined);
//       }
//     }
//   };

//   // Set a more descriptive name for debugging
//   Object.defineProperty(BaseWithScopes, "name", {
//     value: `BaseWithScopes<${Object.keys(scopes).join(", ")}>`,
//     configurable: true,
//   });

//   return BaseWithScopes as WithScopesConstructor<T>;
// }
