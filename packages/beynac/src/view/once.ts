import type { Component, JSXNode, PropsWithChildren } from "./public-types";
import { tagAsJsxElement } from "./public-types";
import { SPECIAL_NODE, SpecialNode } from "./special-node";

export type OnceKey = string | number | symbol | bigint;

export type OnceNode = JSXNode[] & SpecialNode & { onceKey: OnceKey };

export const isOnceNode = (node: JSXNode): node is OnceNode =>
  typeof (node as OnceNode)?.onceKey !== "undefined";

type OnceProps = PropsWithChildren<{ key: OnceKey }>;

type OnceComponent = Component<OnceProps> & {
  createComponent: (key?: OnceKey) => Component<PropsWithChildren>;
};

const OnceImpl: Component<OnceProps> = ({ children, key }) => {
  return tagAsJsxElement(Object.assign([children], { onceKey: key, [SPECIAL_NODE]: true }));
};

let anonOnceCounter = 0;

const createComponent = (key: OnceKey = Symbol(`once-${++anonOnceCounter}`)) => {
  const component: Component<PropsWithChildren> = ({ children }) => {
    return tagAsJsxElement(Object.assign([children], { onceKey: key, [SPECIAL_NODE]: true }));
  };
  const name = (typeof key === "symbol" ? key.description : String(key)) || "anonymous";
  component.displayName = `Once(${name})`;
  return component;
};

export const Once: OnceComponent = Object.assign(OnceImpl, {
  createComponent,
});
