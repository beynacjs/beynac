import { BeynacError } from "../error";
import { arrayWrap, describeType } from "../utils";
import { MarkupStream } from "./markup-stream";
import type { Component, JSX, JSXNode } from "./public-types";

type JSXFactory = (
  tag: string | Component,
  props: Record<string, unknown> | null,
  key?: unknown,
) => JSX.Element;

const notProvided = Symbol();

export const jsx: JSXFactory = (
  tag: string | Component,
  props: Record<string, unknown> | null,
  key: unknown = notProvided,
): JSX.Element => {
  if (key !== notProvided) {
    props ??= {};
    props.key = key;
  } else {
    if (tag && typeof tag === "function" && tag.defaultKeyFromSourcePosition) {
      props ??= {};
      props.key = getCallerSourcePosition();
    }
  }
  if (typeof tag === "function") {
    let displayName: string | undefined;
    if ("displayName" in tag && typeof tag.displayName === "string") {
      displayName = tag.displayName;
    } else if (tag.name) {
      displayName = tag.name;
    }
    return new MarkupStream(
      null,
      null,
      (ctx) => tag(props ?? {}, ctx),
      displayName,
    );
  } else if (typeof tag === "string") {
    let children = null;
    if (props != null) {
      ({ children, ...props } = props);
    }
    return new MarkupStream(
      tag,
      props,
      children == null ? null : (arrayWrap(children) as JSXNode[]),
    );
  } else {
    throw new BeynacError(
      `Expected tag to be a string or component, got ${describeType(tag)}`,
    );
  }
};
export const jsxs: JSXFactory = jsx;
export const jsxDEV: JSXFactory = jsx;

export const Fragment = (
  props: Record<string, unknown> | null,
): JSX.Element => {
  const children = props?.children ?? null;
  return new MarkupStream(null, null, arrayWrap(children) as JSXNode[]);
};

function getCallerSourcePosition(): string {
  // eslint-disable-next-line @typescript-eslint/unbound-method -- Need to preserve and restore the global Error.prepareStackTrace
  const oldPrepareStackTrace = Error.prepareStackTrace;
  const oldLimit = Error.stackTraceLimit;

  try {
    Error.stackTraceLimit = 5;
    Error.prepareStackTrace = (_, stack) => stack;

    const err = new Error();
    const stack = err.stack as unknown as NodeJS.CallSite[];

    // stack[0] is this function
    // stack[1] is the jsx function
    // stack[2] is where the JSX was invoked from
    const callSite = stack[2];

    const fileName = callSite.getFileName() || "unknown";
    const lineNumber = callSite.getLineNumber() || 0;
    const columnNumber = callSite.getColumnNumber() || 0;

    return `@source-position:${fileName}:${lineNumber}:${columnNumber}`;
  } finally {
    Error.prepareStackTrace = oldPrepareStackTrace;
    Error.stackTraceLimit = oldLimit;
  }
}
