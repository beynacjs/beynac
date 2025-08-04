// TODO restore
// import { expect, test, describe } from "bun:test";
// import { withScopes, type Constructor } from "./withScopes";

// // Test scope classes
// class Logger {
//   log(message: string): string {
//     return `[LOG] ${message}`;
//   }
// }

// class Database {
//   query(sql: string): string {
//     return `Executing: ${sql}`;
//   }
// }

// class Cache {
//   get(key: string): string {
//     return `Cache value for ${key}`;
//   }

//   set(_key: string, _value: string): void {
//     // Implementation
//   }
// }

// class BrokenScope {
//   constructor() {
//     throw new Error("Scope initialization failed");
//   }
// }

// describe("withScopes", () => {
//   describe("basic functionality", () => {
//     test("should create a constructor with optional scope properties", () => {
//       const BaseWithScopes = withScopes({
//         logger: Logger,
//         db: Database,
//       });

//       class MyService extends BaseWithScopes {
//         getName(): string {
//           if (this.logger) {
//             return this.logger.log("Getting name");
//           }
//           return "No logger";
//         }
//       }

//       const service = new MyService();
//       expect(service.logger).toBeUndefined();
//       expect(service.db).toBeUndefined();
//       expect(service.getName()).toBe("No logger");
//     });

//     test("should instantiate scope with withScope static method", () => {
//       const BaseWithScopes = withScopes({
//         logger: Logger,
//         db: Database,
//       });

//       class MyService extends BaseWithScopes {
//         performAction(): string {
//           return this.logger!.log("Action performed");
//         }
//       }

//       const serviceWithLogger = MyService.withScope("logger");
//       expect(serviceWithLogger.logger).toBeInstanceOf(Logger);
//       expect(serviceWithLogger.logger.log("test")).toBe("[LOG] test");
//       expect(serviceWithLogger.performAction()).toBe("[LOG] Action performed");
//     });

//     test("should work with multiple scopes", () => {
//       const BaseWithScopes = withScopes({
//         logger: Logger,
//         db: Database,
//         cache: Cache,
//       });

//       class MyService extends BaseWithScopes {
//         getData(): string {
//           if (this.cache) {
//             return this.cache.get("data");
//           }
//           if (this.db) {
//             return this.db.query("SELECT * FROM data");
//           }
//           return "No data source";
//         }
//       }

//       const service1 = MyService.withScope("cache");
//       expect(service1.cache).toBeInstanceOf(Cache);
//       expect(service1.getData()).toBe("Cache value for data");

//       const service2 = MyService.withScope("db");
//       expect(service2.db).toBeInstanceOf(Database);
//       expect(service2.getData()).toBe("Executing: SELECT * FROM data");
//     });

//     test("should handle constructor arguments", () => {
//       const BaseWithScopes = withScopes({
//         logger: Logger,
//         db: Database,
//       });

//       class MyService extends BaseWithScopes {
//         testTypes(): void {
//           // These should type check correctly
//           if (this.logger) {
//             this.logger.log("test");
//           }

//           if (this.db) {
//             this.db.query("SELECT 1");
//           }
//         }
//       }

//       const serviceWithLogger = MyService.withScope("logger");
//       // This should not need a type guard since logger is guaranteed to exist
//       const logResult: string = serviceWithLogger.logger.log("guaranteed");
//       expect(logResult).toBe("[LOG] guaranteed");
//     });
//   });

//   describe("type safety", () => {
//     test("should provide proper TypeScript types", () => {
//       const BaseWithScopes = withScopes({
//         logger: Logger,
//       });

//       class MyService extends BaseWithScopes {
//         private name = "TestService";

//         getName(): string {
//           return this.name;
//         }

//         logName(): string {
//           if (this.logger) {
//             return this.logger.log(this.getName());
//           }
//           return this.getName();
//         }
//       }

//       const service = new MyService();
//       expect(service.getName()).toBe("TestService");
//       expect(service.logName()).toBe("TestService");

//       const serviceWithLogger = MyService.withScope("logger");
//       expect(serviceWithLogger.getName()).toBe("TestService");
//       expect(serviceWithLogger.logName()).toBe("[LOG] TestService");
//     });
//   });

//   describe("error handling", () => {
//     test("should throw error for invalid scopes input", () => {
//       expect(() =>
//         withScopes(null as unknown as Record<string, Constructor>),
//       ).toThrow(
//         "withScopes requires an object mapping scope names to constructors",
//       );
//       expect(() =>
//         withScopes("invalid" as unknown as Record<string, Constructor>),
//       ).toThrow(
//         "withScopes requires an object mapping scope names to constructors",
//       );
//       expect(() =>
//         withScopes(undefined as unknown as Record<string, Constructor>),
//       ).toThrow(
//         "withScopes requires an object mapping scope names to constructors",
//       );
//     });

//     test("should throw error for non-constructor scope values", () => {
//       expect(() =>
//         withScopes({
//           logger: "not a constructor" as unknown as Constructor,
//         }),
//       ).toThrow('Scope "logger" must be a constructor function');

//       expect(() =>
//         withScopes({
//           logger: Logger,
//           invalid: 123 as unknown as Constructor,
//         }),
//       ).toThrow('Scope "invalid" must be a constructor function');
//     });

//     test("should throw error when accessing unknown scope", () => {
//       const BaseWithScopes = withScopes({
//         logger: Logger,
//       });

//       class MyService extends BaseWithScopes {}

//       // @ts-expect-error Testing invalid scope name
//       expect(() => MyService.withScope("unknown")).toThrow(
//         "Unknown scope: unknown",
//       );
//     });

//     test("should throw error when scope initialization fails", () => {
//       const BaseWithScopes = withScopes({
//         broken: BrokenScope,
//       });

//       class MyService extends BaseWithScopes {}

//       expect(() => MyService.withScope("broken")).toThrow(
//         'Failed to initialize scope "broken": Scope initialization failed',
//       );
//     });
//   });

//   describe("edge cases", () => {
//     test("should work with empty scopes object", () => {
//       const BaseWithScopes = withScopes({});
//       class MyService extends BaseWithScopes {
//         getName(): string {
//           return "Service";
//         }
//       }

//       const service = new MyService();
//       expect(service.getName()).toBe("Service");
//     });

//     test("should preserve scope isolation between instances", () => {
//       const BaseWithScopes = withScopes({
//         logger: Logger,
//       });

//       class MyService extends BaseWithScopes {}

//       const service1 = MyService.withScope("logger");
//       const service2 = MyService.withScope("logger");

//       expect(service1.logger).not.toBe(service2.logger);
//       expect(service1.logger).toBeInstanceOf(Logger);
//       expect(service2.logger).toBeInstanceOf(Logger);
//     });

//     test("should have descriptive constructor name for debugging", () => {
//       const BaseWithScopes = withScopes({
//         logger: Logger,
//         db: Database,
//       });

//       expect(BaseWithScopes.name).toBe("BaseWithScopes<logger, db>");
//     });
//   });
// });
