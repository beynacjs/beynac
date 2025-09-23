import { arrayWrap } from "../utils";
import { classAttribute, type ClassAttributeValue } from "./class-attribute";
import { ContextImpl } from "./context";
import { CSSProperties } from "./intrinsic-element-types";
import { OnceMarker } from "./once";
import type { JSXNode, RenderOptions } from "./public-types";
import { RawContent } from "./raw";
import { styleObjectToString } from "./style-attribute";

export type { RenderOptions } from "./public-types";

/**
 * A MarkupStream represents an HTML/XML element with optional tag, attributes, and children.
 * It serves as the primary building block for the virtual DOM representation.
 */
export class MarkupStream {
  readonly tag: string | null;
  readonly displayName: string | null;
  readonly attributes: Record<string, unknown> | null;
  readonly content: JSXNode[] | null;

  constructor(
    tag: string | null,
    attributes: Record<string, unknown> | null,
    children: JSXNode,
    displayName?: string | null,
  ) {
    this.tag = tag;
    this.attributes = attributes;
    this.content = children == null ? null : arrayWrap(children);
    this.displayName = displayName ?? tag ?? null;
  }
}

type FrameItem =
  | string
  | Promise<unknown>
  | ExpansionErrorInfo
  | Frame
  | OnceMarker
  | null
  | undefined;

type Frame = {
  content: FrameItem[];
  tag: string | null;
  displayName: string | null;
  attributes: Record<string, unknown> | null;
  index: number;
};

type ErrorKind =
  | "content-function-error"
  | "content-function-promise-rejection"
  | "content-promise-error"
  | "async-iterator-error"
  | "attribute-type-error";

class ExpansionErrorInfo {
  constructor(
    public readonly error: unknown,
    public readonly errorKind: ErrorKind,
  ) {}
}

/**
 * Error thrown during rendering when an error occurs during content expansion or rendering.
 * Includes a component stack trace for debugging.
 */
export class RenderingError extends Error {
  public readonly errorKind: ErrorKind;
  public readonly componentStack: string[];

  constructor(node: ExpansionErrorInfo, nodeStack: Frame[]) {
    // Build component stack from nodeStack
    const componentStack: string[] = [];
    for (const stackFrame of nodeStack) {
      if (stackFrame.displayName) {
        componentStack.push(stackFrame.displayName);
      }
    }

    const errorDetail =
      node.error instanceof Error ? node.error.message : String(node.error);
    const stackTrace = componentStack.map((name) => `<${name}>`).join(" -> ");
    const message = `Rendering error: ${errorDetail}; Component stack: ${stackTrace}`;

    super(message);
    this.name = "RenderingError";
    this.cause = node.error;
    this.errorKind = node.errorKind;
    this.componentStack = componentStack;
  }
}

const isAsyncIterable = (value: unknown): value is AsyncIterable<JSXNode> =>
  value != null && typeof value === "object" && Symbol.asyncIterator in value;

/**
 * Creates a Frame object with the provided content and optional metadata.
 * Frames are the building blocks of the render tree.
 */
const createFrame = (
  content: FrameItem[],
  tag: string | null = null,
  displayName: string | null = null,
  attributes: Record<string, unknown> | null = null,
): Frame => ({
  content,
  tag,
  displayName,
  attributes,
  index: 0,
});

const expandContent = (
  content: JSXNode,
  dest: FrameItem[],
  destIndex: number,
  context: ContextImpl,
): void => {
  if (typeof content === "function") {
    const childContext = context.fork();
    let result: JSXNode;
    try {
      result = content(childContext) as JSXNode;
    } catch (error) {
      dest[destIndex] = new ExpansionErrorInfo(error, "content-function-error");
      return;
    }

    const handleResult = (resolved: JSXNode): void => {
      expandContent(
        resolved,
        dest,
        destIndex,
        childContext.wasModified() ? childContext : context,
      );
    };

    if (result instanceof Promise) {
      // Place the promise in the array so render phase can wait on it
      dest[destIndex] = result;
      result.then(handleResult).catch((error) => {
        dest[destIndex] = new ExpansionErrorInfo(
          error,
          "content-function-promise-rejection",
        );
      });
    } else {
      handleResult(result);
    }
  } else if (content instanceof Promise) {
    // Place the promise in the array so render phase can wait on it
    dest[destIndex] = content;
    content
      .then((resolved: JSXNode) => {
        expandContent(resolved, dest, destIndex, context);
      })
      .catch((error) => {
        dest[destIndex] = new ExpansionErrorInfo(
          error,
          "content-promise-error",
        );
      });
  } else if (isAsyncIterable(content)) {
    // Replace the async iterable with an array that will hold its results,
    // growing as necessary. While we are consuming the iterable, the last
    // item in the array will always be a promise. This ensures that the
    // rendering phase will wait until we have finished consuming the
    // iterable before proceeding.
    const iterResult: FrameItem[] = [];
    // Wrap in a Frame object
    dest[destIndex] = createFrame(iterResult);
    const iterator = content[Symbol.asyncIterator]();

    const consumeNext = (): void => {
      const nextPromise = iterator.next();
      const promiseIndex = iterResult.length;

      iterResult.push(nextPromise);

      void nextPromise
        .then(({ value, done }) => {
          if (!done) {
            expandContent(value, iterResult, promiseIndex, context);
            consumeNext();
          } else {
            // if `done` then value is the return value of the generator
            // function which we do not want to render.
            iterResult[promiseIndex] = null;
          }
        })
        .catch((error) => {
          iterResult[promiseIndex] = new ExpansionErrorInfo(
            error,
            "async-iterator-error",
          );
        });
    };

    consumeNext();
  } else if (content instanceof OnceMarker) {
    dest[destIndex] = content;
  } else if (content instanceof MarkupStream) {
    const sourceContent = content.content || [];
    const expandedContent: FrameItem[] = new Array<FrameItem>(
      sourceContent.length,
    );
    for (let i = 0; i < sourceContent.length; i++) {
      expandContent(sourceContent[i], expandedContent, i, context);
    }

    // Replace with pre-built Frame
    dest[destIndex] = createFrame(
      expandedContent,
      content.tag,
      content.displayName,
      content.attributes,
    );
  } else if (Array.isArray(content)) {
    const nestedDest: FrameItem[] = new Array<FrameItem>(content.length);
    for (let i = 0; i < content.length; i++) {
      expandContent(content[i] as JSXNode, nestedDest, i, context);
    }
    // Wrap array in a Frame object
    dest[destIndex] = createFrame(nestedDest);
  } else {
    // Primitive value: convert to string or null
    if (content != null && typeof content !== "boolean") {
      if (content instanceof RawContent) {
        dest[destIndex] = content.toString();
      } else {
        dest[destIndex] = escapeHtml(String(content));
      }
    } else {
      dest[destIndex] = null;
    }
  }
};

function expandContentTree(content: JSXNode): Frame | null {
  if (content == null) return null;

  const wrapped = arrayWrap(content);
  const sourceArray = [...wrapped];
  const destArray: FrameItem[] = new Array<FrameItem>(sourceArray.length);
  const rootContext = new ContextImpl();

  for (let i = 0; i < sourceArray.length; i++) {
    expandContent(sourceArray[i], destArray, i, rootContext);
  }

  // Return a root Frame containing the expanded content
  return createFrame(destArray);
}

const HTML_ESCAPE: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

const escapeHtml = (str: string) =>
  str.replace(/[&<>"]/g, (ch) => HTML_ESCAPE[ch]);

const emptyTags = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "keygen",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

const booleanAttributes = new Set([
  "allowfullscreen",
  "async",
  "autofocus",
  "autoplay",
  "checked",
  "controls",
  "default",
  "defer",
  "disabled",
  "download",
  "formnovalidate",
  "hidden",
  "inert",
  "ismap",
  "itemscope",
  "loop",
  "multiple",
  "muted",
  "nomodule",
  "novalidate",
  "open",
  "playsinline",
  "readonly",
  "required",
  "reversed",
  "selected",
]);

/**
 * Renders content to an async generator that yields HTML/XML strings.
 * This enables streaming responses where content is sent to the client as it's generated.
 *
 * @param content - The content tree to render (can include components, strings, arrays, etc.)
 * @param options - Rendering options
 * @param options.mode - Whether to render as "html" (default) or "xml"
 * @yields HTML/XML string chunks as they're generated
 *
 * @example
 * ```ts
 * for await (const chunk of renderStream(<div>Hello</div>)) {
 *   response.write(chunk);
 * }
 * ```
 */
export async function* renderStream(
  content: JSXNode,
  { mode = "html" }: RenderOptions = {},
): AsyncGenerator<string> {
  const rootFrame = expandContentTree(content);

  if (!rootFrame) {
    return;
  }

  let buffer = "";
  const nodeStack: Frame[] = [];
  const onceMap = new Map<string | number | symbol | bigint, true>();

  const renderOpeningTag = (
    tag: string,
    attributes: Record<string, unknown> | null,
    selfClosing: boolean,
  ): void => {
    if (!tag) return;

    buffer += "<";
    buffer += tag;

    if (attributes) {
      for (const [key, value] of Object.entries(attributes)) {
        if (value == null) {
          continue;
        }

        if (mode === "html" && booleanAttributes.has(key)) {
          // HTML mode: boolean attributes
          if (value === true) {
            buffer += " ";
            buffer += key;
          } else if (value === false) {
            // Omit false boolean attributes in HTML
          } else {
            // Non-boolean value for a boolean attribute
            buffer += " ";
            buffer += key;
            buffer += '="';
            buffer += escapeHtml(String(value));
            buffer += '"';
          }
        } else {
          // XML mode or non-boolean attributes in HTML
          let stringValue;
          if (key === "style" && typeof value === "object" && value) {
            stringValue = styleObjectToString(value as CSSProperties);
            if (!stringValue) continue;
          } else if (
            key === "class" &&
            (typeof value === "object" || Array.isArray(value))
          ) {
            stringValue = classAttribute(value as ClassAttributeValue);
            if (!stringValue) continue;
          } else {
            // Runtime validation for attribute values that can't be serialized to HTML
            // TypeScript can't prevent these at compile time due to index signature limitations
            if (
              value instanceof Promise ||
              typeof value === "symbol" ||
              typeof value === "function"
            ) {
              const valueType =
                value instanceof Promise
                  ? "Promise"
                  : typeof value === "symbol"
                    ? "Symbol"
                    : "Function";

              throw new RenderingError(
                new ExpansionErrorInfo(
                  new Error(
                    `Attribute "${key}" has an invalid value type: ${valueType}`,
                  ),
                  "attribute-type-error",
                ),
                nodeStack,
              );
            }

            stringValue = String(value);
          }
          buffer += " ";
          buffer += key;
          buffer += '="';
          buffer += escapeHtml(stringValue);
          buffer += '"';
        }
      }
    }

    buffer += selfClosing ? " />" : ">";
  };

  // Start with root frame
  nodeStack.push(rootFrame);

  // Process stack
  while (nodeStack.length > 0) {
    const frame = nodeStack[nodeStack.length - 1];

    if (!frame.content || frame.index >= frame.content.length) {
      // Render closing tag if needed
      if (frame.tag) {
        const needsClosing =
          mode === "html" ? !emptyTags.has(frame.tag) : !!frame.content?.length;

        if (needsClosing) {
          buffer += "</";
          buffer += frame.tag;
          buffer += ">";
        }
      }

      nodeStack.pop();
      const parentFrame = nodeStack[nodeStack.length - 1];
      if (parentFrame) {
        parentFrame.index++;
      }
      continue;
    }

    const node = frame.content[frame.index];

    if (node instanceof ExpansionErrorInfo) {
      throw new RenderingError(node, nodeStack);
    } else if (node instanceof OnceMarker) {
      // Handle OnceMarker - check if this key has been rendered
      if (!onceMap.has(node.key)) {
        // First time seeing this key - mark it and expand the children
        onceMap.set(node.key, true);
        // We need to expand the children in place
        const contextImpl = node.context;
        expandContent(node.children, frame.content, frame.index, contextImpl);
      } else {
        // Already seen this key - skip it
        frame.content[frame.index] = null;
        frame.index++;
      }
    } else if (node instanceof Promise) {
      // Yield current buffer before awaiting
      if (buffer) {
        yield buffer;
        buffer = "";
      }
      // Await the promise. We deliberately don't use the resolved value - the
      // content tree expansion will have replaced the promise in the tree with
      // the appropriate value - the promise result might require further expansion.
      try {
        await node;
      } catch {
        // No need to handle this error here. The expansion phase will put the
        // error into the tree and we will handle it during rendering.
      }
      // Don't increment index - reprocess this slot with the resolved value
    } else if (typeof node === "function") {
      // This shouldn't happen - functions should be expanded already
      // But handle it just in case for robustness
      throw new Error(
        "Unexpected function during render - expansion may have failed",
      );
    } else if (node && typeof node === "object" && !Array.isArray(node)) {
      // Check if it's an OnceMarker first (must be before Frame check since OnceMarker is also an object)
      if (node instanceof OnceMarker) {
        // This case should have been handled above - but just in case
        throw new Error("OnceMarker encountered in wrong location");
      }
      // This is a pre-built Frame from expansion phase
      const frameNode = node;
      // Push frame onto stack before rendering (needed for error context)
      nodeStack.push(frameNode);
      // Render opening tag if present
      if (frameNode.tag) {
        const selfClosing = mode === "xml" && !frameNode.content?.length;
        renderOpeningTag(frameNode.tag, frameNode.attributes, selfClosing);
        // Check for void elements with children
        if (
          mode === "html" &&
          emptyTags.has(frameNode.tag) &&
          frameNode.content?.length
        ) {
          throw new Error(
            `<${frameNode.tag}> is a void element and must not have children`,
          );
        }
      }
    } else if (typeof node === "string") {
      // String content: already escaped or raw from expansion phase
      buffer += node;
      frame.index++;
    } else if (node == null) {
      // Null: skip
      frame.index++;
    } else {
      // This shouldn't happen - all content should be expanded already
      throw new Error(`Unexpected content type during render: ${typeof node}`);
    }
  }

  // Yield any remaining buffer
  if (buffer) {
    yield buffer;
  }
}

/**
 * Renders content to a complete HTML/XML string.
 * This is a convenience wrapper around renderStream that collects all chunks.
 *
 * @param content - The content tree to render
 * @param options - Rendering options (same as renderStream)
 * @returns A promise that resolves to the complete rendered HTML/XML string
 *
 * @example
 * ```ts
 * const html = await render(<div>Hello World</div>);
 * console.log(html); // "<div>Hello World</div>"
 * ```
 */
export async function render(
  content: JSXNode,
  options?: RenderOptions,
): Promise<string> {
  let result = "";
  for await (const chunk of renderStream(content, options)) {
    result += chunk;
  }
  return result;
}
