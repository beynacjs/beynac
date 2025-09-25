import { arrayWrap } from "../utils";
import { classAttribute, type ClassAttributeValue } from "./class-attribute";
import { ContextImpl } from "./context";
import { CSSProperties } from "./intrinsic-element-types";
import type { JSXNode, RenderOptions } from "./public-types";
import { RawContent } from "./raw";
import { isStackOutNode, isStackPushNode } from "./stack";
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
export function renderStream(
  content: JSXNode,
  { mode = "html" }: RenderOptions = {},
): AsyncGenerator<string> {
  const buf = new StreamBuffer();
  const rootContext = new ContextImpl();
  const componentStack: string[] = [];

  renderNode(content, buf, rootContext, mode, componentStack).then(
    () => buf.complete(),
    (error) => {
      buf.error(error as Error);
    },
  );

  return buf.stream();
}

class StreamBuffer {
  private buffer: string = "";
  private pending: string[] = [];
  private resolver: ((value: { done: boolean; chunk?: string }) => void) | null = null;
  private completed = false;
  private errorValue: Error | null = null;

  // Stack handling state
  private activeRedirect: symbol | null = null; // Currently active redirect
  private parentRedirects: symbol[] = []; // Stack of parent redirects for nesting
  private stackBuffers: Map<symbol, Array<string | string[]>> = new Map(); // Buffered content per stack
  private redirectsEmitted = new Set<symbol>(); // Track if Stack.Out used (for error)
  private hasRedirectEmit = false; // True after first Stack.Out encountered
  private deferredChunks: Array<string | string[]> = []; // Chunks to yield at end when hasStackOut is true

  add(content: string): void {
    this.buffer += content;
  }

  yield(): void {
    // Early return if buffer is empty
    if (!this.buffer) return;

    const chunk = this.buffer;
    this.buffer = "";

    // Route the chunk based on current state
    if (this.activeRedirect) {
      // Push to the active stack buffer array
      const bufferArray = this.stackBuffers.get(this.activeRedirect);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- will always have been created if there's an activeRedirect
      bufferArray!.push(chunk);
    } else if (this.hasRedirectEmit) {
      // In deferred mode, store chunks for later
      this.deferredChunks.push(chunk);
    } else {
      // Normal mode: send immediately to consumer
      this.#sendToResolver(chunk);
    }
  }

  complete(): void {
    this.yield();

    for (const item of this.deferredChunks) {
      if (typeof item === "string") {
        this.#sendToResolver(item);
      } else {
        for (const subItem of item) {
          this.#sendToResolver(subItem);
        }
      }
    }

    this.#terminate();
  }

  error(err: Error): void {
    this.errorValue = err;
    this.#terminate();
  }

  beginStackRedirect(stackSymbol: symbol): void {
    // Always yield to flush any pending content
    this.yield();

    // Push current redirect to parent stack if there is one
    if (this.activeRedirect) {
      this.parentRedirects.push(this.activeRedirect);
    }
    this.activeRedirect = stackSymbol;
    // Initialize stack buffer array if needed
    if (!this.stackBuffers.has(stackSymbol)) {
      this.stackBuffers.set(stackSymbol, []);
    }
  }

  endStackRedirect(): void {
    // Always yield to flush any content accumulated during redirect
    this.yield();

    // Pop back to parent redirect or null
    this.activeRedirect = this.parentRedirects.pop() ?? null;
  }

  handleStackOut(stackSymbol: symbol): void {
    if (this.redirectsEmitted.has(stackSymbol)) {
      throw new Error("Stack.Out can only be used once per render");
    }
    this.redirectsEmitted.add(stackSymbol);

    this.yield();

    // Get or create the stack buffer array for this symbol
    let stackArray = this.stackBuffers.get(stackSymbol);
    if (!stackArray) {
      stackArray = [];
      this.stackBuffers.set(stackSymbol, stackArray);
    }

    // Push the array reference to the appropriate destination
    if (this.activeRedirect) {
      const parentBuffer = this.stackBuffers.get(this.activeRedirect);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- will always have been created if there's an activeRedirect
      parentBuffer!.push(stackArray);
    } else {
      // Enable deferred mode on first top-level Stack.Out
      if (!this.hasRedirectEmit) {
        this.hasRedirectEmit = true;
      }
      // Add to deferred chunks
      this.deferredChunks.push(stackArray);
    }
  }

  async *stream(): AsyncGenerator<string> {
    while (true) {
      if (this.pending.length > 0) {
        const chunk = this.pending.shift();
        if (chunk) yield chunk;
      } else if (this.completed) {
        if (this.errorValue) {
          throw this.errorValue;
        }
        return;
      } else {
        if (this.resolver !== null) {
          throw new Error("StreamBuffer already has a consumer waiting");
        }
        const result = await new Promise<{ done: boolean; chunk?: string }>((resolve) => {
          this.resolver = resolve;
        });
        if (result.done) {
          if (this.errorValue) {
            throw this.errorValue;
          }
          return;
        }
        if (result.chunk) {
          yield result.chunk;
        }
      }
    }
  }

  #terminate() {
    this.completed = true;

    if (this.resolver) {
      this.resolver({ done: true });
      this.resolver = null;
    }
  }

  #sendToResolver(chunk: string): void {
    if (this.resolver) {
      this.resolver({ done: false, chunk });
      this.resolver = null;
    } else {
      this.pending.push(chunk);
    }
  }
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

async function renderNode(
  node: JSXNode,
  buf: StreamBuffer,
  context: ContextImpl,
  mode: "html" | "xml",
  componentStack: string[],
): Promise<void> {
  if (node == null || typeof node === "boolean") return;
  if (node instanceof RawContent) {
    buf.add(node.toString());
  } else if (Array.isArray(node)) {
    if (isStackPushNode(node)) {
      // Handle Stack.Push: redirect content to stack buffer
      buf.beginStackRedirect(node.stackPush);
      for (const item of node) {
        await renderNode(item, buf, context, mode, componentStack);
      }
      buf.endStackRedirect();
    } else if (isStackOutNode(node)) {
      // Handle Stack.Out: render buffered stack content
      buf.handleStackOut(node.stackOut);
    } else {
      for (const item of node) {
        await renderNode(item as JSXNode, buf, context, mode, componentStack);
      }
    }
  } else if (typeof node === "function") {
    try {
      const childContext = context.fork();
      const result = node(childContext) as JSXNode;
      const contextToUse = childContext.wasModified() ? childContext : context;

      if (result instanceof Promise) {
        buf.yield();
        try {
          const resolved = (await result) as JSXNode;
          await renderNode(resolved, buf, contextToUse, mode, componentStack);
        } catch (error) {
          throw new RenderingError("content-function-promise-rejection", componentStack, error);
        }
      } else {
        await renderNode(result, buf, contextToUse, mode, componentStack);
      }
    } catch (error) {
      if (error instanceof RenderingError) {
        throw error;
      }
      throw new RenderingError("content-function-error", componentStack, error);
    }
  } else if (node instanceof Promise) {
    buf.yield();
    try {
      const resolved = (await node) as JSXNode;
      await renderNode(resolved, buf, context, mode, componentStack);
    } catch (error) {
      if (error instanceof RenderingError) {
        throw error;
      }
      throw new RenderingError("content-promise-error", componentStack, error);
    }
  } else if (node instanceof MarkupStream) {
    await renderMarkupStream(node, buf, context, mode, componentStack);
  } else {
    buf.add(escapeHtml(String(node)));
  }
}

async function renderMarkupStream(
  element: MarkupStream,
  buf: StreamBuffer,
  context: ContextImpl,
  mode: "html" | "xml",
  componentStack: string[],
): Promise<void> {
  const { tag, attributes, content, displayName } = element;
  const hasChildren = content && content.length > 0;

  // Push displayName to component stack if present
  const newStack = displayName ? [...componentStack, displayName] : componentStack;

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
      renderOpeningTag(tag, attributes, buf, mode, selfClosing, newStack);
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
      await renderNode(child, buf, context, mode, newStack);
    }
  }

  if (tag) {
    renderClosingTag(tag, buf);
  }
}

function renderOpeningTag(
  tag: string,
  attributes: Record<string, unknown> | null,
  buf: StreamBuffer,
  mode: "html" | "xml",
  selfClosing: boolean,
  componentStack: string[],
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
        if (value instanceof Promise || typeof value === "symbol" || typeof value === "function") {
          const valueType =
            value instanceof Promise
              ? "Promise"
              : typeof value === "symbol"
                ? "Symbol"
                : "Function";
          throw new RenderingError(
            "attribute-type-error",
            componentStack,
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

/**
 * Renders a closing tag to the buf.
 */
function renderClosingTag(tag: string, buf: StreamBuffer): void {
  buf.add("</");
  buf.add(tag);
  buf.add(">");
}

type ErrorKind =
  | "content-function-error"
  | "content-function-promise-rejection"
  | "content-promise-error"
  | "attribute-type-error";

/**
 * Error thrown during rendering when an error occurs during content expansion or rendering.
 * Includes a component stack trace for debugging.
 */
export class RenderingError extends Error {
  public readonly errorKind: ErrorKind;
  public readonly componentStack: string[];

  constructor(errorKind: ErrorKind, componentStack: string[], cause: unknown) {
    const errorDetail = cause instanceof Error ? cause.message : String(cause);
    const stackTrace = componentStack.map((name) => `<${name}>`).join(" -> ");
    const message = stackTrace
      ? `Rendering error: ${errorDetail}; Component stack: ${stackTrace}`
      : `Rendering error: ${errorDetail}`;

    super(message);
    this.name = "RenderingError";
    this.errorKind = errorKind;
    this.componentStack = componentStack;
    this.cause = cause;
  }
}
