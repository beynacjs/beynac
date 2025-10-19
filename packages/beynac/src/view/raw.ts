import { SPECIAL_NODE } from "./special-node";

export class RawContent {
  #content: string;

  constructor(content: string) {
    this.#content = content;
    Object.assign(this, { [SPECIAL_NODE]: true });
  }

  toString(): string {
    return this.#content;
  }

  [Symbol.toPrimitive](): string {
    return this.#content;
  }
}

/**
 * Render a raw string directly in the document, for example to include
 * pre-rendered HTML or a block of javascript.
 *
 * Can be used within JSX and html`` templates.
 *
 * @example
 * <div>{renderMarkdownToHtml(markdown)}</div>
 */
export function raw(content: string): RawContent {
  return new RawContent(content);
}
