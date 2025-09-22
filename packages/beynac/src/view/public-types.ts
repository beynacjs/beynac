import type { Key } from "../keys";
import type { IntrinsicElements as IntrinsicElementsDefined } from "./intrinsic-element-types";
import type { MarkupStream } from "./markup-stream";
import type { RawContent } from "./raw";

export type RenderOptions = {
  mode?: "html" | "xml";
};

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
  | ((context: Context) => Content)
  | AsyncIterable<Content>;

export namespace JSX {
  export type Element = Content;

  export type Children = Content;

  export interface ElementChildrenAttribute {
    children: Children;
  }

  export interface IntrinsicElements extends IntrinsicElementsDefined {
    [tagName: string]: Props;
  }

  export interface IntrinsicAttributes {
    key?: string | number | bigint | null | undefined;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- we follow react in using any here
export type Props = Record<string, any>;

export type Component<P = Props> = {
  (props: P): JSX.Element | null;
  displayName?: string | undefined;
};

export type PropsWithChildren<P = unknown> = P & {
  children?: JSX.Children | undefined;
};

// TODO get this from the csstype package
export type CSSProperties = Record<string, unknown>;
