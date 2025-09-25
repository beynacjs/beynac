import { arrayWrap } from "../utils";
import { classAttribute, type ClassAttributeValue } from "./class-attribute";
import { ContextImpl } from "./context";
import { CSSProperties } from "./intrinsic-element-types";
import type { JSXNode, RenderOptions } from "./public-types";
import { RawContent } from "./raw";
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
 * StreamBuffer manages buffering and streaming of rendered HTML content.
 * Provides an async iterable interface for consuming rendered chunks.
 */
class StreamBuffer {
  private buffer: string = "";
  private pending: string[] = [];
  private resolver: ((value: { done: boolean; chunk?: string }) => void) | null = null;
  private completed = false;

  append(content: string): void {
    this.buffer += content;
  }

  yield(): void {
    if (this.buffer) {
      const chunk = this.buffer;
      this.buffer = "";

      if (this.resolver) {
        this.resolver({ done: false, chunk });
        this.resolver = null;
      } else {
        this.pending.push(chunk);
      }
    }
  }

  complete(): void {
    this.yield(); // Flush any remaining buffer
    this.completed = true;

    // Signal completion to waiting consumer
    if (this.resolver) {
      this.resolver({ done: true });
      this.resolver = null;
    }
  }

  async *stream(): AsyncGenerator<string> {
    while (true) {
      if (this.pending.length > 0) {
        const chunk = this.pending.shift();
        if (chunk) yield chunk;
      } else if (this.completed) {
        return;
      } else {
        if (this.resolver !== null) {
          throw new Error("StreamBuffer already has a consumer waiting");
        }
        const result = await new Promise<{ done: boolean; chunk?: string }>((resolve) => {
          this.resolver = resolve;
        });
        if (result.done) {
          return;
        }
        if (result.chunk) {
          yield result.chunk;
        }
      }
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
export function renderStream(
  content: JSXNode,
  { mode = "html" }: RenderOptions = {},
): AsyncGenerator<string> {
  const buffer = new StreamBuffer();
  const rootContext = new ContextImpl();

  // Start the rendering process asynchronously
  renderNode(content, buffer, rootContext, mode).then(
    () => buffer.complete(),
    () => buffer.complete(), // Also complete on error
  );

  return buffer.stream();
}

/**
 * Recursively renders a JSX node and its children to the StreamBuffer.
 * Handles components, promises, arrays, and primitive values.
 */
async function renderNode(
  node: JSXNode,
  buffer: StreamBuffer,
  context: ContextImpl,
  mode: "html" | "xml",
): Promise<void> {
  if (node == null || typeof node === "boolean") {
    // Skip null, undefined, and booleans
    return;
  }

  if (typeof node === "string" || typeof node === "number") {
    // Escape and append primitive values
    buffer.append(escapeHtml(String(node)));
    return;
  }

  if (node instanceof RawContent) {
    // Raw content is not escaped
    buffer.append(node.toString());
    return;
  }

  if (Array.isArray(node)) {
    // Render each item in the array
    for (const item of node) {
      await renderNode(item as JSXNode, buffer, context, mode);
    }
    return;
  }

  if (typeof node === "function") {
    // Call component function with forked context
    const childContext = context.fork();
    const result = node(childContext) as JSXNode;
    const contextToUse = childContext.wasModified() ? childContext : context;
    await renderNode(result, buffer, contextToUse, mode);
    return;
  }

  if (node instanceof Promise) {
    // Yield buffer before awaiting promise
    buffer.yield();
    const resolved = (await node) as JSXNode;
    await renderNode(resolved, buffer, context, mode);
    return;
  }

  if (node instanceof MarkupStream) {
    // Render HTML element
    await renderElement(node, buffer, context, mode);
    return;
  }

  // Skip any other types (AsyncIterable, Once, Stack, etc.)
}

/**
 * Renders a MarkupStream element with its tag, attributes, and children.
 */
async function renderElement(
  element: MarkupStream,
  buffer: StreamBuffer,
  context: ContextImpl,
  mode: "html" | "xml",
): Promise<void> {
  const { tag, attributes, content } = element;

  if (!tag) {
    // Fragment: just render children
    if (content) {
      for (const child of content) {
        await renderNode(child, buffer, context, mode);
      }
    }
    return;
  }

  // Render opening tag
  buffer.append("<");
  buffer.append(tag);

  // Render attributes
  if (attributes) {
    renderAttributes(attributes, buffer, mode);
  }

  // Check if this is a void element in HTML mode
  const isVoidElement = mode === "html" && emptyTags.has(tag);
  const hasChildren = content && content.length > 0;

  if (isVoidElement) {
    // Void elements are self-closing in HTML
    buffer.append(">");
    if (hasChildren) {
      throw new Error(`<${tag}> is a void element and must not have children`);
    }
    return;
  }

  if (mode === "xml" && !hasChildren) {
    // Self-closing in XML mode when no children
    buffer.append(" />");
    return;
  }

  // Close opening tag
  buffer.append(">");

  // Render children
  if (content) {
    for (const child of content) {
      await renderNode(child, buffer, context, mode);
    }
  }

  // Render closing tag
  buffer.append("</");
  buffer.append(tag);
  buffer.append(">");
}

/**
 * Renders attributes to the buffer.
 */
function renderAttributes(
  attributes: Record<string, unknown>,
  buffer: StreamBuffer,
  mode: "html" | "xml",
): void {
  for (const [key, value] of Object.entries(attributes)) {
    if (value == null) {
      continue;
    }

    if (mode === "html" && booleanAttributes.has(key)) {
      // HTML mode: boolean attributes
      if (value === true) {
        buffer.append(" ");
        buffer.append(key);
      } else if (value !== false) {
        // Non-boolean value for a boolean attribute
        buffer.append(" ");
        buffer.append(key);
        buffer.append('="');
        buffer.append(escapeHtml(String(value)));
        buffer.append('"');
      }
    } else {
      // Regular attributes
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

      buffer.append(" ");
      buffer.append(key);
      buffer.append('="');
      buffer.append(escapeHtml(stringValue));
      buffer.append('"');
    }
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
export async function render(content: JSXNode, options?: RenderOptions): Promise<string> {
  let result = "";
  for await (const chunk of renderStream(content, options)) {
    result += chunk;
  }
  return result;
}
