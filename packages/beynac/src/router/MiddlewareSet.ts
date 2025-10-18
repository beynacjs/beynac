import type { Container } from "../contracts";
import type { MiddlewareNext } from "../core/Controller";
import type { MiddlewareReference } from "../core/Middleware";
import { arrayWrapOptional } from "../utils";

export class MiddlewareSet {
  #middleware: Set<MiddlewareReference>;
  #withoutMiddleware: Set<MiddlewareReference>;

  private constructor(middleware: MiddlewareReference[], withoutMiddleware: MiddlewareReference[]) {
    this.#middleware = new Set(middleware);
    this.#withoutMiddleware = new Set(withoutMiddleware);
  }

  /**
   * Create a new MiddlewareSet from middleware and withoutMiddleware lists.
   * Returns null if both lists are empty.
   */
  static createIfRequired(
    middleware?: MiddlewareReference | MiddlewareReference[] | null,
    withoutMiddleware?: MiddlewareReference | MiddlewareReference[] | null,
  ): MiddlewareSet | null {
    const mw = arrayWrapOptional(middleware);
    const without = arrayWrapOptional(withoutMiddleware);

    if (mw.length === 0 && without.length === 0) {
      return null;
    }

    return new MiddlewareSet(
      mw.filter((m) => !without.includes(m)),
      without,
    );
  }

  /**
   * Merge parent middleware into this set (mutates in place).
   * Parent middleware is prepended to maintain correct execution order.
   */
  mergeWithGroup(
    groupMiddleware: MiddlewareReference[],
    groupWithout: MiddlewareReference[],
  ): void {
    groupWithout.forEach((m) => this.#withoutMiddleware.add(m));

    // Rebuild Set with group middleware first
    this.#middleware = new Set([
      ...groupMiddleware.filter((m) => !this.#withoutMiddleware.has(m)),
      ...this.#middleware,
    ]);
  }

  /**
   * Make a function that executes middleware in order, then calls the final handler.
   */
  buildPipeline(container: Container, finalHandler: MiddlewareNext): MiddlewareNext {
    const middlewareInstances = Array.from(this.#middleware).map((ref) => container.get(ref));

    let next: MiddlewareNext = finalHandler;

    for (let i = middlewareInstances.length - 1; i >= 0; i--) {
      const middleware = middlewareInstances[i];
      const currentNext = next;
      next = (ctx) => middleware.handle(ctx, currentNext);
    }

    return next;
  }
}
