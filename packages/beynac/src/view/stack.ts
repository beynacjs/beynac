import type { Component, JSXNode, PropsWithChildren } from "./public-types";
import { SPECIAL_NODE, SpecialNode } from "./special-node";

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
  Out: Component;
} {
  const stackIdentity = Symbol(displayName);

  const Push: Component<PropsWithChildren> = ({ children }): StackPushNode => {
    return Object.assign([children], { stackPush: stackIdentity, [SPECIAL_NODE]: true });
  };
  Push.displayName = `${displayName}.Push`;

  const Out: Component<PropsWithChildren> = () => {
    return Object.assign([], { stackOut: stackIdentity, [SPECIAL_NODE]: true });
  };
  Out.displayName = `${displayName}.Out`;

  return { Push, Out };
}

export type StackPushNode = JSXNode[] & SpecialNode & { stackPush: symbol };

export const isStackPushNode = (node: JSXNode): node is StackPushNode =>
  typeof (node as StackPushNode)?.stackPush === "symbol";

export type StackOutNode = JSXNode[] & SpecialNode & { stackOut: symbol };

export const isStackOutNode = (node: JSXNode): node is StackOutNode =>
  typeof (node as StackOutNode)?.stackOut === "symbol";
