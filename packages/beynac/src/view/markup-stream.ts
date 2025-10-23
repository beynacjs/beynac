import type { HeadersInit } from "bun";
import { arrayWrap, withoutUndefinedValues } from "../utils";
import { classAttribute, type ClassAttributeValue } from "./class-attribute";
import { ContextImpl } from "./context";
import { isOnceNode, type OnceKey } from "./once";
import type { Context, CSSProperties, JSXNode, RenderOptions } from "./public-types";
import { RawContent } from "./raw";
import { isSpecialNode } from "./special-node";
import { isStackOutNode, isStackPushNode } from "./stack";
import { StreamBuffer } from "./stream-buffer";
import { styleObjectToString } from "./style-attribute";

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

/**
 * Renders content to a complete HTML/XML string.
 * This is a convenience wrapper around renderStream that collects all chunks.
 *
 * @param content - The content tree to render, e.g. <jsx>...</jsx> or html`...`
 * @param options.mode - Whether to render as "html" (default) or "xml"
 *
 * @example
 * ```ts
 * const html = await render(<div>Hello World</div>);
 * console.log(html); // "<div>Hello World</div>"
 * ```
 */
export async function render(content: JSXNode, options?: RenderOptions): Promise<string> {
  let result = "";
  for await (const chunk of renderStream(content, options)) {
    result += chunk;
  }
  return result;
}

export type RenderResponseOptions = {
  readonly status?: number;
  readonly statusText?: string;
  readonly headers?: HeadersInit;
} & RenderOptions;

/**
 * Renders content to a Response object for use in request handlers.
 * This streams the content as it's rendered, enabling efficient handling of async content.
 *
 * @param content - The content tree to render, e.g. <jsx>...</jsx> or html`...`
 * @param options - Response options (status, headers, etc.) and render options (mode, context)
 *
 * @example
 * ```ts
 * return await renderResponse(<div>Hello World</div>, { status: 200 });
 * ```
 */
export async function renderResponse(
  content: JSXNode,
  { mode, context, headers, status, statusText }: RenderResponseOptions = {},
): Promise<Response> {
  if (!(headers instanceof Headers)) {
    headers = new Headers(headers);
  }

  if (!headers.has("content-type")) {
    headers.set(
      "content-type",
      mode === "xml" ? "application/xml; charset=utf-8" : "text/html; charset=utf-8",
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of renderStream(content, { mode, context })) {
          controller.enqueue(new TextEncoder().encode(chunk));
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(stream, withoutUndefinedValues({ headers, status, statusText }));
}

/**
 * Renders content to an async generator that yields HTML/XML strings.
 * This enables streaming responses where content is sent to the client as it's generated.
 *
 * @param content - The content tree to render, e.g. <jsx>...</jsx> or html`...`
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
type ComponentStack = {
  name: string;
  parent: ComponentStack | null;
};

export function renderStream(
  content: JSXNode,
  { mode = "html", context }: RenderOptions = {},
): AsyncGenerator<string> {
  const buf = new StreamBuffer();
  let rootContext: ContextImpl;
  if (context) {
    if (!(context instanceof ContextImpl)) {
      throw new Error("Invalid context");
    }
    rootContext = context;
  } else {
    rootContext = new ContextImpl();
  }
  const componentStack: ComponentStack | null = null;
  const onceKeys = new Set<OnceKey>(); // Track used Once keys
  const preExecuteResults = new Map<unknown, { result: JSXNode; context: ContextImpl }>(); // Cache function execution results with context
  const preExecuteInProgress = new Map<unknown, Promise<unknown>>(); // Track functions currently being pre-executed

  // Pre-execution rapidly visits the tree in parallel executing functions and
  // saving their results. This means that by the time the rendering phase has
  // got to a function it will usually have already been executed. The practical
  // effect of this is that when a document contains two components that require
  // data e.g. a database call, provided that the components are independent in
  // the tree, they will load data in parallel.
  function startPreExecution(node: unknown, context: ContextImpl): void {
    switch (typeof node) {
      case "object":
        if (node instanceof MarkupStream) {
          startPreExecution(node.content, context);
          return;
        }

        if (isSpecialNode(node)) {
          // Don't pre-execute Stack or Once nodes
          return;
        }

        // Handle arrays - start all in parallel
        if (Array.isArray(node)) {
          for (const item of node) {
            startPreExecution(item, context);
          }
          return;
        }

        // Handle standalone promises - just continue pre-execution on resolved value
        if (node instanceof Promise) {
          node.then(
            (resolved) => {
              startPreExecution(resolved, context);
            },
            () => {
              // Ignore errors
            },
          );
          return;
        }
        return;

      case "function":
        // Skip if already cached or in progress
        if (preExecuteResults.has(node) || preExecuteInProgress.has(node)) {
          return;
        }

        try {
          const childContext = context.fork();
          const result = (node as (ctx: Context) => JSXNode)(childContext);

          if (result instanceof Promise) {
            // For async functions, mark the function as in-progress and cache result when done
            const completionPromise = result.then(
              (resolved) => {
                const contextToUse = childContext.wasModified() ? childContext : context;
                // Store the original promise as result, but use context determined after resolution
                preExecuteResults.set(node, { result, context: contextToUse });
                preExecuteInProgress.delete(node); // Remove from in-progress
                startPreExecution(resolved as JSXNode, contextToUse);
              },
              () => {
                // Ignore errors in pre-execution
                preExecuteInProgress.delete(node); // Remove from in-progress even on error
              },
            );
            preExecuteInProgress.set(node, completionPromise);
          } else {
            // For sync functions, cache immediately
            const contextToUse = childContext.wasModified() ? childContext : context;
            preExecuteResults.set(node, { result, context: contextToUse });
            startPreExecution(result, contextToUse);
          }
        } catch {
          // Ignore errors during pre-execution
        }
        return;
    }
  }

  // Define rendering functions as closures that capture buf, mode, onceKeys, preExecuteResults, and preExecuteInProgress
  async function renderNode(
    node: JSXNode,
    context: ContextImpl,
    stack: ComponentStack | null,
  ): Promise<void> {
    switch (typeof node) {
      case "symbol":
        buf.add(escapeHtml(String(node)));
        return;
      case "string":
        buf.add(escapeHtml(node));
        return;
      case "number":
      case "bigint":
        buf.add(String(node));
        return;
      case "boolean":
      case "undefined":
        return;
      case "object":
        if (node === null) return;
        if (isReactElement(node)) {
          throw new RenderingError(
            "invalid-content",
            stack,
            new Error(
              'Encountered a React JSX element. Use Beynac JSX instead, add /** @jsxImportSource beynac/view **/ to the file containing the JSX, or configure your build system to use "beynac/view" as a default JSX import source.',
            ),
          );
        }
        if (isSpecialNode(node)) {
          if (node instanceof RawContent) {
            buf.add(node.toString());
            return;
          }
          if (isStackPushNode(node)) {
            // Handle Stack.Push: redirect content to stack buffer
            buf.beginRedirect(node.stackPush);
            for (const item of node) {
              await renderNode(item, context, stack);
            }
            buf.endRedirect();
            return;
          }
          if (isStackOutNode(node)) {
            // Handle Stack.Out: render buffered stack content
            buf.emitRedirectedContent(node.stackOut);
            return;
          }
          if (isOnceNode(node)) {
            // Handle Once: render content only if key hasn't been seen
            if (!onceKeys.has(node.onceKey)) {
              onceKeys.add(node.onceKey);
              for (const item of node) {
                await renderNode(item, context, stack);
              }
            }
            return;
          }
          throw new Error("Unrecognised special node");
        }
        if (Array.isArray(node)) {
          for (const item of node) {
            await renderNode(item as JSXNode, context, stack);
          }
          return;
        }
        if (node instanceof MarkupStream) {
          await renderMarkupStream(node, context, stack);
          return;
        }
        if (node instanceof Promise) {
          buf.yield();
          try {
            const resolved = (await node) as JSXNode;
            await renderNode(resolved, context, stack);
          } catch (error) {
            if (error instanceof RenderingError) {
              throw error;
            }
            throw new RenderingError("content-promise-error", stack, error);
          }
          return;
        }

        buf.add(escapeHtml(String(node)));
        return;

      case "function":
        try {
          let result: JSXNode;
          let contextToUse: ContextImpl;

          // Wait for pre-execution if in progress
          const inProgress = preExecuteInProgress.get(node);
          if (inProgress) {
            await inProgress;
          }

          // Check if function was already executed in pre-execution
          const preExecuted = preExecuteResults.get(node);
          if (preExecuted) {
            result = preExecuted.result;
            contextToUse = preExecuted.context;

            if (result instanceof Promise) {
              buf.yield();
              try {
                const resolved = (await result) as JSXNode;
                await renderNode(resolved, contextToUse, stack);
              } catch (error) {
                throw new RenderingError("content-function-promise-rejection", stack, error);
              }
            } else {
              await renderNode(result, contextToUse, stack);
            }
          } else {
            // Execute the function normally
            const childContext = context.fork();
            result = node(childContext) as JSXNode;

            if (result instanceof Promise) {
              buf.yield();
              try {
                const resolved = (await result) as JSXNode;
                // Check wasModified after promise resolves for async functions
                contextToUse = childContext.wasModified() ? childContext : context;
                await renderNode(resolved, contextToUse, stack);
              } catch (error) {
                throw new RenderingError("content-function-promise-rejection", stack, error);
              }
            } else {
              // For sync functions, check wasModified immediately
              contextToUse = childContext.wasModified() ? childContext : context;
              await renderNode(result, contextToUse, stack);
            }
          }
        } catch (error) {
          if (error instanceof RenderingError) {
            throw error;
          }
          throw new RenderingError("content-function-error", stack, error);
        }
        return;
    }
  }

  async function renderMarkupStream(
    element: MarkupStream,
    context: ContextImpl,
    stack: ComponentStack | null,
  ): Promise<void> {
    const { tag, attributes, content, displayName } = element;
    const hasChildren = content && content.length > 0;

    // Push displayName to component stack if present
    const newStack = displayName ? { name: displayName, parent: stack } : stack;

    if (tag) {
      const isVoidElement = mode === "html" && emptyTags.has(tag);
      if (isVoidElement && hasChildren) {
        throw new RenderingError(
          "attribute-type-error",
          newStack,
          new Error(`<${tag}> is a void element and must not have children`),
        );
      }

      const selfClosing = !isVoidElement && mode === "xml" && !hasChildren;
      try {
        renderOpeningTag(tag, attributes, selfClosing, newStack);
      } catch (error) {
        if (error instanceof RenderingError) {
          throw error;
        }
        throw new RenderingError("attribute-type-error", newStack, error);
      }

      if (isVoidElement || selfClosing) {
        return;
      }
    }

    if (content) {
      for (const child of content) {
        await renderNode(child, context, newStack);
      }
    }

    if (tag) {
      renderClosingTag(tag);
    }
  }

  function renderOpeningTag(
    tag: string,
    attributes: Record<string, unknown> | null,
    selfClosing: boolean,
    stack: ComponentStack | null,
  ): void {
    buf.add("<");
    buf.add(tag);

    if (attributes) {
      for (const [key, value] of Object.entries(attributes)) {
        if (value == null) {
          continue;
        }

        if (mode === "html" && booleanAttributes.has(key)) {
          if (value === true) {
            buf.add(" ");
            buf.add(key);
          } else if (value !== false) {
            buf.add(" ");
            buf.add(key);
            buf.add('="');
            buf.add(escapeHtml(String(value)));
            buf.add('"');
          }
        } else {
          // Validate attribute types that can't be serialized
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
              "attribute-type-error",
              stack,
              new Error(`Attribute "${key}" has an invalid value type: ${valueType}`),
            );
          }

          let stringValue: string;

          if (key === "style" && typeof value === "object" && value) {
            stringValue = styleObjectToString(value as CSSProperties);
            if (!stringValue) continue;
          } else if (key === "class" && (typeof value === "object" || Array.isArray(value))) {
            stringValue = classAttribute(value as ClassAttributeValue);
            if (!stringValue) continue;
          } else {
            stringValue = String(value);
          }

          buf.add(" ");
          buf.add(key);
          buf.add('="');
          buf.add(escapeHtml(stringValue));
          buf.add('"');
        }
      }
    }

    buf.add(selfClosing ? " />" : ">");
  }

  function renderClosingTag(tag: string): void {
    buf.add("</");
    buf.add(tag);
    buf.add(">");
  }

  // Start pre-execution traversal (non-blocking)
  startPreExecution(content, rootContext);

  // Start the rendering
  renderNode(content, rootContext, componentStack).then(
    () => buf.complete(),
    (error) => {
      buf.error(error as Error);
    },
  );

  return buf.stream();
}

const HTML_ESCAPE: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

const escapeHtml = (str: string) => str.replace(/[&<>"]/g, (ch) => HTML_ESCAPE[ch]);

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

function isReactElement(value: unknown): boolean {
  return (
    value != null &&
    typeof value === "object" &&
    "$$typeof" in value &&
    typeof value.$$typeof === "symbol"
  );
}

type ErrorKind =
  | "content-function-error"
  | "content-function-promise-rejection"
  | "content-promise-error"
  | "attribute-type-error"
  | "invalid-content";

/**
 * Error thrown during rendering when an error occurs during content expansion or rendering.
 * Includes a component stack trace for debugging.
 */
export class RenderingError extends Error {
  readonly errorKind: ErrorKind;
  readonly componentStack: string[];

  constructor(errorKind: ErrorKind, componentStack: ComponentStack | null, cause: unknown) {
    const errorDetail = cause instanceof Error ? cause.message : String(cause);

    // Convert linked list to array for public API
    const stackArray: string[] = [];
    let node = componentStack;
    while (node) {
      stackArray.unshift(node.name);
      node = node.parent;
    }

    // Build stack trace string
    const stackTrace = stackArray.map((name) => `<${name}>`).join(" -> ");
    const message = stackTrace
      ? `Rendering error: ${errorDetail}; Component stack: ${stackTrace}`
      : `Rendering error: ${errorDetail}`;

    super(message);
    this.name = "RenderingError";
    this.errorKind = errorKind;
    this.componentStack = stackArray;
    this.cause = cause;
  }
}
