import { arrayWrap } from "utils";
import { ContextImpl } from "./context";
import type { Content, JSX, RenderOptions } from "./public-types";
import { RawContent } from "./raw";
import { styleObjectToString } from "./style-attribute";

export type { RenderOptions };

type ContentItem =
  | Content
  | Promise<unknown>
  | ContentItem[]
  | ExpansionErrorInfo;

export class MarkupStream implements JSX.Element {
  readonly tag: string | null;
  readonly displayName: string | null;
  readonly attributes: Record<string, unknown> | null;
  readonly content: ContentItem[] | null;
  #contentTreeExpanded = false;

  constructor(
    tag: string | null,
    attributes: Record<string, unknown> | null,
    children: Content,
    displayName?: string | null
  ) {
    this.tag = tag;
    this.attributes = attributes;
    this.content = children == null ? null : arrayWrap(children);
    this.displayName = displayName ?? tag ?? null;
  }

  #expandContentTree(context?: ContextImpl): void {
    if (this.#contentTreeExpanded) return;
    this.#contentTreeExpanded = true;
    if (!this.content) return;

    const rootContext = context ?? new ContextImpl();

    const expandNode = (
      array: ContentItem[],
      index: number,
      context: ContextImpl
    ): void => {
      const node = array[index];

      if (typeof node === "function") {
        const childContext = context.fork();
        let result: Content;
        try {
          result = node(childContext);
        } catch (error) {
          array[index] = new ExpansionErrorInfo(
            error,
            "content-function-error"
          );
          return;
        }

        const handleResult = (resolved: Content): void => {
          array[index] = resolved;
          expandNode(
            array,
            index,
            childContext.wasModified() ? childContext : context
          );
        };

        if (result instanceof Promise) {
          array[index] = result;
          result.then(handleResult).catch((error) => {
            array[index] = new ExpansionErrorInfo(
              error,
              "content-function-promise-rejection"
            );
          });
        } else {
          handleResult(result);
        }
      } else if (node instanceof Promise) {
        node
          .then((resolved) => {
            array[index] = resolved as Content;
            expandNode(array, index, context);
          })
          .catch((error) => {
            array[index] = new ExpansionErrorInfo(
              error,
              "content-promise-error"
            );
          });
      } else if (isAsyncIterable(node)) {
        // Replace the async iterable with an array that will hold its results,
        // growing as necessary. While we are consuming the iterable, the last
        // item in the array will always be a promise. This ensures that the
        // rendering phase will wait until we have finished consuming the
        // iterable before proceeding.
        const resultArray: ContentItem[] = [];
        array[index] = resultArray;
        const iterator = node[Symbol.asyncIterator]();

        const consumeNext = (): void => {
          const nextPromise = iterator.next();
          const promiseIndex = resultArray.length;

          resultArray.push(nextPromise);

          void nextPromise
            .then(({ value, done }) => {
              if (!done) {
                resultArray[promiseIndex] = value;
                expandNode(resultArray, promiseIndex, context);
                consumeNext();
              } else {
                // if `done` then value is the return value of the generator
                // function which we do not want to render.
                resultArray[promiseIndex] = null;
              }
            })
            .catch((error) => {
              resultArray[promiseIndex] = new ExpansionErrorInfo(
                error,
                "async-iterator-error"
              );
            });
        };

        consumeNext();
      } else if (node instanceof MarkupStream) {
        node.#expandContentTree(context);
      } else if (Array.isArray(node)) {
        for (let i = 0; i < node.length; i++) {
          expandNode(node, i, context);
        }
      }
    };

    for (let i = 0; i < this.content.length; i++) {
      expandNode(this.content, i, rootContext);
    }
  }

  async *renderChunks({
    mode = "html",
  }: RenderOptions = {}): AsyncGenerator<string> {
    // First, we kick off an asynchronous process of expanding the content tree,
    // recursively descending into arrays and MarkupStreams. This process will
    // immediately remove all functions form the tree, and eventually remove all
    // promises. While we await the promises, they are left in the tree, and
    // eventually they will be replaced with their resolved value. This means
    // that for rendering, all we need to do is traverse the tree and if we
    // encounter a promise, await it before continuing.
    this.#expandContentTree();

    let buffer = "";
    const nodeStack: RenderStackFrame[] = [];

    const renderOpeningTag = (
      tag: string,
      attributes: Record<string, unknown> | null,
      selfClosing: boolean
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
            buffer += " ";
            buffer += key;
            buffer += '="';
            let stringValue;
            if (key === "style" && typeof value === "object" && value) {
              stringValue = styleObjectToString(value);
            } else {
              stringValue = String(value);
            }
            buffer += escapeHtml(stringValue);
            buffer += '"';
          }
        }
      }

      buffer += selfClosing ? " />" : ">";
    };

    const pushStackFrame = (
      content: ContentItem[] | null,
      tag: string | null,
      displayName: string | null,
      attributes: Record<string, unknown> | null
    ): void => {
      const selfClosing = mode === "xml" && !content?.length;
      if (tag) {
        renderOpeningTag(tag, attributes, selfClosing);
      }
      // Check for void elements with children
      if (tag && mode === "html" && emptyTags.has(tag) && content?.length) {
        throw new Error(
          `<${tag}> is a void element and must not have children`
        );
      }
      const htmlEmptyTag =
        tag && mode === "html" && emptyTags.has(tag) && !content?.length;
      nodeStack.push({
        content: htmlEmptyTag ? [] : (content ?? []),
        tag,
        displayName,
        index: 0,
      });
    };

    // Start with root
    pushStackFrame(this.content, this.tag, this.displayName, this.attributes);

    // Process stack
    while (nodeStack.length > 0) {
      const frame = nodeStack[nodeStack.length - 1];

      if (!frame.content || frame.index >= frame.content.length) {
        // Render closing tag if needed
        if (frame.tag) {
          const needsClosing =
            mode === "html"
              ? !emptyTags.has(frame.tag)
              : !!frame.content?.length;

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
        // Build component stack from nodeStack
        const componentStack: string[] = [];
        for (const stackFrame of nodeStack) {
          if (stackFrame.displayName) {
            componentStack.push(stackFrame.displayName);
          }
        }

        throw new RenderingError(node, componentStack);
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
          await (node as Promise<unknown>);
        } catch {
          // No need to handle this error here. The expansion phase will put the
          // error into the tree and we will handle it during rendering.
        }
        // Don't increment index - reprocess this slot with the resolved value
      } else if (typeof node === "function") {
        // This shouldn't happen - functions should be expanded already
        // But handle it just in case for robustness
        throw new Error(
          "Unexpected function during render - expansion may have failed"
        );
      } else if (node instanceof MarkupStream) {
        pushStackFrame(
          node.content,
          node.tag,
          node.displayName,
          node.attributes
        );
      } else if (Array.isArray(node)) {
        pushStackFrame(node, null, null, null);
      } else {
        // Primitive value: render as content
        if (node != null && typeof node !== "boolean") {
          if (node instanceof RawContent) {
            buffer += node.toString();
          } else {
            buffer += escapeHtml(String(node));
          }
        }
        frame.index++;
      }
    }

    // Yield any remaining buffer
    if (buffer) {
      yield buffer;
    }
  }

  async render(options?: RenderOptions): Promise<string> {
    let result = "";
    for await (const chunk of this.renderChunks(options)) {
      result += chunk;
    }
    return result;
  }
}

type RenderStackFrame = {
  content: ContentItem[];
  tag: string | null;
  displayName: string | null;
  index: number;
};

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

const isAsyncIterable = (value: unknown): value is AsyncIterable<Content> =>
  value != null && typeof value === "object" && Symbol.asyncIterator in value;

type ErrorKind =
  | "content-function-error"
  | "content-function-promise-rejection"
  | "content-promise-error"
  | "async-iterator-error";

class ExpansionErrorInfo {
  constructor(
    public readonly error: unknown,
    public readonly errorKind: ErrorKind
  ) {}
}

export class RenderingError extends Error {
  public readonly errorKind: ErrorKind;
  public readonly componentStack: string[];

  constructor(node: ExpansionErrorInfo, componentStack: string[]) {
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
