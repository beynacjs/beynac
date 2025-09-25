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

  renderNode(content, buf, rootContext, mode).then(
    () => buf.complete(),
    () => buf.complete(),
  );

  return buf.stream();
}

class StreamBuffer {
  private buffer: string = "";
  private pending: string[] = [];
  private resolver: ((value: { done: boolean; chunk?: string }) => void) | null = null;
  private completed = false;

  add(content: string): void {
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
    this.yield();
    this.completed = true;

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

async function renderNode(
  node: JSXNode,
  buf: StreamBuffer,
  context: ContextImpl,
  mode: "html" | "xml",
): Promise<void> {
  if (node == null || typeof node === "boolean") return;
  if (typeof node === "string" || typeof node === "number") {
    buf.add(escapeHtml(String(node)));
  } else if (node instanceof RawContent) {
    buf.add(node.toString());
  } else if (Array.isArray(node)) {
    for (const item of node) {
      await renderNode(item as JSXNode, buf, context, mode);
    }
  } else if (typeof node === "function") {
    const childContext = context.fork();
    const result = node(childContext) as JSXNode;
    const contextToUse = childContext.wasModified() ? childContext : context;
    await renderNode(result, buf, contextToUse, mode);
  } else if (node instanceof Promise) {
    buf.yield();
    const resolved = (await node) as JSXNode;
    await renderNode(resolved, buf, context, mode);
  } else if (node instanceof MarkupStream) {
    await renderMarkupStream(node, buf, context, mode);
  }
}

async function renderMarkupStream(
  { tag, attributes, content }: MarkupStream,
  buf: StreamBuffer,
  context: ContextImpl,
  mode: "html" | "xml",
): Promise<void> {
  const hasChildren = content && content.length > 0;

  if (tag) {
    const isVoidElement = mode === "html" && emptyTags.has(tag);
    if (isVoidElement && hasChildren) {
      throw new Error(`<${tag}> is a void element and must not have children`);
    }

    const selfClosing = !isVoidElement && mode === "xml" && !hasChildren;
    renderOpeningTag(tag, attributes, buf, mode, selfClosing);

    if (isVoidElement || selfClosing) {
      return;
    }
  }

  if (content) {
    for (const child of content) {
      await renderNode(child, buf, context, mode);
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
