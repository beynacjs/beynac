import { BeynacError } from "../error";
import { arrayWrap, describeType } from "../utils";
import { MarkupStream } from "./markup-stream";
import type { Component, Content, JSX } from "./public-types";

type JSXFactory = (
  tag: string | Component,
  props: Record<string, unknown> | null
) => JSX.Element;

export const jsx: JSXFactory = (
  tag: string | Component,
  props: Record<string, unknown> | null
): JSX.Element => {
  if (typeof tag === "function") {
    return new MarkupStream(null, null, () => tag(props ?? {}) as Content);
  } else if (typeof tag === "string") {
    let children = null;
    if (props != null) {
      ({ children, ...props } = props);
    }
    return new MarkupStream(tag, props, arrayWrap(children) as Content[]);
  } else {
    throw new BeynacError(
      `Expected tag to be a string or component, got ${describeType(tag)}`
    );
  }
};
export const jsxs: JSXFactory = jsx;
export const jsxDEV: JSXFactory = jsx;

export const Fragment = (
  props: Record<string, unknown> | null
): JSX.Element => {
  const children = props?.children ?? null;
  return new MarkupStream(null, null, arrayWrap(children) as Content[]);
};
