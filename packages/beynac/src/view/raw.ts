import { SPECIAL_NODE } from "./special-node";

export class RawContent {
  #content: string;
  [SPECIAL_NODE] = true;

  constructor(content: string) {
    this.#content = content;
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
