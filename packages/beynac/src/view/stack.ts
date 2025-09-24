import { createKey, type Key } from "../keys";
import type { ContextImpl } from "./context";
import type { Component, JSXNode, PropsWithChildren } from "./public-types";

type CreateStackArgs = { displayName?: string };

/**
 * Creates a pair of components for implementing a stack pattern.
 * Content pushed with Push will be rendered at Out location.
 *
 * @returns Object with Push and Out component properties
 *
 * @example
 * ```tsx
 * const MyStack = createStack({ displayName: "MyStack" });
 *
 * <div>
 *   <MyStack.Out />
 *   <MyStack.Push>This will appear at Out location</MyStack.Push>
 * </div>
 * ```
 */
export function createStack({ displayName = "Stack" }: CreateStackArgs = {}): {
  Push: Component<PropsWithChildren>;
  Out: Component<PropsWithChildren>;
} {
  const stackIdentity = Symbol(displayName);

  const Push: Component<PropsWithChildren> = ({ children }, ctx) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- always present, added at root of render phase
    const queue = ctx.get(stackRenderContextKey)!.getQueue(stackIdentity);
    return toStackPushNode(children, queue);
  };

  Push.displayName = `${displayName}.Push`;

  const Out: Component<PropsWithChildren> = (_, ctx) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- always present, added at root of render phase
    return ctx.get(stackRenderContextKey)!.getQueue(stackIdentity);
  };
  Out.displayName = `${displayName}.Out`;

  return { Push, Out };
}

export class StackContext {
  #queues: Map<symbol, StackQueue> = new Map();

  getQueue(symbol: symbol): StackQueue {
    let queue = this.#queues.get(symbol);
    if (!queue) {
      queue = new StackQueue(symbol.description || "Stack");
      this.#queues.set(symbol, queue);
    }
    return queue;
  }

  completeAll(): void {
    for (const queue of this.#queues.values()) {
      queue.complete();
    }
  }
}

// Context key for tracking stack queues in current render
export const stackRenderContextKey: Key<StackContext | undefined> = createKey<StackContext>({
  displayName: "StackRenderContext",
});

export class StackPushMarker {
  constructor(
    public readonly stackIdentity: symbol,
    public readonly children: JSXNode,
    public readonly context: ContextImpl,
  ) {}
}

/**
 * StackQueue provides an async iterable interface for streaming content.
 * Items can be pushed from the push phase and consumed from the render phase.
 */
export class StackQueue implements AsyncIterable<JSXNode> {
  #queue: JSXNode[] = [];
  #waiter: ((value: JSXNode | null) => void) | null = null;
  #completed = false;
  #used = false;
  #displayName: string;

  constructor(displayName: string) {
    this.#displayName = displayName;
  }

  push(item: JSXNode): void {
    if (this.#completed) {
      throw new Error("Cannot push to completed StackQueue");
    }

    if (this.#waiter) {
      this.#waiter(item);
      this.#waiter = null;
    } else {
      this.#queue.push(item);
    }
  }

  complete(): void {
    this.#completed = true;
    if (this.#waiter) {
      this.#waiter(null);
      this.#waiter = null;
    }
  }

  async *[Symbol.asyncIterator](): AsyncIterator<JSXNode> {
    if (this.#used) {
      throw new Error(
        `${this.#displayName}.Out can only be used once per render - probably you have multiple <${this.#displayName}.Out> components in the same document`,
      );
    }
    this.#used = true;
    while (true) {
      if (this.#queue.length > 0) {
        const item = this.#queue.shift();
        if (item !== undefined) {
          yield item;
        }
      } else if (this.#completed) {
        return;
      } else {
        if (this.#waiter !== null) {
          throw new Error(
            `Internal error: multiple concurrent consumers of ${this.#displayName}.Out StackQueue`,
          );
        }
        yield await new Promise<JSXNode | null>((resolve) => {
          this.#waiter = resolve;
        });
      }
    }
  }
}

type StackPushNode = JSXNode[] & { stack: StackQueue };

export const isStackPushNode = (node: JSXNode): node is StackPushNode =>
  Array.isArray(node) && "stack" in node && node.stack instanceof StackQueue;

const toStackPushNode = (node: JSXNode, stack: StackQueue): StackPushNode =>
  Object.assign([node], { stack });
