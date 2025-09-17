import { arrayWrap } from "utils";
import { ContextImpl } from "./context";
import type { Content, JSX, RenderOptions } from "./public-types";
import { RawContent } from "./raw";

export type { RenderOptions };

export class MarkupStream implements JSX.Element {
  readonly tag: string | null;
  readonly attributes: Record<string, unknown> | null;
  readonly content: Content[] | null;
  readonly context: ContextImpl | undefined;
  #contentTreeExpanded = false;

  constructor(
    tag: string | null,
    attributes: Record<string, unknown> | null,
    children: Content,
    context?: ContextImpl
  ) {
    this.tag = tag;
    this.attributes = attributes;
    this.content = children == null ? null : arrayWrap(children);
    this.context = context;
  }

  #expandContentTree(parentContext?: ContextImpl): void {
    if (this.#contentTreeExpanded) return;
    this.#contentTreeExpanded = true;
    if (!this.content) return;

    const rootContext = this.context || parentContext || new ContextImpl();

    const expandNode = (
      array: Content[],
      index: number,
      context: ContextImpl
    ): void => {
      const node = array[index];

      if (typeof node === "function") {
        const result = node(context);
        const clonedContext = context._takeCloneAndReset();
        array[index] = clonedContext
          ? new MarkupStream(null, null, result, clonedContext)
          : result;
        expandNode(array, index, clonedContext || context);
      } else if (node instanceof Promise) {
        node
          .then((resolved) => {
            array[index] = resolved;
            expandNode(array, index, context);
          })
          .catch(() => {
            // TODO define error handling strategy and add appropriate tests
            array[index] = "";
          });
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
            buffer += escapeHtml(String(value));
            buffer += '"';
          }
        }
      }

      buffer += selfClosing ? " />" : ">";
    };

    const pushStackFrame = (
      content: Content[] | null,
      tag: string | null,
      attributes: Record<string, unknown> | null
    ): void => {
      const selfClosing = mode === "xml" && !content?.length;
      if (tag) {
        renderOpeningTag(tag, attributes, selfClosing);
      }
      const htmlEmptyTag = tag && mode === "html" && emptyTags.has(tag);
      nodeStack.push({
        content: htmlEmptyTag ? [] : (content ?? []),
        tag,
        index: 0,
      });
    };

    // Start with root
    pushStackFrame(this.content, this.tag, this.attributes);

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

      if (node instanceof Promise) {
        // Yield current buffer before awaiting
        if (buffer) {
          yield buffer;
          buffer = "";
        }
        // Await the promise - the slot will have been updated by expandContentTree
        await (node as Promise<unknown>);
        // Don't increment index - reprocess this slot with the resolved value
      } else if (typeof node === "function") {
        // This shouldn't happen - functions should be expanded already
        // But handle it just in case for robustness
        throw new Error(
          "Unexpected function during render - expansion may have failed"
        );
      } else if (node instanceof MarkupStream) {
        pushStackFrame(node.content, node.tag, node.attributes);
      } else if (Array.isArray(node)) {
        pushStackFrame(node, null, null);
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
  content: Content[];
  tag: string | null;
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
