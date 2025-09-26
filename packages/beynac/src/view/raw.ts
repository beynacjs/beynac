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

export function raw(content: string): RawContent {
  return new RawContent(content);
}
