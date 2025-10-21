import type { Key } from "../keys";
import type { IntrinsicElements as IntrinsicElementsDefined } from "./intrinsic-element-types";

export type RenderOptions = {
  mode?: "html" | "xml" | undefined;
  context?: Context | undefined;
};

export interface Context {
  get<T>(key: Key<T>): T | null;
  set<T>(key: Key<T>, value: T): void;
}

export type JSXNode =
  | string
  | number
  | bigint
  | boolean
  | JSXNode[]
  | object
  | null
  | undefined
  | ((context: Context) => JSXNode | Promise<JSXNode>);

export const JSXElementBrand: unique symbol = Symbol.for("beynac.jsx.element");

export interface JSXElement {
  readonly [JSXElementBrand]: true;
}

export function tagAsJsxElement<T>(value: T): T & JSXElement {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access -- setting runtime brand on arbitrary value
  (value as any)[JSXElementBrand] = true;
  return value as T & JSXElement;
}

export function isJsxElement(value: unknown): value is JSXElement {
  return value != null && typeof value === "object" && JSXElementBrand in value;
}

export namespace JSX {
  export type Element = JSXElement | object;

  export type Children = JSXNode;

  export interface ElementChildrenAttribute {
    children: Children;
  }

  export interface IntrinsicElements extends IntrinsicElementsDefined {
    [tagName: string]: Props;
  }

  export interface IntrinsicAttributes {}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- we follow react in using any here
export type Props = Record<string, any>;

export type Component<P = Props> = {
  (props: P, context: Context): JSX.Element | Promise<JSX.Element | null> | null;
  displayName?: string | undefined;
};

export type PropsWithChildren<P = unknown> = P & {
  children?: JSX.Children | undefined;
};

// TODO get this from the csstype package
export type CSSProperties = Record<string, unknown>;
