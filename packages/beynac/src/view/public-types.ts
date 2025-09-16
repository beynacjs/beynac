// biome-ignore-all lint/suspicious/noExplicitAny: we follow react in using any for some types here

import type { Key } from "../keys";
import type { IntrinsicElements as IntrinsicElementsDefined } from "./intrinsic-element-types";
import type { MarkupStream } from "./markup-stream";
import type { RawContent } from "./raw";

export interface Context {
  get<T>(key: Key<T>): T | null;
  set<T>(key: Key<T>, value: T): void;
}

export type Content =
  | string
  | number
  | RawContent
  | MarkupStream
  | null
  | undefined
  | boolean
  | Promise<Content>
  | Content[]
  | ((context: Context) => Content);

export type Chunk = [string, Promise<Chunk> | null];

export namespace JSX {
  export type Element = {
    render(): string | Promise<string>;
    renderChunks(): Chunk;
  };

  export type Children =
    | string
    | Promise<string>
    | number
    | Element
    | null
    | undefined
    | boolean
    | Children[];

  export interface ElementChildrenAttribute {
    children: Children;
  }

  export interface IntrinsicElements extends IntrinsicElementsDefined {
    [tagName: string]: AnyProps;
  }

  export interface IntrinsicAttributes {
    key?: string | number | bigint | null | undefined;
  }
}

type AnyProps = Record<string, unknown>;

export type Component<P = AnyProps> = (props: P) => JSX.Element | null;

export type PropsWithChildren<P = unknown> = P & {
  children?: JSX.Children | undefined;
};

// TODO get this from the csstype package
export type CSSProperties = Record<string, unknown>;
